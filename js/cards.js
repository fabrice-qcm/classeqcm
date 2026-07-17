/* cards.js — génération du PDF des cartes-réponses.
   Une carte A5 portrait par élève. Marqueur ArUco MIP_36h12, id = numéro d'élève (1-40).
   Convention d'orientation : la lettre EN HAUT de la carte est la réponse choisie.
   Marqueur en position canonique (tel que généré) = réponse A. */

const Cards = (() => {

  // Feuille A4 portrait (210 x 297 mm) ; une carte CARRÉE à découper par page.
  const PAGE_W = 210, PAGE_H = 297;
  const SQ = 190;                     // côté du carré découpé (trait de coupe)
  const SQ_X = (PAGE_W - SQ) / 2;     // marge horizontale (10 mm de chaque côté)
  const SQ_Y = 12;                    // marge haute
  const MARKER_MM = 120;              // côté du marqueur — large bord blanc pour les doigts
  const LETTER_SIZE = 26;             // lettres A-D, plus grosses
  const LETTERS = ['A', 'B', 'C', 'D'];

  let dictionary = null;
  function dict() {
    if (!dictionary) dictionary = new AR.Dictionary('ARUCO_MIP_36h12');
    return dictionary;
  }

  /* Dessine le marqueur id à la position (x, y), côté sizeMM.
     Reproduit exactement la logique de AR.Dictionary.generateSVG :
     grille markSize x markSize dont bordure noire de 1 cellule,
     bit '1' = cellule blanche, parcours ligne par ligne. */
  function drawMarker(pdf, id, x, y, sizeMM) {
    const d = dict();
    const code = d.codeList[id];
    if (!code) throw new Error('ID ' + id + ' hors du dictionnaire.');
    const inner = d.markSize - 2;        // 6 pour MIP_36h12
    const cells = inner + 2;             // 8 avec la bordure noire
    const cell = sizeMM / cells;

    // Fond noir (bordure + cellules à 0), puis cellules blanches par-dessus.
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, sizeMM, sizeMM, 'F');
    pdf.setFillColor(255, 255, 255);
    for (let gy = 0; gy < inner; gy++) {
      for (let gx = 0; gx < inner; gx++) {
        if (code[gy * inner + gx] === '1') {
          // Légère surcote (0.05mm) pour éviter les filets gris entre cellules à l'impression.
          pdf.rect(x + (gx + 1) * cell, y + (gy + 1) * cell, cell + 0.05, cell + 0.05, 'F');
        }
      }
    }
  }

  /* Une carte élève : carré de découpe avec trait de coupe, marqueur centré,
     lettres grosses et gris foncé sur les 4 bords intérieurs, numéro dans les
     4 coins du carré. Les consignes ne figurent que sur la première page. */
  function drawCard(pdf, numero, nomAffiche, withTips) {
    // Trait de coupe : carré en pointillés gris clair.
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineDashPattern([2, 2], 0);
    /*pdf.rect(SQ_X, SQ_Y, SQ, SQ);
    pdf.setLineDashPattern([], 0);*/
	pdf.line(0, 210, 210, 210);

    // Marqueur centré dans le carré : large anneau blanc pour poser les doigts.
    const mx = SQ_X + (SQ - MARKER_MM) / 2;
    const my = SQ_Y + (SQ - MARKER_MM) / 2;
    drawMarker(pdf, numero, mx, my, MARKER_MM);

    const cx = SQ_X + SQ / 2, cy = SQ_Y + SQ / 2;
    const ring = (SQ - MARKER_MM) / 2;          // largeur de l'anneau blanc (35 mm)
    const lg = ring / 2;                        // lettres à mi-anneau

    // Lettres A-D : grosses, gris foncé, chacune lisible quand SON bord est en haut.
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(LETTER_SIZE);
    pdf.setTextColor(130, 130, 130);
    letterAt(pdf, 'A', cx, my - lg + 3, 0);
    letterAt(pdf, 'B', mx + MARKER_MM + lg, cy, 270);
    letterAt(pdf, 'C', cx, my + MARKER_MM + lg + 3, 180);
    letterAt(pdf, 'D', mx - lg, cy, 90);

    // Numéro du marqueur dans les 4 coins du carré (lisible quelle que soit la rotation).
    pdf.setFontSize(18);
    pdf.setTextColor(180, 180, 180);
    const m = 8;
    letterAt(pdf, String(numero), SQ_X + m, SQ_Y + m + 1, 0);
    letterAt(pdf, String(numero), SQ_X + SQ - m, SQ_Y + m + 1, 90);
    letterAt(pdf, String(numero), SQ_X + SQ - m, SQ_Y + SQ - m, 180);
    letterAt(pdf, String(numero), SQ_X + m, SQ_Y + SQ - m, 270);

    // Identification (numéro + éventuellement nom), à l'intérieur du carré
    // pour survivre à la découpe.
    pdf.setFontSize(9);
    pdf.setTextColor(200, 200, 200);
    const label = I18n.t('cards.pdfCardLabel', { num: numero }) + (nomAffiche ? ' \u2014 ' + nomAffiche : '');
    pdf.text(label, cx, SQ_Y + SQ + 1.5, { align: 'center' });

    // Consignes sous le carré : première page uniquement.
    if (withTips) {
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);
      let y = SQ_Y + SQ + 18;
      const width = SQ;
      pdf.text(pdf.splitTextToSize(I18n.t('cards.pdfInstruction'), width), SQ_X, y);
      y += 8;
      pdf.setTextColor(130, 130, 130);
      pdf.setFontSize(8);
      pdf.text(pdf.splitTextToSize(I18n.t('cards.pdfTips'), width), SQ_X, y);
    }
  }

  function letterAt(pdf, txt, x, y, angleDeg) {
    pdf.text(txt, x, y, { align: 'center', angle: angleDeg });
  }

  async function generatePDF(includeNames) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const roster = await Storage.getRoster();

    for (let numero = 1; numero <= 40; numero++) {
      if (numero > 1) pdf.addPage('a4', 'portrait');
      const e = roster[numero - 1] || {};
      const nom = includeNames && (e.prenom || e.nom)
        ? [e.prenom, e.nom].filter(Boolean).join(' ') : '';
      drawCard(pdf, numero, nom, numero === 1);
    }
    pdf.save(I18n.t('cards.file'));
  }

  /* ---------- flashcards A7 (8 par feuille A4, recto questions / verso réponses) ----
     Les colonnes du verso sont inversées pour un alignement correct en impression
     recto-verso avec retournement sur les bords longs. ---- */
  function flashcardsPDF(quiz) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const CW = 105, CH = 74.25, COLS = 2, ROWS = 4, PER = COLS * ROWS;
    const P = t => (typeof MathText !== 'undefined') ? MathText.plain(t) : t;
    const pages = Math.ceil(quiz.questions.length / PER);

    function cutLines() {
      pdf.setDrawColor(190, 190, 190);
      pdf.setLineDashPattern([2, 2], 0);
      pdf.line(CW, 0, CW, 297);
      for (let rw = 1; rw < ROWS; rw++) pdf.line(0, rw * CH, 210, rw * CH);
      pdf.setLineDashPattern([], 0);
    }

    function cell(q, col, row, isAnswer) {
      const x = col * CW, y = row * CH;
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text((isAnswer ? I18n.t('cards.pdfAnswer', { num: q.num }) : I18n.t('cards.pdfQuestion', { num: q.num })), x + 5, y + 7);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', isAnswer ? 'bold' : 'normal');
      const body = isAnswer
        ? P(q.choix['ABCD'.indexOf(q.bonneReponse)] || q.bonneReponse)
        : P(q.texte);
      let size = isAnswer ? 16 : 12;
      pdf.setFontSize(size);
      let lines = pdf.splitTextToSize(body, CW - 16);
      while (lines.length * size * 0.45 > CH - 22 && size > 8) {
        size -= 1; pdf.setFontSize(size);
        lines = pdf.splitTextToSize(body, CW - 16);
      }
      pdf.text(lines, x + CW / 2, y + CH / 2 - (lines.length - 1) * size * 0.2, { align: 'center' });
    }

    for (let pg = 0; pg < pages; pg++) {
      const slice = quiz.questions.slice(pg * PER, pg * PER + PER);
      if (pg > 0) pdf.addPage();
      cutLines();
      slice.forEach((q, i) => cell(q, i % COLS, Math.floor(i / COLS), false));
      pdf.addPage();
      cutLines();
      // Verso : colonnes inversées pour l'impression recto-verso (bords longs)
      slice.forEach((q, i) => cell(q, (COLS - 1) - (i % COLS), Math.floor(i / COLS), true));
    }
    pdf.save(I18n.t('cards.flashFile', { slug: IO.slug(quiz.titre) }));
  }

  function init() {
    document.getElementById('btn-generate-cards').onclick = async () => {
      const btn = document.getElementById('btn-generate-cards');
      const status = document.getElementById('cards-status');
      const includeNames = document.getElementById('cards-names').checked;
      btn.disabled = true;
      status.textContent = I18n.t('cards.generating');
      status.classList.remove('error');
      try {
        await generatePDF(includeNames);
        status.textContent = I18n.t('cards.done', { file: I18n.t('cards.file') });
      } catch (e) {
        status.textContent = I18n.t('cards.error', { msg: e.message });
        status.classList.add('error');
      } finally {
        btn.disabled = false;
      }
    };
  }

  return { init, drawMarker, flashcardsPDF, generatePDF };
})();
