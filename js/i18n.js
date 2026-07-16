/* i18n.js — internationalisation légère, sans dépendance.
   - Dictionnaires fr / en / es ci-dessous.
   - t('clef', {var: valeur}) renvoie la chaîne traduite, avec interpolation {var}.
   - plural(n, 'clef') choisit singulier/pluriel selon la langue active.
   - apply() parcourt le DOM et remplit tout élément portant data-i18n / data-i18n-placeholder / data-i18n-title.
   Les phases 1 et 2 couvrent : navigation, en-têtes de vues, boutons, textes d'aide,
   messages de statut et d'erreur. Les contenus dynamiques des vues Résultats/Éditeur
   et les exports seront ajoutés aux phases suivantes. */

const I18n = (() => {

  const LANGS = ['fr', 'en', 'es'];
  const STORE_KEY = 'classeqcm.lang';

  const DICT = {
    /* ============================ FRANÇAIS ============================ */
    fr: {
      'app.title': 'ClasseQCM — sondages par cartes-réponses',

      // Navigation (rail)
      'nav.aria': 'Navigation principale',
      'nav.group.prepare': 'Préparer',
      'nav.group.run': 'Faire passer',
      'nav.group.analyze': 'Analyser',
      'nav.quizzes': 'Questionnaires',
      'nav.roster': 'Classe',
      'nav.cards': 'Cartes',
      'nav.scan': 'Scan',
      'nav.projection': 'Projection',
      'nav.results': 'Résultats',
      'lang.label': 'Langue',

      // Vue Questionnaires
      'quizzes.title': 'Questionnaires',
      'quizzes.importUrl': 'Importer depuis un lien…',
      'quizzes.importFile': 'Importer un fichier…',
      'quizzes.new': 'Nouveau questionnaire',
      'quizzes.empty': 'Aucun questionnaire pour l\u2019instant. Créez le premier avec « Nouveau questionnaire ».',

      // Vue Éditeur
      'editor.back': '\u2190 Retour',
      'editor.exportJson': 'Exporter en JSON',
      'editor.save': 'Enregistrer',
      'editor.titleLabel': 'Titre du questionnaire',
      'editor.titlePlaceholder': 'Ex. : Fractions — évaluation 3',
      'editor.mathHint': 'Écritures mathématiques : placez la formule entre deux symboles dollar — $\\frac{3}{4}$ pour une fraction empilée, $5^2$ pour une puissance, $\\sqrt{16}$ pour une racine. Un aperçu s\u2019affiche sous le champ dès qu\u2019un $ est saisi.',
      'editor.addQuestion': '+ Ajouter une question',

      // Vue Classe
      'roster.title': 'Classe',
      'roster.reset': 'Réinitialiser',
      'roster.share': 'Partager…',
      'roster.import': 'Importer CSV…',
      'roster.export': 'Exporter CSV',
      'roster.save': 'Enregistrer la classe',
      'roster.hint': 'Chaque élève reçoit une carte numérotée. Le numéro imprimé sur la carte correspond à la ligne ci-dessous. Les fichiers de scan ne contiennent que les numéros, jamais les noms. Fichier CSV attendu (créé avec Excel) : colonnes numéro ; nom ; prénom ; niveau, avec une ligne d\u2019en-tête.',

      // Vue Cartes
      'cards.title': 'Cartes-réponses',
      'cards.generate': 'Générer le PDF (40 cartes)',
      'cards.hint': 'Une carte A5 par élève, avec un marqueur unique de 12 cm. L\u2019élève tient sa carte avec la lettre de sa réponse (A, B, C ou D) vers le haut. Conseils d\u2019impression : encre bien noire, qualité normale ou supérieure, pas de plastification brillante (les reflets empêchent la détection) — préférer une plastification mate ou du papier épais (160 g ou plus).',
      'cards.namesLabel': 'Imprimer aussi le prénom et le nom de l\u2019élève sur sa carte (sinon, seulement le numéro)',

      // Vue Scan — préparation
      'scan.title': 'Scan',
      'scan.setupHint': 'Sur le téléphone : importez d\u2019abord le questionnaire (section Questionnaires → Importer) et, si vous voulez le compteur exact, la classe (section Classe → Importer CSV). Puis lancez la session ici.',
      'scan.quizLabel': 'Questionnaire à faire passer',
      'scan.calibrate': 'Calibrage (A, B, C, D)',
      'scan.start': 'Démarrer la session',
      'scan.savedSessions': 'Sessions enregistrées',
      // Vue Scan — session en cours
      'scan.reveal': 'Corriger',
      'scan.next': 'Suivante \u2192',
      'scan.codePlaceholder': 'Code projection',
      'scan.scanQr': 'Scanner le QR',
      'scan.project': 'Projeter',
      'scan.restartCam': 'Relancer la caméra',
      'scan.zoom': 'Zoom',
      'scan.liveHint': 'Balayez lentement la classe. Vert = réponse enregistrée. Touchez une pastille pour corriger ou saisir à la main (rattrapage).',
      'scan.projectHere': 'Projeter sur cet écran',
      'scan.endSession': 'Terminer la session',
      // Scan — projection locale
      'scan.lp.prev': '\u2190 Précédente',
      'scan.lp.reveal': 'Corriger',
      'scan.lp.next': 'Suivante \u2192',
      'scan.lp.close': 'Fermer la projection',
      // Scan — modale de saisie
      'scan.modal.clear': 'Effacer la réponse',
      'scan.modal.cancel': 'Annuler',
      // Scan — messages de statut
      'scan.status.qrAim': 'Visez le QR affiché sur l\u2019ordinateur…',
      'scan.status.qrNoSession': 'Démarrez d\u2019abord une session de scan.',
      'scan.status.camError': 'Caméra inaccessible : {msg}. Vérifiez l\u2019autorisation caméra et que la page est en HTTPS.',
      'scan.status.camInterrupted': 'Caméra interrompue par le système — touchez « Relancer la caméra ».',
      'scan.status.quizNotFound': 'Le questionnaire de cette session est introuvable sur cet appareil : {title}',
      'scan.nextQuestion': 'Question suivante \u2192',
      'scan.questionNum': 'Question {num} / {total}',
      'scan.card': 'Carte {id}',
      'scan.questionCount': '{title} ({n} q.)',

      // Vue Projection
      'proj.title': 'Projection',
      'proj.fullscreen': 'Plein écran',
      'proj.open': 'Ouvrir la projection',
      'proj.hint': 'Sur le PC relié au vidéoprojecteur : cliquez « Ouvrir la projection », un code s\u2019affiche. Sur le téléphone, en session de scan, entrez ce code (champ « Projeter »). La question et la liste des élèves (gris = pas encore répondu, bleu = a répondu) se mettent à jour en direct. Internet est nécessaire au moment de la connexion ; ensuite les données passent directement entre les deux appareils.',
      'proj.codeLabel': 'Code de session',
      'proj.endSession': 'Terminer la session',
      // Projection — statuts
      'proj.status.directory': 'Connexion au service d\u2019annuaire…',
      'proj.status.waiting': 'En attente que la projection soit ouverte sur l\u2019ordinateur… Internet requis (wifi ou 4G/5G)',

      // Vue Résultats
      'results.title': 'Résultats',
      'results.createGroup': 'Créer groupe de besoin',
      'results.import': 'Importer des résultats…',
      'results.exportXlsx': 'Exporter Excel',
      'results.exportCsv': 'Exporter CSV',
      'results.exportTxt': 'Exporter TXT',
      'results.sessionLabel': 'Session à analyser',
      'results.empty': 'Aucune session sur cet appareil. Importez le fichier JSON exporté depuis le téléphone (ou ouvrez un lien de partage de résultats).',
      'results.groupTitle': 'Groupe de besoin (50 % ou moins)',
      'results.copyList': 'Copier la liste',
      'results.close': 'Fermer',
      'results.tab.summary': 'Résumé',
      'results.tab.students': 'Participants',
      'results.tab.questions': 'Questions',
      // Résultats — messages
      'results.noSession': 'Aucune session — importez un fichier de résultats',
      'results.importError': 'Import impossible : {msg}',
      'results.noGroup': 'Aucun élève à 50 % ou moins sur cette session.',

      // Partage
      'share.hint': 'Scannez ce QR code avec l\u2019appareil photo du téléphone, ou copiez le lien ci-dessous. Les données sont contenues dans le lien lui-même : rien n\u2019est envoyé sur un serveur.',
      'share.copy': 'Copier le lien',
      'share.close': 'Fermer',
    },

    /* ============================ ENGLISH ============================ */
    en: {
      'app.title': 'ClasseQCM — response-card polling',

      'nav.aria': 'Main navigation',
      'nav.group.prepare': 'Prepare',
      'nav.group.run': 'Run',
      'nav.group.analyze': 'Analyse',
      'nav.quizzes': 'Quizzes',
      'nav.roster': 'Class',
      'nav.cards': 'Cards',
      'nav.scan': 'Scan',
      'nav.projection': 'Projection',
      'nav.results': 'Results',
      'lang.label': 'Language',

      'quizzes.title': 'Quizzes',
      'quizzes.importUrl': 'Import from a link…',
      'quizzes.importFile': 'Import a file…',
      'quizzes.new': 'New quiz',
      'quizzes.empty': 'No quiz yet. Create the first one with \u201CNew quiz\u201D.',

      'editor.back': '\u2190 Back',
      'editor.exportJson': 'Export as JSON',
      'editor.save': 'Save',
      'editor.titleLabel': 'Quiz title',
      'editor.titlePlaceholder': 'e.g. Fractions — test 3',
      'editor.mathHint': 'Mathematical notation: put the formula between two dollar signs — $\\frac{3}{4}$ for a stacked fraction, $5^2$ for a power, $\\sqrt{16}$ for a root. A preview appears below the field as soon as a $ is typed.',
      'editor.addQuestion': '+ Add a question',

      'roster.title': 'Class',
      'roster.reset': 'Reset',
      'roster.share': 'Share…',
      'roster.import': 'Import CSV…',
      'roster.export': 'Export CSV',
      'roster.save': 'Save class',
      'roster.hint': 'Each student gets a numbered card. The number printed on the card matches the row below. Scan files contain only the numbers, never the names. Expected CSV file (created with Excel): columns number ; last name ; first name ; level, with a header row.',

      'cards.title': 'Response cards',
      'cards.generate': 'Generate PDF (40 cards)',
      'cards.hint': 'One A5 card per student, with a unique 12 cm marker. The student holds their card with the letter of their answer (A, B, C or D) facing up. Printing tips: solid black ink, normal quality or higher, no glossy lamination (reflections prevent detection) — prefer matte lamination or thick paper (160 gsm or more).',
      'cards.namesLabel': 'Also print the student\u2019s first and last name on their card (otherwise, only the number)',

      'scan.title': 'Scan',
      'scan.setupHint': 'On the phone: first import the quiz (Quizzes section → Import) and, if you want an exact counter, the class (Class section → Import CSV). Then start the session here.',
      'scan.quizLabel': 'Quiz to run',
      'scan.calibrate': 'Calibration (A, B, C, D)',
      'scan.start': 'Start session',
      'scan.savedSessions': 'Saved sessions',
      'scan.reveal': 'Reveal answer',
      'scan.next': 'Next \u2192',
      'scan.codePlaceholder': 'Projection code',
      'scan.scanQr': 'Scan QR',
      'scan.project': 'Project',
      'scan.restartCam': 'Restart camera',
      'scan.zoom': 'Zoom',
      'scan.liveHint': 'Sweep slowly across the class. Green = answer recorded. Tap a chip to correct or enter it by hand (catch-up).',
      'scan.projectHere': 'Project on this screen',
      'scan.endSession': 'End session',
      'scan.lp.prev': '\u2190 Previous',
      'scan.lp.reveal': 'Reveal answer',
      'scan.lp.next': 'Next \u2192',
      'scan.lp.close': 'Close projection',
      'scan.modal.clear': 'Clear answer',
      'scan.modal.cancel': 'Cancel',
      'scan.status.qrAim': 'Point at the QR shown on the computer…',
      'scan.status.qrNoSession': 'Start a scan session first.',
      'scan.status.camError': 'Camera unavailable: {msg}. Check camera permission and that the page is served over HTTPS.',
      'scan.status.camInterrupted': 'Camera interrupted by the system — tap \u201CRestart camera\u201D.',
      'scan.status.quizNotFound': 'The quiz for this session cannot be found on this device: {title}',
      'scan.nextQuestion': 'Next question \u2192',
      'scan.questionNum': 'Question {num} / {total}',
      'scan.card': 'Card {id}',
      'scan.questionCount': '{title} ({n} q.)',

      'proj.title': 'Projection',
      'proj.fullscreen': 'Fullscreen',
      'proj.open': 'Open projection',
      'proj.hint': 'On the computer connected to the projector: click \u201COpen projection\u201D, a code appears. On the phone, during a scan session, enter this code (\u201CProject\u201D field). The question and the student list (grey = not answered yet, blue = answered) update live. Internet is required at connection time; afterwards the data flows directly between the two devices.',
      'proj.codeLabel': 'Session code',
      'proj.endSession': 'End session',
      'proj.status.directory': 'Connecting to the directory service…',
      'proj.status.waiting': 'Waiting for the projection to be opened on the computer… Internet required (wifi or 4G/5G)',

      'results.title': 'Results',
      'results.createGroup': 'Create support group',
      'results.import': 'Import results…',
      'results.exportXlsx': 'Export Excel',
      'results.exportCsv': 'Export CSV',
      'results.exportTxt': 'Export TXT',
      'results.sessionLabel': 'Session to analyse',
      'results.empty': 'No session on this device. Import the JSON file exported from the phone (or open a results share link).',
      'results.groupTitle': 'Support group (50% or below)',
      'results.copyList': 'Copy list',
      'results.close': 'Close',
      'results.tab.summary': 'Summary',
      'results.tab.students': 'Participants',
      'results.tab.questions': 'Questions',
      'results.noSession': 'No session — import a results file',
      'results.importError': 'Import failed: {msg}',
      'results.noGroup': 'No student at 50% or below in this session.',

      'share.hint': 'Scan this QR code with the phone\u2019s camera, or copy the link below. The data is contained in the link itself: nothing is sent to a server.',
      'share.copy': 'Copy link',
      'share.close': 'Close',
    },

    /* ============================ ESPAÑOL ============================ */
    es: {
      'app.title': 'ClasseQCM — encuestas con tarjetas de respuesta',

      'nav.aria': 'Navegación principal',
      'nav.group.prepare': 'Preparar',
      'nav.group.run': 'Realizar',
      'nav.group.analyze': 'Analizar',
      'nav.quizzes': 'Cuestionarios',
      'nav.roster': 'Clase',
      'nav.cards': 'Tarjetas',
      'nav.scan': 'Escaneo',
      'nav.projection': 'Proyección',
      'nav.results': 'Resultados',
      'lang.label': 'Idioma',

      'quizzes.title': 'Cuestionarios',
      'quizzes.importUrl': 'Importar desde un enlace…',
      'quizzes.importFile': 'Importar un archivo…',
      'quizzes.new': 'Nuevo cuestionario',
      'quizzes.empty': 'Aún no hay cuestionarios. Cree el primero con «Nuevo cuestionario».',

      'editor.back': '\u2190 Volver',
      'editor.exportJson': 'Exportar en JSON',
      'editor.save': 'Guardar',
      'editor.titleLabel': 'Título del cuestionario',
      'editor.titlePlaceholder': 'Ej.: Fracciones — evaluación 3',
      'editor.mathHint': 'Notación matemática: coloque la fórmula entre dos signos de dólar — $\\frac{3}{4}$ para una fracción apilada, $5^2$ para una potencia, $\\sqrt{16}$ para una raíz. Aparece una vista previa debajo del campo en cuanto se escribe un $.',
      'editor.addQuestion': '+ Añadir una pregunta',

      'roster.title': 'Clase',
      'roster.reset': 'Restablecer',
      'roster.share': 'Compartir…',
      'roster.import': 'Importar CSV…',
      'roster.export': 'Exportar CSV',
      'roster.save': 'Guardar la clase',
      'roster.hint': 'Cada alumno recibe una tarjeta numerada. El número impreso en la tarjeta corresponde a la fila de abajo. Los archivos de escaneo solo contienen los números, nunca los nombres. Archivo CSV esperado (creado con Excel): columnas número ; apellido ; nombre ; nivel, con una fila de encabezado.',

      'cards.title': 'Tarjetas de respuesta',
      'cards.generate': 'Generar el PDF (40 tarjetas)',
      'cards.hint': 'Una tarjeta A5 por alumno, con un marcador único de 12 cm. El alumno sostiene su tarjeta con la letra de su respuesta (A, B, C o D) hacia arriba. Consejos de impresión: tinta bien negra, calidad normal o superior, sin plastificado brillante (los reflejos impiden la detección) — preferir un plastificado mate o papel grueso (160 g o más).',
      'cards.namesLabel': 'Imprimir también el nombre y el apellido del alumno en su tarjeta (si no, solo el número)',

      'scan.title': 'Escaneo',
      'scan.setupHint': 'En el teléfono: importe primero el cuestionario (sección Cuestionarios → Importar) y, si desea el contador exacto, la clase (sección Clase → Importar CSV). Luego inicie la sesión aquí.',
      'scan.quizLabel': 'Cuestionario a realizar',
      'scan.calibrate': 'Calibración (A, B, C, D)',
      'scan.start': 'Iniciar la sesión',
      'scan.savedSessions': 'Sesiones guardadas',
      'scan.reveal': 'Corregir',
      'scan.next': 'Siguiente \u2192',
      'scan.codePlaceholder': 'Código de proyección',
      'scan.scanQr': 'Escanear el QR',
      'scan.project': 'Proyectar',
      'scan.restartCam': 'Reiniciar la cámara',
      'scan.zoom': 'Zoom',
      'scan.liveHint': 'Recorra lentamente la clase. Verde = respuesta registrada. Toque una ficha para corregir o introducirla a mano (recuperación).',
      'scan.projectHere': 'Proyectar en esta pantalla',
      'scan.endSession': 'Terminar la sesión',
      'scan.lp.prev': '\u2190 Anterior',
      'scan.lp.reveal': 'Corregir',
      'scan.lp.next': 'Siguiente \u2192',
      'scan.lp.close': 'Cerrar la proyección',
      'scan.modal.clear': 'Borrar la respuesta',
      'scan.modal.cancel': 'Cancelar',
      'scan.status.qrAim': 'Apunte al QR mostrado en el ordenador…',
      'scan.status.qrNoSession': 'Inicie primero una sesión de escaneo.',
      'scan.status.camError': 'Cámara no disponible: {msg}. Compruebe el permiso de la cámara y que la página esté en HTTPS.',
      'scan.status.camInterrupted': 'Cámara interrumpida por el sistema — toque «Reiniciar la cámara».',
      'scan.status.quizNotFound': 'No se encuentra el cuestionario de esta sesión en este dispositivo: {title}',
      'scan.nextQuestion': 'Pregunta siguiente \u2192',
      'scan.questionNum': 'Pregunta {num} / {total}',
      'scan.card': 'Tarjeta {id}',
      'scan.questionCount': '{title} ({n} preg.)',

      'proj.title': 'Proyección',
      'proj.fullscreen': 'Pantalla completa',
      'proj.open': 'Abrir la proyección',
      'proj.hint': 'En el PC conectado al proyector: haga clic en «Abrir la proyección», aparece un código. En el teléfono, durante una sesión de escaneo, introduzca este código (campo «Proyectar»). La pregunta y la lista de alumnos (gris = aún sin responder, azul = ha respondido) se actualizan en directo. Se necesita Internet en el momento de la conexión; después los datos pasan directamente entre los dos dispositivos.',
      'proj.codeLabel': 'Código de sesión',
      'proj.endSession': 'Terminar la sesión',
      'proj.status.directory': 'Conectando al servicio de directorio…',
      'proj.status.waiting': 'Esperando a que se abra la proyección en el ordenador… Se requiere Internet (wifi o 4G/5G)',

      'results.title': 'Resultados',
      'results.createGroup': 'Crear grupo de apoyo',
      'results.import': 'Importar resultados…',
      'results.exportXlsx': 'Exportar Excel',
      'results.exportCsv': 'Exportar CSV',
      'results.exportTxt': 'Exportar TXT',
      'results.sessionLabel': 'Sesión a analizar',
      'results.empty': 'No hay ninguna sesión en este dispositivo. Importe el archivo JSON exportado desde el teléfono (o abra un enlace de resultados compartidos).',
      'results.groupTitle': 'Grupo de apoyo (50 % o menos)',
      'results.copyList': 'Copiar la lista',
      'results.close': 'Cerrar',
      'results.tab.summary': 'Resumen',
      'results.tab.students': 'Participantes',
      'results.tab.questions': 'Preguntas',
      'results.noSession': 'Ninguna sesión — importe un archivo de resultados',
      'results.importError': 'Importación imposible: {msg}',
      'results.noGroup': 'Ningún alumno con 50 % o menos en esta sesión.',

      'share.hint': 'Escanee este código QR con la cámara del teléfono, o copie el enlace de abajo. Los datos están contenidos en el propio enlace: no se envía nada a ningún servidor.',
      'share.copy': 'Copiar el enlace',
      'share.close': 'Cerrar',
    },
  };

  let lang = 'fr';

  function detectInitial() {
    let stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (_) {}
    if (stored && LANGS.includes(stored)) return stored;
    const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return LANGS.includes(nav) ? nav : 'fr';
  }

  function t(key, vars) {
    const table = DICT[lang] || DICT.fr;
    let s = table[key];
    if (s === undefined) s = DICT.fr[key];      // repli sur le français
    if (s === undefined) return key;            // clef manquante : visible pour débogage
    if (vars) {
      Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  /* Pluriel. L'anglais/français/espagnol partagent la même règle simple (n === 1 → singulier),
     l'anglais mis à part le cas n === 0 qui reste au pluriel dans les trois langues ici. */
  function plural(n, singular, pluralForm) {
    return Math.abs(n) === 1 ? singular : pluralForm;
  }

  /* Applique les traductions à un arbre DOM (par défaut : document entier). */
  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    // Éléments spéciaux hors [data-i18n]
    document.documentElement.setAttribute('lang', lang);
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = t('app.title');
  }

  const listeners = [];
  function onChange(fn) { listeners.push(fn); }

  function setLang(l) {
    if (!LANGS.includes(l)) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (_) {}
    apply(document);
    listeners.forEach(fn => { try { fn(l); } catch (_) {} });
  }

  function init() {
    lang = detectInitial();
    apply(document);
  }

  return {
    init, apply, t, plural, setLang, onChange,
    get: () => lang, langs: () => LANGS.slice(),
  };
})();
