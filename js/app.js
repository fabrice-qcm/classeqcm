/* app.js — navigation entre les vues et démarrage. */

const App = (() => {
  const VIEWS = ['quizzes', 'editor', 'roster', 'cards', 'scan', 'results'];

  function show(name) {
    VIEWS.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    document.querySelectorAll('.tab').forEach(t => {
      // L'éditeur appartient à l'onglet Questionnaires.
      const target = name === 'editor' ? 'quizzes' : name;
      t.classList.toggle('active', t.dataset.view === target);
      t.setAttribute('aria-selected', t.dataset.view === target ? 'true' : 'false');
    });
    if (name === 'roster') Roster.render();
    if (name === 'scan') Scan.onEnter(); else Scan.onLeave();
  }

  function init() {
    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => show(t.dataset.view);
    });
    Editor.init();
    Roster.init();
    Cards.init();
    Scan.init();
    show('quizzes');
    Editor.renderList();

    // Service worker : uniquement en contexte sécurisé (HTTPS / localhost).
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* non bloquant */ });
    }
  }

  return { show, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Scan.onLeave();
});
