/* results.js — tableau de bord des résultats.
   Trois onglets : Résumé (matrice élèves x questions), Participants (triable),
   Questions (répartition des réponses par proposition).
   Source : sessions locales (scannées ici ou importées par fichier/lien). */

const Results = (() => {

  const LETTERS = ['A', 'B', 'C', 'D'];
  let data = null;       // analyse de la session sélectionnée
  let sortKey = 'num', sortDir = 1;

  /* ---------- analyse ---------- */
  async function analyze(session) {
    const quiz = session.quiz || await Storage.getQuiz(session.quizId);
    if (!quiz) return null;
    const roster = await Storage.getRoster();
    const hasRoster = roster.some(r => r.nom || r.prenom);

    // Élèves = union (classe locale remplie) U (numéros apparaissant dans les réponses)
    const ids = new Set();
    if (hasRoster) roster.forEach((e, i) => { if (e.nom || e.prenom) ids.add(i + 1); });
    session.reponses.forEach(r => Object.keys(r.detections).forEach(id => ids.add(Number(id))));

    const questions = quiz.questions;
    const students = [...ids].sort((a, b) => a - b).map(id => {
      const e = roster[id - 1] || {};
      const answers = questions.map((q, qi) => {
        const rep = session.reponses[qi] ? session.reponses[qi].detections[id] : undefined;
        if (rep === undefined) return { letter: null, ok: null };       // pas de réponse
        return { letter: rep, ok: rep === q.bonneReponse };
      });
      const answered = answers.filter(a => a.letter !== null).length;
      const correct = answers.filter(a => a.ok === true).length;
      return {
        id: id, nom: e.nom || '', prenom: e.prenom || '',
        label: (e.prenom || e.nom) ? [e.prenom, e.nom].filter(Boolean).join(' ') : 'Carte ' + id,
        answers: answers, answered: answered, correct: correct,
        // Score calculé sur le TOTAL des questions (une non-réponse compte fausse).
        pct: Math.round(100 * correct / questions.length)
      };
    });

    const perQuestion = questions.map((q, qi) => {
      const counts = {}; LETTERS.slice(0, q.choix.length).forEach(l => counts[l] = 0);
      let invalid = 0, none = 0, correct = 0;
      students.forEach(s => {
        const a = s.answers[qi];
        if (a.letter === null) { none++; return; }
        if (counts[a.letter] !== undefined) counts[a.letter]++; else invalid++;
        if (a.ok) correct++;
      });
      const answered = students.length - none;
      return {
        q: q, counts: counts, invalid: invalid, none: none,
        answered: answered, correct: correct,
        pct: answered ? Math.round(100 * correct / answered) : null
      };
    });

    return { session, quiz, students, perQuestion };
  }

  /* ---------- rendu général ---------- */
  async function render(selectId) {
    const select = document.getElementById('results-session-select');
    const sessions = await Storage.listSessions();
    sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    select.innerHTML = '';
    if (sessions.length === 0) {
      select.innerHTML = '<option value="">Aucune session \u2014 importez un fichier de r\u00e9sultats</option>';
      document.getElementById('results-body').classList.add('hidden');
      document.getElementById('results-empty').classList.remove('hidden');
      return;
    }
    document.getElementById('results-empty').classList.add('hidden');
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = (s.quizTitre || s.quizId) + ' \u2014 ' + new Date(s.date).toLocaleString('fr-FR');
      select.appendChild(opt);
    });
    select.value = selectId && sessions.some(s => s.id === selectId) ? selectId : sessions[0].id;
    await analyzeSelected();
  }

  async function analyzeSelected() {
    const id = document.getElementById('results-session-select').value;
    const sessions = await Storage.listSessions();
    const session = sessions.find(s => s.id === id);
    const body = document.getElementById('results-body');
    const errEl = document.getElementById('results-error');
    data = session ? await analyze(session) : null;
    errEl.classList.add('hidden');
    if (session && !data) {
      errEl.textContent = 'Cette session ne contient pas le questionnaire et celui-ci ' +
        'n\u2019est pas sur cet appareil : importez d\u2019abord le questionnaire \u00ab ' +
        (session.quizTitre || session.quizId) + ' \u00bb (onglet Questionnaires) pour corriger.';
      errEl.classList.remove('hidden');
      body.classList.add('hidden');
      return;
    }
    if (!data) { body.classList.add('hidden'); return; }
    body.classList.remove('hidden');
    renderSummary(); renderStudents(); renderQuestions();
  }

  function escapeAttr(t) {
    return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cellMark(a, question, student) {
    let reponse;
    if (a.letter === null) {
      reponse = '(aucune)';
    } else {
      const idx = LETTERS.indexOf(a.letter);
      const texte = question.choix[idx];
      reponse = a.letter + (texte ? ' \u2014 ' + texte : '');
    }
    const tip = 'Question : ' + question.texte + '\n' +
      'R\u00e9ponse de ' + student.label + ' : ' + reponse;
    const cls = a.letter === null ? 'rc-none' : (a.ok ? 'rc-ok' : 'rc-ko');
    const mark = a.letter === null ? '\u2013' : (a.ok ? '\u2713' : '\u2717');
    return '<td class="rc-cell ' + cls + '" title="' + escapeAttr(tip) + '">' + mark + '</td>';
  }

  /* ---------- onglet 1 : résumé (matrice) ---------- */
  function renderSummary() {
    const wrap = document.getElementById('results-summary');
    const n = data.quiz.questions.length;
    let html = '<div class="table-scroll"><table class="rc-table"><thead><tr><th>\u00c9l\u00e8ve</th>';
    for (let i = 0; i < n; i++) {
      const pq = data.perQuestion[i];
      html += '<th class="rc-qhead">Q' + (i + 1) +
        '<span class="rc-qpct">' + (pq.pct === null ? '\u2013' : pq.pct + '\u00a0%') + '</span></th>';
    }
    html += '<th>Score</th></tr></thead><tbody>';
    data.students.forEach(s => {
      html += '<tr><td class="rc-name"></td>';
      s.answers.forEach((a, qi) => { html += cellMark(a, data.quiz.questions[qi], s); });
      html += '<td class="rc-score">' + s.correct + '/' + data.quiz.questions.length +
        '<span class="rc-qpct">' + s.pct + '\u00a0%</span></td></tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    // Noms injectés en textContent (jamais en HTML)
    wrap.querySelectorAll('.rc-name').forEach((td, i) => { td.textContent = data.students[i].label; });
  }

  /* ---------- onglet 2 : participants (triable) ---------- */
  function renderStudents() {
    const wrap = document.getElementById('results-students');
    const sorted = [...data.students].sort((a, b) => {
      let v = 0;
      if (sortKey === 'num') v = a.id - b.id;
      if (sortKey === 'nom') v = a.label.localeCompare(b.label, 'fr');
      if (sortKey === 'score') v = (a.pct - b.pct) || (a.correct - b.correct);
      return v * sortDir;
    });
    const arrow = k => sortKey === k ? (sortDir === 1 ? ' \u25b2' : ' \u25bc') : '';
    let html = '<div class="table-scroll"><table class="rc-table"><thead><tr>' +
      '<th class="rc-sort" data-k="num">N\u00b0' + arrow('num') + '</th>' +
      '<th class="rc-sort" data-k="nom">\u00c9l\u00e8ve' + arrow('nom') + '</th>' +
      '<th class="rc-sort" data-k="score">Bonnes r\u00e9ponses' + arrow('score') + '</th>' +
      '<th>%</th></tr></thead><tbody>';
    sorted.forEach(s => {
      const nq = data.quiz.questions.length;
      const manque = nq - s.answered;
      html += '<tr><td>' + s.id + '</td><td class="rc-name"></td>' +
        '<td>' + s.correct + ' / ' + nq +
        (manque ? ' <span class="rc-qpct">(' + manque + ' sans r\u00e9ponse)</span>' : '') + '</td>' +
        '<td><strong>' + s.pct + '\u00a0%</strong></td></tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('.rc-name').forEach((td, i) => { td.textContent = sorted[i].label; });
    wrap.querySelectorAll('.rc-sort').forEach(th => {
      th.onclick = () => {
        const k = th.dataset.k;
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
        renderStudents();
      };
    });
  }

  /* ---------- onglet 3 : questions ---------- */
  function renderQuestions() {
    const wrap = document.getElementById('results-questions');
    wrap.innerHTML = '';
    data.perQuestion.forEach((pq, qi) => {
      const block = document.createElement('div');
      block.className = 'q-block';
      let inner = '<div class="q-head"><span class="q-num">Question ' + (qi + 1) +
        '</span><span class="rc-qsummary">' + pq.correct + ' / ' + pq.answered +
        ' justes' + (pq.pct === null ? '' : ' (' + pq.pct + '\u00a0%)') + '</span></div>' +
        '<p class="rc-qtext"></p><div class="rc-props">';
      LETTERS.slice(0, pq.q.choix.length).forEach((l, i) => {
        const good = l === pq.q.bonneReponse;
        const count = pq.counts[l];
        const bar = pq.answered ? Math.round(100 * count / pq.answered) : 0;
        inner += '<div class="rc-prop' + (good ? ' rc-prop-good' : '') + '">' +
          '<span class="rc-prop-letter">' + l + (good ? ' \u2713' : '') + '</span>' +
          '<span class="rc-prop-text"></span>' +
          '<span class="rc-prop-count">' + count + ' r\u00e9ponse' + (count > 1 ? 's' : '') + '</span>' +
          '<span class="rc-prop-bar"><span style="width:' + bar + '%"></span></span></div>';
      });
      inner += '</div>';
      const extras = [];
      if (pq.none) extras.push(pq.none + ' sans r\u00e9ponse');
      if (pq.invalid) extras.push(pq.invalid + ' r\u00e9ponse(s) hors choix propos\u00e9s (compt\u00e9es fausses)');
      if (extras.length) inner += '<p class="q-hint">' + extras.join(' \u00b7 ') + '</p>';
      block.innerHTML = inner;
      block.querySelector('.rc-qtext').textContent = pq.q.texte;
      block.querySelectorAll('.rc-prop-text').forEach((el, i) => { el.textContent = pq.q.choix[i]; });
      wrap.appendChild(block);
    });
  }

  /* ---------- exports ---------- */
  function exportCSV() {
    if (!data) return;
    const n = data.quiz.questions.length;
    const lines = [];
    lines.push('numero;nom;prenom;' + data.quiz.questions.map((_, i) => 'Q' + (i + 1)).join(';') + ';justes;repondues;pourcentage');
    data.students.forEach(s => {
      lines.push([s.id, s.nom, s.prenom,
        ...s.answers.map(a => a.letter === null ? '' : a.letter + (a.ok ? ' (juste)' : ' (faux)')),
        s.correct, s.answered, s.pct + '%'].join(';'));
    });
    lines.push(['', '', '% justes par question',
      ...data.perQuestion.map(pq => pq.pct === null ? '' : pq.pct + '%'), '', '', ''].join(';'));
    IO.download('resultats-' + IO.slug(data.quiz.titre) + '.csv',
      '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function exportTXT() {
    if (!data) return;
    const L = [];
    L.push('RESULTATS \u2014 ' + data.quiz.titre);
    L.push('Session du ' + new Date(data.session.date).toLocaleString('fr-FR'));
    L.push('Participants : ' + data.students.length);
    L.push('');
    L.push('=== PAR \u00c9L\u00c8VE ===');
    data.students.forEach(s => {
      L.push(s.label + ' (carte ' + s.id + ') : ' + s.correct + '/' + data.quiz.questions.length +
        ' soit ' + s.pct + ' %' + (s.answered < data.quiz.questions.length ?
        ' (' + (data.quiz.questions.length - s.answered) + ' sans r\u00e9ponse)' : ''));
    });
    L.push('');
    L.push('=== PAR QUESTION ===');
    data.perQuestion.forEach((pq, qi) => {
      L.push('Q' + (qi + 1) + '. ' + pq.q.texte);
      LETTERS.slice(0, pq.q.choix.length).forEach(l => {
        L.push('   ' + l + (l === pq.q.bonneReponse ? ' (bonne r\u00e9ponse)' : '') +
          ' \u2014 ' + pq.q.choix[LETTERS.indexOf(l)] + ' : ' + pq.counts[l] + ' r\u00e9ponse(s)');
      });
      L.push('   Justes : ' + pq.correct + '/' + pq.answered +
        (pq.pct === null ? '' : ' (' + pq.pct + ' %)') +
        (pq.none ? ' \u2014 sans r\u00e9ponse : ' + pq.none : ''));
      L.push('');
    });
    IO.download('resultats-' + IO.slug(data.quiz.titre) + '.txt', L.join('\r\n'), 'text/plain;charset=utf-8');
  }

  /* ---------- import fichier ---------- */
  async function importSessionFile(file) {
    try {
      const obj = JSON.parse(await IO.readFileSmart(file));
      if (obj.type !== 'session' || !Array.isArray(obj.reponses))
        throw new Error('Ce fichier n\u2019est pas une session de scan (type attendu : "session").');
      await Storage.saveSession(obj);
      render(obj.id);
    } catch (e) {
      alert('Import impossible : ' + e.message);
    }
  }

  /* ---------- branchement ---------- */
  function init() {
    document.getElementById('results-session-select').onchange = analyzeSelected;
    const fi = document.getElementById('file-import-session');
    document.getElementById('btn-import-session').onclick = () => fi.click();
    fi.onchange = () => { if (fi.files[0]) importSessionFile(fi.files[0]); fi.value = ''; };
    document.getElementById('btn-export-results-csv').onclick = exportCSV;
    document.getElementById('btn-export-results-txt').onclick = exportTXT;
    document.querySelectorAll('.subtab').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('.subtab').forEach(x => x.classList.toggle('active', x === t));
        ['summary', 'students', 'questions'].forEach(v =>
          document.getElementById('results-' + v).classList.toggle('hidden', t.dataset.sub !== v));
      };
    });
  }

  return { init, render };
})();
