/* storage.js — couche IndexedDB.
   Magasins : quizzes (questionnaires), meta (classe, réglages), sessions (scans). */

const Storage = (() => {
  const DB_NAME = 'classeqcm';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('quizzes')) {
          db.createObjectStore('quizzes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
      t.onerror = () => reject(t.error);
    }));
  }

  function getAll(store) {
    return open().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  function get(store, key) {
    return open().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  return {
    // Questionnaires
    listQuizzes: () => getAll('quizzes'),
    getQuiz: id => get('quizzes', id),
    saveQuiz: quiz => tx('quizzes', 'readwrite', s => s.put(quiz)),
    deleteQuiz: id => tx('quizzes', 'readwrite', s => s.delete(id)),

    // Classe : tableau de 40 objets {nom, prenom, niveau}, index 0 = carte n°1.
    // Migre les anciennes données (simples chaînes de prénoms) si présentes.
    getRoster: () => get('meta', 'roster').then(r => {
      const raw = (r && r.value) || [];
      const out = [];
      for (let i = 0; i < 40; i++) {
        const v = raw[i];
        if (v && typeof v === 'object') {
          out.push({ nom: v.nom || '', prenom: v.prenom || '', niveau: v.niveau || '' });
        } else {
          out.push({ nom: '', prenom: (typeof v === 'string' ? v : ''), niveau: '' });
        }
      }
      return out;
    }),
    saveRoster: names => tx('meta', 'readwrite', s => s.put({ key: 'roster', value: names })),

    // Sessions de scan (phase 3+)
    listSessions: () => getAll('sessions'),
    saveSession: session => tx('sessions', 'readwrite', s => s.put(session)),
    deleteSession: id => tx('sessions', 'readwrite', s => s.delete(id))
  };
})();
