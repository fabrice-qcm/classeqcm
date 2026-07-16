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
        id: id, nom: e.nom || '', prenom: e.prenom || '', niveau: e.niveau || '',
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
        pct: students.length ? Math.round(100 * correct / students.length) : null
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
      reponse = a.letter + (texte ? ' \u2014 ' + MathText.plain(texte) : '');
    }
    const tip = 'Question : ' + MathText.plain(question.texte) + '\n' +
      'R\u00e9ponse de ' + student.label + ' : ' + reponse;
    let mark;
    if (a.letter === null) mark = '<span class="rc-mark none">\u2013</span>';
    else if (a.ok) mark = '<span class="rc-mark ok">\u2713</span>';
    else mark = '<span class="rc-mark ko">\u2715</span>';
    return '<td class="rc-cell" title="' + escapeAttr(tip) + '">' + mark + '</td>';
  }

  /* Classe couleur selon le taux de réussite : rouge <= 40, orange 41-80, vert 81-100 */
  function pctClass(pct) {
    if (pct === null) return 'na';
    if (pct <= 40) return 'r';
    if (pct <= 80) return 'o';
    return 'g';
  }

  /* ---------- onglet 1 : résumé (matrice) ---------- */
  let summarySort = 'nom';   // 'nom' | 'prenom' | 'precision'

  function renderSummary() {
    const wrap = document.getElementById('results-summary');
    const n = data.quiz.questions.length;
    const N = data.students.length;

    /* Statistiques de classe.
       Précision = points obtenus / (points possibles x élèves) — 1 pt par question juste.
       Taux d'achèvement = questions tentées / (questions x élèves). */
    const totalCorrect = data.students.reduce((a, s) => a + s.correct, 0);
    const totalAnswered = data.students.reduce((a, s) => a + s.answered, 0);
    const precision = N && n ? Math.round(100 * totalCorrect / (n * N)) : null;
    const achevement = N && n ? Math.round(100 * totalAnswered / (n * N)) : null;

    let html =
      '<div class="rc-stats">' +
        '<div class="rc-stat"><div class="rc-stat-label">Pr\u00e9cision</div>' +
          '<div class="rc-stat-value ' + pctClass(precision) + '">' +
          (precision === null ? '\u2013' : precision + '\u00a0%') + '</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-label">Taux d\u2019ach\u00e8vement</div>' +
          '<div class="rc-stat-value ' + pctClass(achevement) + '">' +
          (achevement === null ? '\u2013' : achevement + '\u00a0%') + '</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-label">\u00c9l\u00e8ves</div>' +
          '<div class="rc-stat-value">' + N + '</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-label">Questions</div>' +
          '<div class="rc-stat-value">' + n + '</div></div>' +
      '</div>';

    html += '<div class="rc-sortbar"><label for="rc-summary-sort">Trier par</label>' +
      '<select id="rc-summary-sort">' +
      '<option value="nom">Nom de famille</option>' +
      '<option value="prenom">Pr\u00e9nom</option>' +
      '<option value="precision">Pr\u00e9cision</option>' +
      '</select></div>';

    const sorted = [...data.students].sort((a, b) => {
      if (summarySort === 'prenom')
        return (a.prenom || a.label).localeCompare(b.prenom || b.label, 'fr') || (a.id - b.id);
      if (summarySort === 'precision')
        return (b.pct - a.pct) || (b.correct - a.correct) || (a.id - b.id);
      return (a.nom || a.label).localeCompare(b.nom || b.label, 'fr') || (a.id - b.id);
    });

    html += '<div class="table-scroll"><table class="rc-table"><thead><tr><th>\u00c9l\u00e8ve</th>';
    for (let i = 0; i < n; i++) {
      const pq = data.perQuestion[i];
      html += '<th class="rc-qhead">Q' + (i + 1) +
        '<span class="rc-qpct-badge ' + pctClass(pq.pct) + '">' +
        (pq.pct === null ? '\u2013' : pq.pct + '%') + '</span></th>';
    }
    html += '<th>Score</th></tr></thead><tbody>';
    sorted.forEach(s => {
      html += '<tr><td class="rc-name"></td>';
      s.answers.forEach((a, qi) => { html += cellMark(a, data.quiz.questions[qi], s); });
      html += '<td class="rc-score">' +
        '<span class="rc-score-pct">' + s.pct + '\u00a0%</span>' +
        '<span class="rc-score-frac">' + s.correct + '/' + n + '</span></td></tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    // Noms injectés en textContent (jamais en HTML)
    wrap.querySelectorAll('.rc-name').forEach((td, i) => { td.textContent = sorted[i].label; });
    const sortSel = document.getElementById('rc-summary-sort');
    sortSel.value = summarySort;
    sortSel.onchange = () => { summarySort = sortSel.value; renderSummary(); };
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
      MathText.render(block.querySelector('.rc-qtext'), pq.q.texte);
      block.querySelectorAll('.rc-prop-text').forEach((el, i) => { MathText.render(el, pq.q.choix[i]); });
      wrap.appendChild(block);
    });
  }

  /* ---------- exports ---------- */
  function exportCSV() {
    if (!data) return;
    const n = data.quiz.questions.length;
    const lines = [];
    lines.push('numero;nom;prenom;' + data.quiz.questions.map((_, i) => 'Q' + (i + 1)).join(';') + ';justes;total;repondues;precision');
    lines.push(';;enonce;' + data.quiz.questions.map(q => MathText.plain(q.texte).replace(/[;\r\n]/g, ' ')).join(';') + ';;;');
    data.students.forEach(s => {
      lines.push([s.id, s.nom, s.prenom,
        ...s.answers.map(a => a.letter === null ? '' : a.letter + (a.ok ? ' (juste)' : ' (faux)')),
        s.correct, data.quiz.questions.length, s.answered, s.pct + '%'].join(';'));
    });
    lines.push(['', '', '% justes par question',
      ...data.perQuestion.map(pq => pq.pct === null ? '' : pq.pct + '%'), '', '', '', ''].join(';'));
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
    L.push('=== D\u00c9TAIL DES R\u00c9PONSES PAR \u00c9L\u00c8VE ===');
    data.students.forEach(s => {
      L.push(s.label + ' (carte ' + s.id + ')');
      data.quiz.questions.forEach((q, qi) => {
        const a = s.answers[qi];
        let rep;
        if (a.letter === null) rep = 'sans r\u00e9ponse';
        else {
          const idx = LETTERS.indexOf(a.letter);
          rep = a.letter + (q.choix[idx] ? ' (' + MathText.plain(q.choix[idx]) + ')' : '') +
            ' \u2014 ' + (a.ok ? 'juste' : 'faux, attendu ' + q.bonneReponse);
        }
        L.push('   Q' + q.num + '. ' + MathText.plain(q.texte) + ' \u2192 ' + rep);
      });
      L.push('');
    });
    L.push('=== PAR QUESTION ===');
    data.perQuestion.forEach((pq, qi) => {
      L.push('Q' + (qi + 1) + '. ' + MathText.plain(pq.q.texte));
      LETTERS.slice(0, pq.q.choix.length).forEach(l => {
        L.push('   ' + l + (l === pq.q.bonneReponse ? ' (bonne r\u00e9ponse)' : '') +
          ' \u2014 ' + MathText.plain(pq.q.choix[LETTERS.indexOf(l)]) + ' : ' + pq.counts[l] + ' r\u00e9ponse(s)');
      });
      L.push('   Justes : ' + pq.correct + '/' + pq.answered +
        (pq.pct === null ? '' : ' (' + pq.pct + ' %)') +
        (pq.none ? ' \u2014 sans r\u00e9ponse : ' + pq.none : ''));
      L.push('');
    });
    IO.download('resultats-' + IO.slug(data.quiz.titre) + '.txt', L.join('\r\n'), 'text/plain;charset=utf-8');
  }

  /* ---------- export Excel multi-feuilles (présentation type Quizizz) ---------- */
  const XL_HEAD = { font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '1B3A6B' } },
    alignment: { wrapText: true, vertical: 'center' } };
  const XL_GREEN = { fill: { patternType: 'solid', fgColor: { rgb: 'C6EFCE' } },
    font: { color: { rgb: '006100' } } };
  const XL_RED = { fill: { patternType: 'solid', fgColor: { rgb: 'FFC7CE' } },
    font: { color: { rgb: '9C0006' } } };
  const XL_GRAY = { fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    font: { color: { rgb: '808080' } } };

  function styleRow(ws, rowIdx, colCount, style) {
    for (let c = 0; c < colCount; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: c })];
      if (cell) cell.s = style;
    }
  }

  function exportXLSX() {
    if (!data) return;
    const nq = data.quiz.questions.length;
    const P = t => MathText.plain(t);
    const wb = XLSX.utils.book_new();
    const answerText = (q, letter) => {
      const idx = LETTERS.indexOf(letter);
      return (idx >= 0 && q.choix[idx]) ? P(q.choix[idx]) : letter;
    };

    /* ===== Feuille 1 : Résumé — questions en lignes, un élève par colonne ===== */
    const head = ['#', 'Question', 'Bonne réponse', 'Précision', 'Justes', 'Faux', 'Sans réponse',
      ...data.students.map(s => (s.label + ' (n\u00b0 ' + s.id + ')'))];
    const resume = [head];
    data.perQuestion.forEach((pq, qi) => {
      resume.push([pq.q.num, P(pq.q.texte), answerText(pq.q, pq.q.bonneReponse),
        pq.pct === null ? '' : pq.pct / 100,
        pq.correct, pq.answered - pq.correct, pq.none,
        ...data.students.map(s => {
          const a = s.answers[qi];
          return a.letter === null ? '' : answerText(pq.q, a.letter);
        })]);
    });
    const wsResume = XLSX.utils.aoa_to_sheet(resume);
    wsResume['!cols'] = [{ wch: 4 }, { wch: 45 }, { wch: 18 }, { wch: 9 }, { wch: 7 },
      { wch: 7 }, { wch: 12 }, ...data.students.map(() => ({ wch: 15 }))];
    styleRow(wsResume, 0, head.length, XL_HEAD);
    data.perQuestion.forEach((pq, qi) => {
      const rw = 1 + qi;
      const pcell = wsResume[XLSX.utils.encode_cell({ r: rw, c: 3 })];
      if (pcell) pcell.z = '0%';
      data.students.forEach((s, si) => {
        const cell = wsResume[XLSX.utils.encode_cell({ r: rw, c: 7 + si })];
        if (!cell) return;
        const a = s.answers[qi];
        cell.s = a.letter === null ? XL_GRAY : (a.ok ? XL_GREEN : XL_RED);
      });
    });
    XLSX.utils.book_append_sheet(wb, wsResume, 'R\u00e9sum\u00e9');

    /* ===== Feuille 2 : Participants — classés par réussite ===== */
    const ranked = [...data.students].sort((a, b) =>
      (b.pct - a.pct) || (b.correct - a.correct) || (a.id - b.id));
    const partHead = ['Rang', 'Pr\u00e9nom', 'Nom', 'N\u00b0 carte', 'Niveau',
      'Questions', 'Pr\u00e9cision', 'Justes', 'Faux', 'Sans r\u00e9ponse'];
    const part = [partHead];
    ranked.forEach((s, i) => {
      part.push([i + 1, s.prenom, s.nom, s.id, s.niveau || '', nq, s.pct / 100,
        s.correct, s.answered - s.correct, nq - s.answered]);
    });
    const wsPart = XLSX.utils.aoa_to_sheet(part);
    wsPart['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 8 },
      { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 7 }, { wch: 12 }];
    styleRow(wsPart, 0, partHead.length, XL_HEAD);
    ranked.forEach((s, i) => {
      const cell = wsPart[XLSX.utils.encode_cell({ r: 1 + i, c: 6 })];
      if (cell) cell.z = '0%';
    });
    XLSX.utils.book_append_sheet(wb, wsPart, 'Participants');

    /* ===== Feuille 3 : Détail réponses (format long, une ligne par élève x question) ===== */
    const detail = [['N\u00b0 \u00e9l\u00e8ve', 'Nom', 'Pr\u00e9nom', 'N\u00b0 question',
      '\u00c9nonc\u00e9', 'R\u00e9ponse', 'Texte de la r\u00e9ponse',
      'Bonne r\u00e9ponse', 'Texte de la bonne r\u00e9ponse', 'Juste']];
    data.students.forEach(s => {
      data.quiz.questions.forEach((q, qi) => {
        const a = s.answers[qi];
        const idx = a.letter === null ? -1 : LETTERS.indexOf(a.letter);
        detail.push([s.id, s.nom, s.prenom, q.num, P(q.texte),
          a.letter === null ? 'sans r\u00e9ponse' : a.letter,
          idx >= 0 && q.choix[idx] ? P(q.choix[idx]) : '',
          q.bonneReponse, P(q.choix[LETTERS.indexOf(q.bonneReponse)] || ''),
          a.letter === null ? '' : (a.ok ? 'VRAI' : 'FAUX')]);
      });
    });
    const wsDetail = XLSX.utils.aoa_to_sheet(detail);
    wsDetail['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 45 },
      { wch: 12 }, { wch: 26 }, { wch: 12 }, { wch: 26 }, { wch: 7 }];
    styleRow(wsDetail, 0, 10, XL_HEAD);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'D\u00e9tail r\u00e9ponses');

    /* ===== Feuille 4 : Infos (sans donn\u00e9es temporelles) ===== */
    const infos = [
      ['Questionnaire', P(data.quiz.titre)],
      ['Participants', data.students.length],
      ['Questions', nq],
      ['Pr\u00e9cision de classe', Math.round(data.students.reduce((a, s) => a + s.pct, 0) /
        Math.max(1, data.students.length)) / 100],
      ['Note', 'Pr\u00e9cision = justes / total des questions (une non-r\u00e9ponse compte fausse).']
    ];
    const wsInfos = XLSX.utils.aoa_to_sheet(infos);
    wsInfos['!cols'] = [{ wch: 22 }, { wch: 60 }];
    const pc = wsInfos['B4']; if (pc) pc.z = '0%';
    XLSX.utils.book_append_sheet(wb, wsInfos, 'Infos');

    XLSX.writeFile(wb, 'resultats-' + IO.slug(data.quiz.titre) + '.xlsx');
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
    document.getElementById('btn-groupe-besoin').onclick = () => {
      if (!data) return;
      const groupe = data.students.filter(s => s.pct <= 50)
        .sort((a, b) => (a.pct - b.pct) || (a.id - b.id));
      const panel = document.getElementById('results-besoin');
      const list = document.getElementById('besoin-list');
      list.innerHTML = '';
      if (groupe.length === 0) {
        list.textContent = 'Aucun \u00e9l\u00e8ve \u00e0 50 % ou moins sur cette session.';
      } else {
        groupe.forEach(s => {
          const row = document.createElement('div');
          row.className = 'besoin-row';
          row.textContent = s.label + ' (carte ' + s.id + ') \u2014 ' + s.pct + ' % (' +
            s.correct + '/' + data.quiz.questions.length + ')';
          list.appendChild(row);
        });
      }
      panel.classList.remove('hidden');
      document.getElementById('besoin-copy').onclick = async () => {
        const txt = 'Groupe de besoin \u2014 ' + MathText.plain(data.quiz.titre) + '\n' +
          groupe.map(s => s.label + ' (carte ' + s.id + ') : ' + s.pct + ' %').join('\n');
        try { await navigator.clipboard.writeText(txt); } catch (_) {}
      };
      document.getElementById('besoin-close').onclick = () => panel.classList.add('hidden');
    };
    document.getElementById('btn-export-results-xlsx').onclick = exportXLSX;
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
