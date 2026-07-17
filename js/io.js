/* io.js — export/import de fichiers (le pont hors ligne entre PC et téléphone). */

const IO = (() => {

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error(I18n.t('io.readError')));
      r.readAsText(file, 'utf-8');
    });
  }

  /* Validation du format questionnaire (voir spec d'échange, version 1). */
  function validateQuiz(obj) {
    const err = msg => { throw new Error(msg); };
    if (!obj || typeof obj !== 'object') err(I18n.t('io.notJsonObject'));
    if (obj.type !== 'quiz') err(I18n.t('io.notQuiz'));
    if (obj.version !== 1) err(I18n.t('io.unknownVersion', { v: obj.version }));
    if (typeof obj.titre !== 'string' || !obj.titre.trim()) err(I18n.t('io.missingTitle'));
    if (!Array.isArray(obj.questions) || obj.questions.length === 0) err(I18n.t('io.noQuestions'));
    obj.questions.forEach((q, i) => {
      const n = i + 1;
      if (typeof q.texte !== 'string') err(I18n.t('io.missingText', { n: n }));
      if (!Array.isArray(q.choix) || q.choix.length < 2 || q.choix.length > 4)
        err(I18n.t('io.choiceRange', { n: n }));
      const letters = ['A', 'B', 'C', 'D'].slice(0, q.choix.length);
      if (!letters.includes(q.bonneReponse))
        err(I18n.t('io.invalidAnswer', { n: n, letter: q.bonneReponse }));
    });
    return obj;
  }

  /* Lecture avec détection d'encodage : les CSV enregistrés par Excel (Windows)
     sont souvent en Windows-1252, pas en UTF-8 — sinon les accents cassent. */
  function readFileSmart(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const buf = r.result;
        try {
          resolve(new TextDecoder('utf-8', { fatal: true }).decode(buf));
        } catch (_) {
          resolve(new TextDecoder('windows-1252').decode(buf));
        }
      };
      r.onerror = () => reject(new Error(I18n.t('io.readError')));
      r.readAsArrayBuffer(file);
    });
  }

  /* Parse un CSV en gérant les champs entre guillemets ("" = guillemet littéral).
     Séparateur ( ; , ou tabulation ) détecté sur la première ligne hors guillemets. */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const firstLine = (text.split(/\r\n|\r|\n/)[0] || '').replace(/"[^"]*"/g, '');
    const sep = [';', '\t', ','].reduce((best, s) =>
      firstLine.split(s).length > firstLine.split(best).length ? s : best, ';');
    const rows = [];
    let row = [], cur = '', inQ = false, started = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true; started = true;
      } else if (ch === sep) {
        row.push(cur.trim()); cur = ''; started = true;
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (started || cur.trim() !== '') { row.push(cur.trim()); rows.push(row); }
        row = []; cur = ''; started = false;
      } else { cur += ch; started = true; }
    }
    if (started || cur.trim() !== '') { row.push(cur.trim()); rows.push(row); }
    return rows.filter(r => r.some(c => c !== ''));
  }

  /* Convertit un CSV en questionnaire.
     Ligne 1 : titre. Lignes suivantes : question ; bonne réponse (1-4 ou A-D) ;
     choix A ; choix B ; [choix C] ; [choix D]. */
  function csvToQuiz(rows) {
    const err = msg => { throw new Error(msg); };
    if (rows.length < 2) err(I18n.t('io.csvTooShort'));
    const titre = (rows[0][0] || '').trim();
    if (!titre) err(I18n.t('io.csvMissingTitle'));
    const LETTRES = ['A', 'B', 'C', 'D'];
    const questions = rows.slice(1).map((cells, i) => {
      const ligne = i + 2;
      const texte = (cells[0] || '').trim();
      if (!texte) err(I18n.t('io.csvEmptyQuestion', { n: ligne }));
      const choix = cells.slice(2).map(c => c.trim()).filter(c => c !== '');
      if (choix.length < 2) err(I18n.t('io.csvMinChoices', { n: ligne }));
      if (choix.length > 4) err(I18n.t('io.csvMaxChoices', { n: ligne, count: choix.length }));
      const raw = (cells[1] || '').trim().toUpperCase();
      let idx = -1;
      if (/^[1-4]$/.test(raw)) idx = parseInt(raw, 10) - 1;
      else if (/^[A-D]$/.test(raw)) idx = LETTRES.indexOf(raw);
      else err(I18n.t('io.csvInvalidAnswer', { n: ligne, raw: raw }));
      if (idx >= choix.length) err(I18n.t('io.csvAnswerOutOfRange', { n: ligne, raw: raw, count: choix.length }));
      return { num: i + 1, texte: texte, choix: choix, bonneReponse: LETTRES[idx] };
    });
    return {
      type: 'quiz', version: 1,
      id: 'quiz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      titre: titre, questions: questions, modifie: new Date().toISOString()
    };
  }

  function slug(text) {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) || I18n.t('io.slugFallback');
  }

  return { download, readFile, readFileSmart, parseCSV, csvToQuiz, validateQuiz, slug };
})();
