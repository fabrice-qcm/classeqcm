/* app.js — navigation entre les vues et démarrage. */

const App = (() => {
  const VIEWS = ['quizzes', 'editor', 'roster', 'cards', 'scan', 'projection', 'results'];
  let currentView = 'quizzes';

  function show(name) {
    currentView = name;
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
    if (name !== 'projection') Projection.onLeavePC();
    if (name === 'results') Results.render();
  }

  function init() {
    I18n.init();
    const langSel = document.getElementById('lang-select');
    if (langSel) {
      langSel.value = I18n.get();
      langSel.onchange = () => I18n.setLang(langSel.value);
    }
    // Quand la langue change, re-générer les vues rendues en JS pour que leurs
    // libellés dynamiques (options de select, cartes, etc.) suivent aussi.
    I18n.onChange(() => {
      Editor.renderList();
      if (currentView === 'roster') Roster.render();
      if (currentView === 'scan') Scan.renderSetup && Scan.renderSetup();
      if (currentView === 'results') Results.render();
    });
    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => show(t.dataset.view);
    });
    Editor.init();
    Roster.init();
    Cards.init();
    Scan.init();
    Projection.init();
    Results.init();
    show('quizzes');
    Editor.renderList();
    Share.handleIncomingHash();

    // Service worker : uniquement en contexte sécurisé (HTTPS / localhost).
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* non bloquant */ });
    }
  }

  return { show, init, current: () => currentView };
})();

document.addEventListener('DOMContentLoaded', App.init);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Scan.onLeave();
  } else if (App.current() === 'scan') {
    // Retour de veille ou de multitâche : relancer la caméra automatiquement
    // si une session est en cours.
    Scan.onEnter();
  }
});
