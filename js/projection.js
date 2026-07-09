/* projection.js — projection en direct via WebRTC (PeerJS).
   PC (vidéoprojecteur) : affiche un code de session, reçoit du téléphone
   le questionnaire puis les mises à jour {question courante, numéros ayant répondu}.
   Téléphone : depuis le mode Scan, se connecte avec le code et pousse l'état.
   Seuls des NUMÉROS de cartes transitent — jamais de noms : le PC les associe
   avec sa propre liste de classe locale. */

const Projection = (() => {

  const PREFIX = 'cqcm-';
  const LETTERS = ['A', 'B', 'C', 'D'];

  /* ================= côté PC (récepteur / affichage) ================= */
  let hostPeer = null, hostConn = null;
  let pcQuiz = null, pcState = null, pcRoster = null;

  function randomCode() {
    // Sans caractères ambigus (0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  async function startHost() {
    stopHost();
    const code = randomCode();
    setHostStatus('Connexion au service d\u2019annuaire\u2026');
    document.getElementById('proj-code').textContent = code;
    try {
      hostPeer = new Peer(PREFIX + code, { debug: 0 });
    } catch (e) {
      setHostStatus('WebRTC indisponible : ' + e.message, true);
      return;
    }
    hostPeer.on('open', () => {
      setHostStatus('En attente du t\u00e9l\u00e9phone\u2026 Entrez le code ' + code +
        ' dans le mode Scan (bouton \u00ab Projeter \u00bb).');
    });
    hostPeer.on('connection', c => {
      hostConn = c;
      c.on('data', onHostData);
      c.on('open', () => setHostStatus('T\u00e9l\u00e9phone connect\u00e9.', false, true));
      c.on('close', () => setHostStatus('T\u00e9l\u00e9phone d\u00e9connect\u00e9. Le code ' + code + ' reste valable pour se reconnecter.', true));
    });
    hostPeer.on('error', e => {
      setHostStatus('Connexion impossible (' + e.type + '). V\u00e9rifiez l\u2019acc\u00e8s internet, ' +
        'puis r\u00e9essayez. Certains r\u00e9seaux d\u2019\u00e9cole bloquent les connexions directes ' +
        'entre appareils \u2014 essayez le t\u00e9l\u00e9phone en 4G/5G.', true);
    });
    pcRoster = await Storage.getRoster();
  }

  function stopHost() {
    if (hostPeer) { try { hostPeer.destroy(); } catch (_) {} }
    hostPeer = null; hostConn = null; pcQuiz = null; pcState = null;
  }

  function onHostData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'quiz' && msg.quiz && Array.isArray(msg.quiz.questions)) {
      pcQuiz = msg.quiz;
    }
    if (msg.t === 'state' && typeof msg.qIndex === 'number' && Array.isArray(msg.ids)) {
      pcState = { qIndex: msg.qIndex, ids: msg.ids.map(Number).filter(n => n >= 1 && n <= 40) };
    }
    renderDisplay();
  }

  function renderDisplay() {
    if (!pcQuiz || !pcState) return;
    document.getElementById('proj-wait').classList.add('hidden');
    const disp = document.getElementById('proj-display');
    disp.classList.remove('hidden');

    const q = pcQuiz.questions[pcState.qIndex];
    if (!q) return;
    document.getElementById('proj-q-num').textContent =
      'Question ' + q.num + ' / ' + pcQuiz.questions.length;
    document.getElementById('proj-q-text').textContent = q.texte;

    const choicesEl = document.getElementById('proj-choices');
    choicesEl.innerHTML = '';
    q.choix.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'proj-choice';
      div.innerHTML = '<span class="proj-letter">' + LETTERS[i] + '</span><span class="proj-choice-text"></span>';
      div.querySelector('.proj-choice-text').textContent = c;
      choicesEl.appendChild(div);
    });

    const answered = new Set(pcState.ids);
    const grid = document.getElementById('proj-chips');
    grid.innerHTML = '';
    let expected = 0;
    for (let id = 1; id <= 40; id++) {
      const e = pcRoster && pcRoster[id - 1];
      const inClass = e && (e.nom || e.prenom);
      const hasRoster = pcRoster && pcRoster.some(r => r.nom || r.prenom);
      if (hasRoster && !inClass) continue;
      expected++;
      const chip = document.createElement('div');
      chip.className = 'proj-chip' + (answered.has(id) ? ' proj-chip-on' : '');
      chip.textContent = inClass
        ? (e.prenom || e.nom) + (e.prenom && e.nom ? ' ' + e.nom.charAt(0) + '.' : '')
        : 'n\u00b0 ' + id;
      grid.appendChild(chip);
    }
    document.getElementById('proj-counter').textContent =
      answered.size + ' / ' + expected;
  }

  function setHostStatus(msg, isError, isOk) {
    const el = document.getElementById('proj-status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.style.color = isOk ? 'var(--ok)' : '';
  }

  /* ================= côté téléphone (émetteur) ================= */
  let phonePeer = null, phoneConn = null;
  let lastQuiz = null, lastState = null;

  function phoneConnect(code, onStatus) {
    phoneDisconnect();
    code = (code || '').trim().toUpperCase();
    if (code.length !== 5) { onStatus('Code invalide (5 caract\u00e8res attendus).', true); return; }
    onStatus('Connexion\u2026');
    try {
      phonePeer = new Peer({ debug: 0 });
    } catch (e) { onStatus('WebRTC indisponible : ' + e.message, true); return; }
    phonePeer.on('open', () => {
      phoneConn = phonePeer.connect(PREFIX + code, { reliable: true });
      phoneConn.on('open', () => {
        onStatus('Projection connect\u00e9e \u2713', false, true);
        if (lastQuiz) phoneConn.send({ t: 'quiz', quiz: lastQuiz });
        if (lastState) phoneConn.send(lastState);
      });
      phoneConn.on('close', () => onStatus('Projection d\u00e9connect\u00e9e.', true));
      phoneConn.on('error', () => onStatus('Erreur de connexion.', true));
    });
    phonePeer.on('error', e => {
      onStatus('\u00c9chec (' + e.type + '). Internet requis pour \u00e9tablir la connexion ; ' +
        'si le Wi-Fi de l\u2019\u00e9cole bloque, essayez en 4G/5G.', true);
    });
  }

  function phoneDisconnect() {
    if (phonePeer) { try { phonePeer.destroy(); } catch (_) {} }
    phonePeer = null; phoneConn = null;
  }

  /* Appelé par le mode Scan à chaque changement (verrouillage, question, saisie manuelle). */
  function notifyFromScan(quiz, qIndex, detections) {
    if (quiz !== lastQuiz) {
      lastQuiz = quiz;
      if (phoneConn && phoneConn.open) phoneConn.send({ t: 'quiz', quiz: quiz });
    }
    lastState = { t: 'state', qIndex: qIndex, ids: Object.keys(detections).map(Number) };
    if (phoneConn && phoneConn.open) phoneConn.send(lastState);
  }

  /* ================= branchement ================= */
  function init() {
    const btnStart = document.getElementById('btn-proj-start');
    if (btnStart) btnStart.onclick = startHost;
    const btnFull = document.getElementById('btn-proj-full');
    if (btnFull) btnFull.onclick = () => {
      const el = document.getElementById('proj-screen');
      if (el.requestFullscreen) el.requestFullscreen();
    };
    // Côté téléphone (dans le mode Scan)
    const btnConnect = document.getElementById('btn-scan-projector');
    if (btnConnect) btnConnect.onclick = () => {
      const code = document.getElementById('scan-projector-code').value;
      phoneConnect(code, (msg, isError, isOk) => {
        const el = document.getElementById('scan-projector-status');
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.style.color = isOk ? 'var(--ok)' : '';
      });
    };
  }

  function onLeavePC() { stopHost(); }

  return { init, notifyFromScan, phoneDisconnect, onLeavePC };
})();
