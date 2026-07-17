/* roster.js — liste de classe : 40 lignes {nom, prénom, niveau}, une par carte.
   Import/export CSV compatible Excel (séparateur ; encodage géré, BOM à l'export). */

const Roster = (() => {

  async function render() {
    const grid = document.getElementById('roster-grid');
    const roster = await Storage.getRoster();
    grid.innerHTML = '';
    roster.forEach((eleve, i) => {
      const row = document.createElement('div');
      row.className = 'roster-row';
      row.dataset.index = i;

      const num = document.createElement('span');
      num.className = 'roster-num';
      num.textContent = i + 1;
      row.appendChild(num);

      row.appendChild(makeInput('nom', I18n.t('roster.fieldName'), eleve.nom));
      row.appendChild(makeInput('prenom', I18n.t('roster.fieldFirstName'), eleve.prenom));
      row.appendChild(makeInput('niveau', I18n.t('roster.fieldLevel'), eleve.niveau, 'roster-niveau'));

      grid.appendChild(row);
    });
  }

  function makeInput(field, placeholder, value, extraClass) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value || '';
    input.dataset.field = field;
    if (extraClass) input.className = extraClass;
    return input;
  }

  function readGrid() {
    const roster = [];
    document.querySelectorAll('#roster-grid .roster-row').forEach(row => {
      const get = f => row.querySelector('[data-field=' + f + ']').value.trim();
      roster[Number(row.dataset.index)] = {
        nom: get('nom'), prenom: get('prenom'), niveau: get('niveau')
      };
    });
    for (let i = 0; i < 40; i++) {
      if (!roster[i]) roster[i] = { nom: '', prenom: '', niveau: '' };
    }
    return roster;
  }

  async function save() {
    const roster = readGrid();
    await Storage.saveRoster(roster);
    const filled = roster.filter(e => e.nom || e.prenom).length;
    const word = I18n.plural(filled, I18n.t('roster.studentSingular'), I18n.t('roster.studentPlural'));
    setStatus(I18n.t('roster.saved', { n: filled, word: word }));
    return roster;
  }

  /* ---------- export CSV ----------
     Format : numero;nom;prenom;niveau — avec BOM UTF-8 pour qu'Excel
     affiche correctement les accents à la réouverture. */
  async function exportCSV() {
    const roster = await save(); // enregistre d'abord ce qui est à l'écran
    const lines = ['numero;nom;prenom;niveau'];
    roster.forEach((e, i) => {
      if (e.nom || e.prenom) {
        lines.push([i + 1, clean(e.nom), clean(e.prenom), clean(e.niveau)].join(';'));
      }
    });
    IO.download('classe.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function clean(s) { return String(s || '').replace(/[;\r\n]/g, ' '); }

  /* ---------- import CSV / TXT ----------
     Attend les colonnes : numéro ; nom ; prénom ; niveau (niveau facultatif).
     La ligne d'en-tête est ignorée automatiquement si la 1re cellule
     n'est pas un nombre. Séparateur ; , ou tabulation, détecté. */
  async function importCSVFile(file) {
    try {
      const rows = IO.parseCSV(await IO.readFileSmart(file));
      if (rows.length === 0) throw new Error(I18n.t('roster.importEmptyFile'));

      let start = 0;
      if (!/^\d+$/.test(rows[0][0])) start = 1; // en-tête détecté

      const roster = Array.from({ length: 40 }, () => ({ nom: '', prenom: '', niveau: '' }));
      let ok = 0;
      const problemes = [];

      for (let r = start; r < rows.length; r++) {
        const cells = rows[r];
        const numero = parseInt(cells[0], 10);
        if (isNaN(numero) || numero < 1 || numero > 40) {
          problemes.push(I18n.t('roster.importBadRow', { row: r + 1, value: cells[0] }));
          continue;
        }
        roster[numero - 1] = {
          nom: (cells[1] || '').trim(),
          prenom: (cells[2] || '').trim(),
          niveau: (cells[3] || '').trim()
        };
        ok++;
      }

      if (ok === 0) throw new Error(I18n.t('roster.importNoRow', { details: problemes.join(' ; ') }));

      await Storage.saveRoster(roster);
      await render();
      const word = I18n.plural(ok, I18n.t('roster.studentSingular'), I18n.t('roster.studentPlural'));
      const imported = I18n.plural(ok, I18n.t('roster.importedSingular'), I18n.t('roster.importedPlural'));
      let msg = I18n.t('roster.importOk', { n: ok, word: word, imported: imported });
      if (problemes.length) msg += I18n.t('roster.importIgnored', { details: problemes.join(' ; ') });
      setStatus(msg, problemes.length > 0);
    } catch (e) {
      setStatus(I18n.t('roster.importError', { msg: e.message }), true);
    }
  }

  function setStatus(msg, isWarning) {
    const el = document.getElementById('roster-status');
    el.textContent = msg;
    el.classList.toggle('error', !!isWarning);
  }

  function init() {
    document.getElementById('btn-reset-roster').onclick = async () => {
      if (!confirm(I18n.t('roster.resetConfirm'))) return;
      await Storage.saveRoster(Array.from({ length: 40 }, () => ({ nom: '', prenom: '', niveau: '' })));
      await render();
      setStatus(I18n.t('roster.resetDone'));
    };
    document.getElementById('btn-save-roster').onclick = save;
    document.getElementById('btn-share-roster').onclick = async () => {
      const roster = await save();
      const filled = roster.filter(e => e.nom || e.prenom).length;
      if (filled === 0) { setStatus(I18n.t('roster.nothingToShare'), true); return; }
      Share.open(Share.rosterPayload(roster), I18n.t('roster.shareTitle', { n: filled,
        word: I18n.plural(filled, I18n.t('roster.studentSingular'), I18n.t('roster.studentPlural')) }),
        I18n.t('roster.shareWarning'));
    };
    document.getElementById('btn-export-roster').onclick = exportCSV;
    const fileInput = document.getElementById('file-import-roster');
    document.getElementById('btn-import-roster').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      if (fileInput.files[0]) importCSVFile(fileInput.files[0]);
      fileInput.value = '';
    };
  }

  return { init, render };
})();
