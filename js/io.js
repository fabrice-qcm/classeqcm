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
      r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      r.readAsText(file, 'utf-8');
    });
  }

  /* Validation du format questionnaire (voir spec d'échange, version 1). */
  function validateQuiz(obj) {
    const err = msg => { throw new Error(msg); };
    if (!obj || typeof obj !== 'object') err('Le fichier ne contient pas un objet JSON.');
    if (obj.type !== 'quiz') err('Ce fichier n\u2019est pas un questionnaire (type attendu : "quiz").');
    if (obj.version !== 1) err('Version de format inconnue : ' + obj.version);
    if (typeof obj.titre !== 'string' || !obj.titre.trim()) err('Titre manquant.');
    if (!Array.isArray(obj.questions) || obj.questions.length === 0) err('Aucune question dans le fichier.');
    obj.questions.forEach((q, i) => {
      const n = i + 1;
      if (typeof q.texte !== 'string') err('Question ' + n + ' : texte manquant.');
      if (!Array.isArray(q.choix) || q.choix.length < 2 || q.choix.length > 4)
        err('Question ' + n + ' : il faut entre 2 et 4 choix.');
      const letters = ['A', 'B', 'C', 'D'].slice(0, q.choix.length);
      if (!letters.includes(q.bonneReponse))
        err('Question ' + n + ' : bonne réponse invalide (' + q.bonneReponse + ').');
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
      r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      r.readAsArrayBuffer(file);
    });
  }

  /* Parse un CSV simple (sans guillemets imbriqués) : détecte le séparateur
     ( ; , ou tabulation ) sur la première ligne non vide. */
  function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const first = lines[0];
    const sep = [';', '\t', ','].reduce((best, s) =>
      first.split(s).length > first.split(best).length ? s : best, ';');
    return lines.map(l => l.split(sep).map(c => c.trim()));
  }

  function slug(text) {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'sans-titre';
  }

  return { download, readFile, readFileSmart, parseCSV, validateQuiz, slug };
})();
