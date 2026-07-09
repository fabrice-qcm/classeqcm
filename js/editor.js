/* editor.js — mode Éditeur : liste des questionnaires + édition d'un questionnaire. */

const Editor = (() => {
  const LETTERS = ['A', 'B', 'C', 'D'];
  let current = null; // questionnaire en cours d'édition (objet en mémoire)

  /* ---------- liste des questionnaires ---------- */

  async function renderList() {
    const listEl = document.getElementById('quiz-list');
    const emptyEl = document.getElementById('quiz-empty');
    const quizzes = await Storage.listQuizzes();
    quizzes.sort((a, b) => (b.modifie || '').localeCompare(a.modifie || ''));
    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', quizzes.length > 0);

    quizzes.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      const date = q.modifie ? new Date(q.modifie).toLocaleDateString('fr-FR') : '';
      card.innerHTML =
        '<div><div class="quiz-card-title"></div>' +
        '<div class="quiz-card-meta">' + q.questions.length + ' question' +
        (q.questions.length > 1 ? 's' : '') + (date ? ' · modifié le ' + date : '') + '</div></div>' +
        '<div class="quiz-card-actions">' +
        '<button class="btn small ghost" data-act="edit">Modifier</button>' +
        '<button class="btn small ghost" data-act="share">Partager</button>' +
        '<button class="btn small ghost" data-act="export">Exporter</button>' +
        '<button class="btn small danger" data-act="delete">Supprimer</button></div>';
      card.querySelector('.quiz-card-title').textContent = q.titre;
      card.querySelector('[data-act=edit]').onclick = () => openEditor(q.id);
      card.querySelector('[data-act=export]').onclick = () => exportQuiz(q);
      card.querySelector('[data-act=share]').onclick = () =>
        Share.open(Share.quizPayload(q), q.titre);
      card.querySelector('[data-act=delete]').onclick = async () => {
        if (confirm('Supprimer « ' + q.titre + ' » ? Cette action est définitive.')) {
          await Storage.deleteQuiz(q.id);
          renderList();
        }
      };
      listEl.appendChild(card);
    });
  }

  /* ---------- édition ---------- */

  function newQuiz() {
    return {
      type: 'quiz', version: 1,
      id: 'quiz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      titre: '',
      questions: [newQuestion()],
      modifie: new Date().toISOString()
    };
  }

  function newQuestion() {
    return { texte: '', choix: ['', ''], bonneReponse: 'A' };
  }

  async function openEditor(id) {
    current = id ? await Storage.getQuiz(id) : newQuiz();
    if (!current) { alert('Questionnaire introuvable.'); return; }
    document.getElementById('quiz-title').value = current.titre;
    renderQuestions();
    setStatus('');
    App.show('editor');
  }

  function renderQuestions() {
    const wrap = document.getElementById('question-list');
    wrap.innerHTML = '';
    current.questions.forEach((q, qi) => wrap.appendChild(questionBlock(q, qi)));
  }

  function questionBlock(q, qi) {
    const block = document.createElement('div');
    block.className = 'q-block';

    const head = document.createElement('div');
    head.className = 'q-head';
    head.innerHTML = '<span class="q-num">Question ' + (qi + 1) + '</span>';
    const del = document.createElement('button');
    del.className = 'btn small danger';
    del.textContent = 'Supprimer la question';
    del.onclick = () => {
      if (current.questions.length === 1) {
        setStatus('Un questionnaire doit garder au moins une question.', true);
        return;
      }
      current.questions.splice(qi, 1);
      renderQuestions();
    };
    head.appendChild(del);
    block.appendChild(head);

    const text = document.createElement('input');
    text.type = 'text';
    text.placeholder = 'Énoncé de la question';
    text.value = q.texte;
    text.oninput = () => { q.texte = text.value; };
    block.appendChild(text);

    const choices = document.createElement('div');
    choices.className = 'choices';
    q.choix.forEach((c, ci) => choices.appendChild(choiceRow(q, ci)));
    block.appendChild(choices);

    const foot = document.createElement('div');
    foot.className = 'q-foot';
    const hint = document.createElement('span');
    hint.className = 'q-hint';
    hint.textContent = 'Touchez la lettre verte pour marquer la bonne réponse.';
    foot.appendChild(hint);
    if (q.choix.length < 4) {
      const add = document.createElement('button');
      add.className = 'btn small ghost';
      add.textContent = '+ Ajouter un choix';
      add.onclick = () => { q.choix.push(''); renderQuestions(); };
      foot.appendChild(add);
    }
    block.appendChild(foot);
    return block;
  }

  function choiceRow(q, ci) {
    const row = document.createElement('div');
    row.className = 'choice-row';

    const letter = document.createElement('button');
    letter.className = 'choice-letter';
    letter.textContent = LETTERS[ci];
    letter.setAttribute('aria-pressed', q.bonneReponse === LETTERS[ci] ? 'true' : 'false');
    letter.title = 'Marquer ' + LETTERS[ci] + ' comme bonne réponse';
    letter.onclick = () => { q.bonneReponse = LETTERS[ci]; renderQuestions(); };
    row.appendChild(letter);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Choix ' + LETTERS[ci];
    input.value = q.choix[ci];
    input.oninput = () => { q.choix[ci] = input.value; };
    row.appendChild(input);

    if (q.choix.length > 2) {
      const rm = document.createElement('button');
      rm.className = 'choice-remove';
      rm.textContent = '\u00d7';
      rm.title = 'Retirer ce choix';
      rm.onclick = () => {
        q.choix.splice(ci, 1);
        if (!LETTERS.slice(0, q.choix.length).includes(q.bonneReponse)) q.bonneReponse = 'A';
        renderQuestions();
      };
      row.appendChild(rm);
    }
    return row;
  }

  /* ---------- validation + enregistrement ---------- */

  function validateCurrent() {
    current.titre = document.getElementById('quiz-title').value.trim();
    if (!current.titre) return 'Donnez un titre au questionnaire.';
    for (let i = 0; i < current.questions.length; i++) {
      const q = current.questions[i];
      if (!q.texte.trim()) return 'Question ' + (i + 1) + ' : l\u2019énoncé est vide.';
      for (let c = 0; c < q.choix.length; c++) {
        if (!q.choix[c].trim()) return 'Question ' + (i + 1) + ' : le choix ' + LETTERS[c] + ' est vide.';
      }
    }
    return null;
  }

  async function saveCurrent() {
    const problem = validateCurrent();
    if (problem) { setStatus(problem, true); return false; }
    current.questions = current.questions.map((q, i) => ({
      num: i + 1, texte: q.texte.trim(),
      choix: q.choix.map(c => c.trim()),
      bonneReponse: q.bonneReponse
    }));
    current.modifie = new Date().toISOString();
    await Storage.saveQuiz(current);
    setStatus('Questionnaire enregistré.');
    renderQuestions();
    return true;
  }

  function exportQuiz(quiz) {
    IO.download('questionnaire-' + IO.slug(quiz.titre) + '.json',
      JSON.stringify(quiz, null, 2), 'application/json');
  }

  async function importQuizFile(file) {
    try {
      const obj = IO.validateQuiz(JSON.parse(await IO.readFile(file)));
      obj.id = obj.id || ('quiz-' + Date.now().toString(36));
      obj.modifie = new Date().toISOString();
      await Storage.saveQuiz(obj);
      renderList();
    } catch (e) {
      alert('Import impossible : ' + e.message);
    }
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('editor-status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  /* ---------- branchement des boutons ---------- */

  function init() {
    document.getElementById('btn-new-quiz').onclick = () => openEditor(null);
    document.getElementById('btn-add-question').onclick = () => {
      current.questions.push(newQuestion());
      renderQuestions();
    };
    document.getElementById('btn-back-quizzes').onclick = () => { App.show('quizzes'); renderList(); };
    document.getElementById('btn-save-quiz').onclick = saveCurrent;
    document.getElementById('btn-export-quiz').onclick = async () => {
      if (await saveCurrent()) exportQuiz(current);
    };
    const fileInput = document.getElementById('file-import-quiz');
    document.getElementById('btn-import-quiz').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      if (fileInput.files[0]) importQuizFile(fileInput.files[0]);
      fileInput.value = '';
    };
  }

  return { init, renderList };
})();
