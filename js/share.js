/* share.js — partage par lien + QR code, sans serveur.
   Les données (questionnaire ou classe) sont compressées et embarquées
   dans le fragment de l'URL (#import=...). Rien ne transite par un serveur :
   le fragment n'est jamais envoyé au réseau, il est lu par l'app à l'ouverture. */

const Share = (() => {

  function baseURL() {
    return location.origin + location.pathname;
  }

  function buildLink(payload) {
    const packed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    return baseURL() + '#import=' + packed;
  }

  /* ---------- affichage du lien + QR ---------- */
  function open(payload, titre, avertissement) {
    const modal = document.getElementById('share-modal');
    const qrBox = document.getElementById('share-qr');
    const linkInput = document.getElementById('share-link');
    const warnEl = document.getElementById('share-warn');
    const statusEl = document.getElementById('share-status');

    document.getElementById('share-title').textContent = 'Partager : ' + titre;
    warnEl.textContent = avertissement || '';
    warnEl.classList.toggle('hidden', !avertissement);
    statusEl.textContent = '';

    let url;
    try {
      url = buildLink(payload);
    } catch (e) {
      alert('Impossible de générer le lien : ' + e.message);
      return;
    }
    linkInput.value = url;

    // QR code : peut échouer si les données dépassent la capacité (~2,9 Ko).
    qrBox.innerHTML = '';
    try {
      const qr = qrcode(0, 'L');
      qr.addData(url, 'Byte');
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      qrBox.querySelector('svg').setAttribute('style', 'width:100%;height:auto;max-width:320px');
    } catch (_) {
      qrBox.innerHTML = '<p class="hint">Contenu trop volumineux pour un QR code ' +
        '(limite \u2248 3 Ko). Utilisez le lien ci-dessous (copier/coller, email\u2026) ' +
        'ou l\u2019export par fichier.</p>';
    }

    document.getElementById('share-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        statusEl.textContent = 'Lien copié dans le presse-papiers.';
      } catch (_) {
        linkInput.select();
        document.execCommand('copy');
        statusEl.textContent = 'Lien sélectionné \u2014 copiez avec Ctrl+C.';
      }
    };
    document.getElementById('share-close').onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
  }

  /* ---------- payloads ---------- */
  function quizPayload(quiz) {
    return { type: 'quiz', version: 1, id: quiz.id, titre: quiz.titre, questions: quiz.questions };
  }

  function rosterPayload(roster) {
    const eleves = [];
    roster.forEach((e, i) => {
      if (e.nom || e.prenom) eleves.push({ n: i + 1, nom: e.nom, prenom: e.prenom, niveau: e.niveau });
    });
    return { type: 'classe', version: 1, eleves: eleves };
  }

  /* ---------- import à l'ouverture (#import=...) ---------- */
  async function handleIncomingHash() {
    const m = location.hash.match(/^#import=(.+)$/);
    if (!m) return;
    // Nettoyer l'URL tout de suite (évite un ré-import au rechargement).
    history.replaceState(null, '', baseURL());
    let payload;
    try {
      payload = JSON.parse(LZString.decompressFromEncodedURIComponent(m[1]));
    } catch (_) {
      alert('Le lien de partage est invalide ou incomplet.');
      return;
    }
    try {
      if (payload && payload.type === 'quiz') {
        IO.validateQuiz(payload);
        if (confirm('Importer le questionnaire \u00ab ' + payload.titre + ' \u00bb (' +
          payload.questions.length + ' question' + (payload.questions.length > 1 ? 's' : '') + ') ?')) {
          payload.modifie = new Date().toISOString();
          await Storage.saveQuiz(payload);
          App.show('quizzes');
          Editor.renderList();
        }
      } else if (payload && payload.type === 'classe') {
        if (!Array.isArray(payload.eleves) || payload.eleves.length === 0)
          throw new Error('Liste d\u2019\u00e9l\u00e8ves vide.');
        if (confirm('Importer la classe (' + payload.eleves.length +
          ' \u00e9l\u00e8ves) ? Cela remplace la classe actuelle sur cet appareil.')) {
          const roster = Array.from({ length: 40 }, () => ({ nom: '', prenom: '', niveau: '' }));
          payload.eleves.forEach(e => {
            const n = parseInt(e.n, 10);
            if (n >= 1 && n <= 40) roster[n - 1] = { nom: e.nom || '', prenom: e.prenom || '', niveau: e.niveau || '' };
          });
          await Storage.saveRoster(roster);
          App.show('roster');
        }
      } else if (payload && payload.type === 'session') {
        if (!Array.isArray(payload.reponses)) throw new Error('Session invalide.');
        if (confirm('Importer les r\u00e9sultats \u00ab ' + (payload.quizTitre || payload.quizId) + ' \u00bb du ' +
          new Date(payload.date).toLocaleString('fr-FR') + ' ?')) {
          await Storage.saveSession(payload);
          App.show('results');
          Results.render(payload.id);
        }
      } else {
        throw new Error('Type de contenu inconnu.');
      }
    } catch (e) {
      alert('Import impossible : ' + e.message);
    }
  }

  return { open, quizPayload, rosterPayload, handleIncomingHash };
})();
