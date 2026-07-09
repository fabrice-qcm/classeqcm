/* scan.js — mode Scan : caméra, détection ArUco temps réel, réponse par orientation.
   Principe : on balaye la classe ; chaque carte doit être vue avec la même lettre
   sur CONFIRM_FRAMES images consécutives avant d'être enregistrée (anti-erreur).
   Tout est sauvegardé en continu dans IndexedDB. */

const Scan = (() => {

  const CONFIRM_FRAMES = 3;      // détections concordantes requises pour valider
  const FRAME_INTERVAL = 90;     // ms mini entre deux analyses (~11 img/s max)
  const HAMMING = 2;             // tolérance stricte = pas de faux ID (validé en test)
  const MAX_ID = 40;

  let detector = null;
  let stream = null;
  let running = false;
  let lastFrame = 0;
  let videoTrack = null;

  let wakeLock = null;           // verrou anti-veille pendant le scan
  let session = null;            // objet session courant (format d'échange v1)
  let quiz = null;               // questionnaire courant
  let qIndex = 0;                // index de la question courante
  let acc = {};                  // accumulateur id -> {answer, count}
  let flash = {};                // id -> timestamp du dernier verrouillage (feedback)

  /* ---------- orientation -> lettre ----------
     corners[0]->corners[1] est le bord haut du marqueur en position canonique.
     Carte non tournée (A en haut) : vecteur vers la droite, angle 0°.
     Rotation horaire de la carte (D en haut) : +90°. Anti-horaire (B) : -90°. */
  /* Angle de rotation de l'interface par rapport à l'orientation naturelle du
     téléphone. L'image caméra, elle, reste dans le repère du capteur : il faut
     donc compenser, sinon tenir le téléphone en paysage fausse les lettres. */
  function screenAngle() {
    try {
      if (screen.orientation && typeof screen.orientation.angle === 'number')
        return screen.orientation.angle;
    } catch (_) {}
    return (typeof window.orientation === 'number') ? ((window.orientation % 360) + 360) % 360 : 0;
  }

  function markerToAnswer(marker) {
    const c = marker.corners;
    const angle = Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x) * 180 / Math.PI;
    const rawQ = Math.round(angle / 90);
    const sQ = Math.round(screenAngle() / 90);
    // Écran en portrait (0/180) : rotation directe. En paysage (90/270) :
    // la rotation apparente est en miroir (constaté sur appareil réel).
    let q = (sQ % 2 === 1) ? (sQ - rawQ) : (rawQ - sQ);
    q = ((q % 4) + 4) % 4;
    return { 0: 'A', 1: 'D', 2: 'C', 3: 'B' }[q];
  }

  /* ---------- accumulateur anti-erreur ---------- */
  function feed(markers) {
    const locked = [];
    const seen = {};
    for (const m of markers) {
      if (m.id < 1 || m.id > MAX_ID) continue;   // filtre de sécurité
      const letter = markerToAnswer(m);
      if (!letter) continue;
      seen[m.id] = true;
      const a = acc[m.id];
      if (a && a.answer === letter) {
        a.count++;
      } else {
        acc[m.id] = { answer: letter, count: 1 };
      }
      if (acc[m.id].count === CONFIRM_FRAMES) {
        locked.push({ id: m.id, answer: letter, corners: m.corners });
      }
    }
    // Une carte disparue de l'image repart de zéro (pas de comptage fantôme).
    for (const id of Object.keys(acc)) {
      if (!seen[id]) delete acc[id];
    }
    return locked;
  }

  /* ---------- session ---------- */
  function currentDetections() {
    return session.reponses[qIndex].detections;
  }

  async function lockAnswer(id, letter) {
    const det = currentDetections();
    const changed = det[id] !== letter;
    det[id] = letter;
    if (changed) {
      flash[id] = Date.now();
      renderChips();
      updateCounter();
      Projection.notifyFromScan(quiz, qIndex, det);
      await Storage.saveSession(session);
    }
  }

  async function startSession(quizObj) {
    quiz = quizObj;
    const optionReveal = document.getElementById('scan-option-reveal').checked;
    session = {
      optionReveal: optionReveal,
      type: 'session', version: 1,
      id: 'session-' + Date.now().toString(36),
      quizId: quiz.id, quizTitre: quiz.titre,
      quiz: quiz,
      date: new Date().toISOString(),
      reponses: quiz.questions.map(q => ({ question: q.num, detections: {} }))
    };
    qIndex = 0;
    acc = {}; flash = {};
    await Storage.saveSession(session);
    document.getElementById('scan-setup').classList.add('hidden');
    document.getElementById('scan-live').classList.remove('hidden');
    document.getElementById('btn-scan-reveal').classList.toggle('hidden', !optionReveal);
    renderQuestion();
    await startCamera();
  }

  async function resumeSession(s) {
    const q = s.quiz || await Storage.getQuiz(s.quizId);
    if (!q) {
      alert('Le questionnaire de cette session est introuvable sur cet appareil : ' +
        'importez-le d\u2019abord (onglet Questionnaires).');
      return;
    }
    quiz = q;
    session = s;
    qIndex = Math.min(s.qIndex || 0, quiz.questions.length - 1);
    acc = {}; flash = {};
    document.getElementById('scan-setup').classList.add('hidden');
    document.getElementById('scan-live').classList.remove('hidden');
    document.getElementById('btn-scan-reveal').classList.toggle('hidden', !s.optionReveal);
    renderQuestion();
    await startCamera();
  }

  async function endSession() {
    stopCamera();
    Projection.phoneDisconnect();
    if (session) await Storage.saveSession(session);
    session = null; quiz = null;
    document.getElementById('scan-live').classList.add('hidden');
    document.getElementById('scan-setup').classList.remove('hidden');
    renderSetup();
  }

  /* ---------- caméra + boucle de détection ---------- */
  async function startCamera() {
    const video = document.getElementById('scan-video');
    const statusEl = document.getElementById('scan-cam-status');
    statusEl.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
    } catch (e) {
      statusEl.textContent = 'Caméra inaccessible : ' + e.message +
        '. Vérifiez l\u2019autorisation caméra et que la page est en HTTPS.';
      statusEl.classList.add('error');
      return;
    }
    video.srcObject = stream;
    videoTrack = stream.getVideoTracks()[0];
    await video.play();
    setupZoom();
    if (!detector) detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12', maxHammingDistance: HAMMING });
    running = true;
    requestAnimationFrame(loop);
    // Empêcher la mise en veille de l'écran pendant le scan (si supporté).
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (_) { /* refusé ou non supporté : non bloquant */ }
    // Si la caméra est coupée par le système (veille, autre app), le signaler.
    videoTrack.onended = () => {
      running = false;
      const st = document.getElementById('scan-cam-status');
      st.textContent = 'Cam\u00e9ra interrompue par le syst\u00e8me \u2014 touchez \u00ab Relancer la cam\u00e9ra \u00bb.';
      st.classList.add('error');
    };
  }

  function stopCamera() {
    running = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    videoTrack = null;
    if (wakeLock) { try { wakeLock.release(); } catch (_) {} wakeLock = null; }
  }

  /* Zoom optique/numérique si le téléphone le permet : précieux pour le fond de classe. */
  function setupZoom() {
    const wrap = document.getElementById('scan-zoom-wrap');
    const slider = document.getElementById('scan-zoom');
    try {
      const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      if (caps.zoom) {
        slider.min = caps.zoom.min; slider.max = caps.zoom.max;
        slider.step = caps.zoom.step || 0.1; slider.value = caps.zoom.min;
        wrap.classList.remove('hidden');
        slider.oninput = () => {
          videoTrack.applyConstraints({ advanced: [{ zoom: Number(slider.value) }] }).catch(() => {});
        };
      } else wrap.classList.add('hidden');
    } catch (_) { wrap.classList.add('hidden'); }
  }

  function loop(ts) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (ts - lastFrame < FRAME_INTERVAL) return;
    lastFrame = ts;

    const video = document.getElementById('scan-video');
    const canvas = document.getElementById('scan-canvas');
    const overlay = document.getElementById('scan-overlay');
    if (!video.videoWidth) return;

    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let markers = [];
    try { markers = detector.detect(imageData); } catch (_) { /* image dégradée : on passe */ }

    const locked = feed(markers);
    locked.forEach(l => lockAnswer(l.id, l.answer));
    drawOverlay(overlay, markers);
  }

  function drawOverlay(overlay, markers) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const det = session ? currentDetections() : {};
    const bonne = quiz ? quiz.questions[qIndex].bonneReponse : null;
    for (const m of markers) {
      if (m.id < 1 || m.id > MAX_ID) continue;
      const letter = markerToAnswer(m);
      const good = letter === bonne;
      const validated = det[m.id] !== undefined;
      const color = good ? '#2e7d4f' : '#d23b3b';
      ctx.strokeStyle = validated ? color : '#e6a817';
      ctx.lineWidth = Math.max(3, overlay.width / 300);
      ctx.beginPath();
      m.corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.stroke();
      const cx = m.corners.reduce((s, c) => s + c.x, 0) / 4;
      const cy = m.corners.reduce((s, c) => s + c.y, 0) / 4;
      const side = Math.hypot(m.corners[1].x - m.corners[0].x, m.corners[1].y - m.corners[0].y);
      // Grande lettre de la réponse, verte si juste, rouge si fausse
      const size = Math.max(26, side * 0.6);
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = size / 8;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(letter, cx, cy + size / 3);
      ctx.fillStyle = color;
      ctx.fillText(letter, cx, cy + size / 3);
      // Numéro d'élève au-dessus
      ctx.font = 'bold ' + Math.max(15, size / 3) + 'px sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeText('n\u00b0' + m.id + (validated ? ' \u2713' : ''), cx, cy - size / 2);
      ctx.fillText('n\u00b0' + m.id + (validated ? ' \u2713' : ''), cx, cy - size / 2);
    }
  }

  /* ---------- interface : question, compteur, pastilles ---------- */
  function renderQuestion() {
    if (session) { session.qIndex = qIndex; Storage.saveSession(session); }
    const q = quiz.questions[qIndex];
    document.getElementById('scan-q-num').textContent =
      'Question ' + q.num + ' / ' + quiz.questions.length;
    document.getElementById('scan-q-text').textContent = q.texte;
    document.getElementById('scan-q-prev').disabled = qIndex === 0;
    document.getElementById('scan-q-next').textContent =
      qIndex === quiz.questions.length - 1 ? 'Derni\u00e8re question' : 'Question suivante \u2192';
    document.getElementById('scan-q-next').disabled = qIndex === quiz.questions.length - 1;
    acc = {};
    renderChips();
    updateCounter();
    Projection.notifyFromScan(quiz, qIndex, currentDetections());
  }

  async function renderChips() {
    const grid = document.getElementById('scan-chips');
    const det = currentDetections();
    const roster = await Storage.getRoster();
    grid.innerHTML = '';
    for (let id = 1; id <= MAX_ID; id++) {
      const e = roster[id - 1];
      const inClass = e && (e.nom || e.prenom);
      // Sans liste de classe importée sur cet appareil, on affiche les 40.
      if (!inClass && roster.some(r => r.nom || r.prenom)) continue;
      const chip = document.createElement('button');
      chip.className = 'chip' + (det[id] ? ' chip-ok' : '');
      if (flash[id] && Date.now() - flash[id] < 1500) chip.classList.add('chip-flash');
      chip.innerHTML = '<span class="chip-num">' + id + '</span>' +
        (det[id] ? '<span class="chip-ans">' + det[id] + '</span>' : '');
      chip.title = inClass ? [e.prenom, e.nom].filter(Boolean).join(' ') : 'Carte ' + id;
      chip.onclick = () => manualEntry(id);
      grid.appendChild(chip);
    }
  }

  async function updateCounter() {
    const det = currentDetections();
    const roster = await Storage.getRoster();
    const expected = roster.filter(e => e.nom || e.prenom).length || MAX_ID;
    document.getElementById('scan-counter').textContent =
      Object.keys(det).length + ' / ' + expected + ' r\u00e9ponses';
  }

  /* ---------- saisie manuelle / rattrapage ---------- */
  function manualEntry(id) {
    const det = currentDetections();
    const modal = document.getElementById('scan-modal');
    document.getElementById('scan-modal-title').textContent =
      'Carte n\u00b0 ' + id + (det[id] ? ' \u2014 r\u00e9ponse actuelle : ' + det[id] : ' \u2014 pas de r\u00e9ponse');
    modal.classList.remove('hidden');
    const q = quiz.questions[qIndex];
    document.querySelectorAll('#scan-modal .modal-letter').forEach((btn, i) => {
      btn.classList.toggle('hidden', i >= q.choix.length);
      btn.onclick = async () => {
        det[id] = btn.dataset.letter;
        Projection.notifyFromScan(quiz, qIndex, det);
        await Storage.saveSession(session);
        modal.classList.add('hidden');
        renderChips(); updateCounter();
      };
    });
    document.getElementById('scan-modal-clear').onclick = async () => {
      delete det[id];
      Projection.notifyFromScan(quiz, qIndex, det);
      await Storage.saveSession(session);
      modal.classList.add('hidden');
      renderChips(); updateCounter();
    };
    document.getElementById('scan-modal-cancel').onclick = () => modal.classList.add('hidden');
  }

  /* ---------- écran de préparation + sessions enregistrées ---------- */
  async function renderSetup() {
    const select = document.getElementById('scan-quiz-select');
    const quizzes = await Storage.listQuizzes();
    select.innerHTML = '';
    if (quizzes.length === 0) {
      select.innerHTML = '<option value="">Aucun questionnaire \u2014 importez-en un (onglet Questionnaires)</option>';
    } else {
      quizzes.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = q.titre + ' (' + q.questions.length + ' q.)';
        select.appendChild(opt);
      });
    }
    document.getElementById('btn-start-session').disabled = quizzes.length === 0;
    renderSessions();
  }

  async function renderSessions() {
    const wrap = document.getElementById('scan-sessions');
    const sessions = await Storage.listSessions();
    sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    wrap.innerHTML = sessions.length ? '' : '<p class="empty">Aucune session enregistr\u00e9e.</p>';
    sessions.forEach(s => {
      const total = s.reponses.reduce((n, r) => n + Object.keys(r.detections).length, 0);
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = '<div><div class="quiz-card-title"></div>' +
        '<div class="quiz-card-meta">' + new Date(s.date).toLocaleString('fr-FR') +
        ' \u00b7 ' + total + ' r\u00e9ponse' + (total > 1 ? 's' : '') + '</div></div>' +
        '<div class="quiz-card-actions">' +
        '<button class="btn small primary" data-act="resume">Reprendre</button>' +
        '<button class="btn small ghost" data-act="share">Partager</button>' +
        '<button class="btn small ghost" data-act="json">Exporter JSON</button>' +
        '<button class="btn small ghost" data-act="csv">Exporter CSV</button>' +
        '<button class="btn small danger" data-act="del">Supprimer</button></div>';
      card.querySelector('.quiz-card-title').textContent = s.quizTitre || s.quizId;
      card.querySelector('[data-act=resume]').onclick = () => resumeSession(s);
      card.querySelector('[data-act=share]').onclick = () =>
        Share.open(s, 'R\u00e9sultats \u2014 ' + (s.quizTitre || 'session'),
          'Ce lien contient les r\u00e9sultats (num\u00e9ros de cartes, sans noms).');
      card.querySelector('[data-act=json]').onclick = () =>
        IO.download('session-' + IO.slug(s.quizTitre || 'scan') + '-' + s.id + '.json',
          JSON.stringify(s, null, 2), 'application/json');
      card.querySelector('[data-act=csv]').onclick = () => {
        const lines = ['question;carte;reponse'];
        s.reponses.forEach(r => {
          Object.keys(r.detections).sort((a, b) => a - b).forEach(id =>
            lines.push(r.question + ';' + id + ';' + r.detections[id]));
        });
        IO.download('session-' + s.id + '.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
      };
      card.querySelector('[data-act=del]').onclick = async () => {
        if (confirm('Supprimer cette session ? Pensez \u00e0 l\u2019exporter d\u2019abord.')) {
          await Storage.deleteSession(s.id);
          renderSessions();
        }
      };
      wrap.appendChild(card);
    });
  }

  /* ---------- branchement ---------- */
  function init() {
    document.getElementById('btn-start-session').onclick = async () => {
      const id = document.getElementById('scan-quiz-select').value;
      const q = await Storage.getQuiz(id);
      if (q) startSession(q);
    };
    document.getElementById('btn-end-session').onclick = () => {
      if (confirm('Terminer la session ? Elle restera enregistr\u00e9e et exportable.')) endSession();
    };
    document.getElementById('scan-q-prev').onclick = () => { qIndex--; renderQuestion(); };
    document.getElementById('scan-q-next').onclick = () => { qIndex++; renderQuestion(); };
    document.getElementById('btn-restart-cam').onclick = () => {
      if (session) { stopCamera(); startCamera(); }
    };
    document.getElementById('btn-scan-reveal').onclick = () => {
      const q = quiz.questions[qIndex];
      const det = currentDetections();
      const counts = {};
      ['A', 'B', 'C', 'D'].slice(0, q.choix.length).forEach(l => counts[l] = 0);
      Object.values(det).forEach(l => { if (counts[l] !== undefined) counts[l]++; });
      Projection.sendReveal(qIndex, counts);
    };
  }

  /* Coupe la caméra si on quitte l'onglet Scan ou si l'app passe en arrière-plan. */
  function onLeave() { if (running) stopCamera(); }
  function onEnter() {
    if (session) {
      document.getElementById('scan-setup').classList.add('hidden');
      document.getElementById('scan-live').classList.remove('hidden');
      startCamera();
    } else {
      renderSetup();
    }
  }

  async function forceEnd(message) {
    if (!session) return;
    await endSession();
    if (message) alert(message);
  }

  return { init, renderSetup, onEnter, onLeave, forceEnd, _test: { markerToAnswer, feed: (m) => feed(m), _acc: () => acc, _reset: () => { acc = {}; } } };
})();
