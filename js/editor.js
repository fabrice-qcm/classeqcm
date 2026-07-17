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
      const date = q.modifie ? new Date(q.modifie).toLocaleDateString(I18n.locale()) : '';
      const qWord = I18n.plural(q.questions.length, I18n.t('editor.questionSingular'), I18n.t('editor.questionPlural'));
      card.innerHTML =
        '<div><div class="quiz-card-title"></div>' +
        '<div class="quiz-card-meta">' + I18n.t('editor.questionCount', { n: q.questions.length, word: qWord }) +
        (date ? I18n.t('editor.modified', { date: date }) : '') + '</div></div>' +
        '<div class="quiz-card-actions">' +
        '<button class="btn small ghost" data-act="edit">' + I18n.t('editor.edit') + '</button>' +
        '<button class="btn small ghost" data-act="flash">' + I18n.t('editor.flashcards') + '</button>' +
        '<button class="btn small ghost" data-act="share">' + I18n.t('editor.share') + '</button>' +
        '<button class="btn small ghost" data-act="export">' + I18n.t('editor.export') + '</button>' +
        '<button class="btn small danger" data-act="delete">' + I18n.t('editor.delete') + '</button></div>';
      card.querySelector('.quiz-card-title').textContent = q.titre;
      card.querySelector('[data-act=edit]').onclick = () => openEditor(q.id);
      card.querySelector('[data-act=export]').onclick = () => exportQuiz(q);
      card.querySelector('[data-act=share]').onclick = () =>
        Share.open(Share.quizPayload(q), q.titre);
      card.querySelector('[data-act=flash]').onclick = () => {
        try { Cards.flashcardsPDF(q); }
        catch (err) { alert(I18n.t('editor.genError', { msg: err.message })); }
      };
      card.querySelector('[data-act=delete]').onclick = async () => {
        if (confirm(I18n.t('editor.deleteConfirm', { title: q.titre }))) {
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
    if (!current) { alert(I18n.t('editor.notFound')); return; }
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
    head.innerHTML = '<span class="q-num">' + I18n.t('editor.questionLabel', { num: qi + 1 }) + '</span>';
    const del = document.createElement('button');
    del.className = 'btn small danger';
    del.textContent = I18n.t('editor.deleteQuestion');
    del.onclick = () => {
      if (current.questions.length === 1) {
        setStatus(I18n.t('editor.minOneQuestion'), true);
        return;
      }
      current.questions.splice(qi, 1);
      renderQuestions();
    };
    head.appendChild(del);
    block.appendChild(head);

    const text = document.createElement('input');
    text.type = 'text';
    text.placeholder = I18n.t('editor.questionPlaceholder');
    text.value = q.texte;
    block.appendChild(text);
    const textPrev = document.createElement('div');
    textPrev.className = 'math-preview hidden';
    block.appendChild(textPrev);
    const updateTextPrev = () => {
      const has = text.value.indexOf('$') !== -1;
      textPrev.classList.toggle('hidden', !has);
      if (has) MathText.render(textPrev, text.value);
    };
    text.oninput = () => { q.texte = text.value; updateTextPrev(); };
    updateTextPrev();

    const choices = document.createElement('div');
    choices.className = 'choices';
    q.choix.forEach((c, ci) => choices.appendChild(choiceRow(q, ci)));
    block.appendChild(choices);

    const foot = document.createElement('div');
    foot.className = 'q-foot';
    const hint = document.createElement('span');
    hint.className = 'q-hint';
    hint.textContent = I18n.t('editor.markCorrect');
    foot.appendChild(hint);
    if (q.choix.length < 4) {
      const add = document.createElement('button');
      add.className = 'btn small ghost';
      add.textContent = I18n.t('editor.addChoice');
      add.onclick = () => { q.choix.push(''); renderQuestions(); };
      foot.appendChild(add);
    }
    block.appendChild(foot);
    return block;
  }

  function choiceRow(q, ci) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'choice-row';
    wrap.appendChild(row);

    const letter = document.createElement('button');
    letter.className = 'choice-letter';
    letter.textContent = LETTERS[ci];
    letter.setAttribute('aria-pressed', q.bonneReponse === LETTERS[ci] ? 'true' : 'false');
    letter.title = I18n.t('editor.markLetterCorrect', { letter: LETTERS[ci] });
    letter.onclick = () => { q.bonneReponse = LETTERS[ci]; renderQuestions(); };
    row.appendChild(letter);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = I18n.t('editor.choicePlaceholder', { letter: LETTERS[ci] });
    input.value = q.choix[ci];
    row.appendChild(input);
    const prev = document.createElement('div');
    prev.className = 'math-preview hidden';
    wrap.appendChild(prev);
    const updatePrev = () => {
      const has = input.value.indexOf('$') !== -1;
      prev.classList.toggle('hidden', !has);
      if (has) MathText.render(prev, input.value);
    };
    input.oninput = () => { q.choix[ci] = input.value; updatePrev(); };
    updatePrev();

    if (q.choix.length > 2) {
      const rm = document.createElement('button');
      rm.className = 'choice-remove';
      rm.textContent = '\u00d7';
      rm.title = I18n.t('editor.removeChoice');
      rm.onclick = () => {
        q.choix.splice(ci, 1);
        if (!LETTERS.slice(0, q.choix.length).includes(q.bonneReponse)) q.bonneReponse = 'A';
        renderQuestions();
      };
      row.appendChild(rm);
    }
    return wrap;
  }

  /* ---------- validation + enregistrement ---------- */

  function validateCurrent() {
    current.titre = document.getElementById('quiz-title').value.trim();
    if (!current.titre) return I18n.t('editor.needTitle');
    for (let i = 0; i < current.questions.length; i++) {
      const q = current.questions[i];
      if (!q.texte.trim()) return I18n.t('editor.emptyQuestion', { num: i + 1 });
      for (let c = 0; c < q.choix.length; c++) {
        if (!q.choix[c].trim()) return I18n.t('editor.emptyChoice', { num: i + 1, letter: LETTERS[c] });
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
    setStatus(I18n.t('editor.saved'));
    renderQuestions();
    return true;
  }

  function exportQuiz(quiz) {
    IO.download('questionnaire-' + IO.slug(quiz.titre) + '.json',
      JSON.stringify(quiz, null, 2), 'application/json');
  }

  async function importQuizText(text) {
    let obj;
    if (text.replace(/^\uFEFF/, '').trimStart().startsWith('{')) {
      obj = IO.validateQuiz(JSON.parse(text));
      obj.id = obj.id || ('quiz-' + Date.now().toString(36));
      obj.modifie = new Date().toISOString();
    } else {
      obj = IO.validateQuiz(IO.csvToQuiz(IO.parseCSV(text)));
    }
    await Storage.saveQuiz(obj);
    renderList();
    return obj;
  }

  /* Liens Google Drive : transformer le lien de partage en lien de téléchargement. */
  function normalizeURL(url) {
    const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (drive) return 'https://drive.google.com/uc?export=download&id=' + drive[1];
    const open = url.match(/drive\.google\.com\/open\?id=([\w-]+)/);
    if (open) return 'https://drive.google.com/uc?export=download&id=' + open[1];
    return url;
  }

  async function importQuizURL() {
    const url = prompt(I18n.t('editor.urlPrompt'));
    if (!url) return;
    try {
      const resp = await fetch(normalizeURL(url.trim()));
      if (!resp.ok) throw new Error('r\u00e9ponse ' + resp.status);
      const obj = await importQuizText(await resp.text());
      alert(I18n.t('editor.urlImported', { title: obj.titre }));
    } catch (err) {
      alert(I18n.t('editor.urlImportError', { msg: err.message }));
    }
  }

  async function importQuizFile(file) {
    try {
      const text = await IO.readFileSmart(file);
      await importQuizText(text);
    } catch (e) {
      alert(I18n.t('editor.fileImportError', { msg: e.message }));
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
    document.getElementById('btn-import-quiz-url').onclick = importQuizURL;
    fileInput.onchange = () => {
      if (fileInput.files[0]) importQuizFile(fileInput.files[0]);
      fileInput.value = '';
    };
  }

  return { init, renderList };
})();
