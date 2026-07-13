/* cards.js — génération du PDF des cartes-réponses.
   Une carte A5 portrait par élève. Marqueur ArUco MIP_36h12, id = numéro d'élève (1-40).
   Convention d'orientation : la lettre EN HAUT de la carte est la réponse choisie.
   Marqueur en position canonique (tel que généré) = réponse A. */

const Cards = (() => {

  // Dimensions en mm (A5 portrait : 148 x 210)
  const PAGE_W = 148, PAGE_H = 210;
  const MARKER_MM = 120;          // côté du marqueur (bordure noire comprise)
  const LETTER_SIZE = 11;         // taille des lettres A-D en points
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

  /* Une carte élève : marqueur centré, lettres sur les 4 bords
     (chacune lisible quand son bord est en haut), numéro dans les 4 coins. */
  function drawCard(pdf, numero, nomAffiche) {
    const mx = (PAGE_W - MARKER_MM) / 2;
    const my = (PAGE_H - MARKER_MM) / 2;
    drawMarker(pdf, numero, mx, my, MARKER_MM);

    const cx = PAGE_W / 2, cy = PAGE_H / 2;
    const gap = 8; // distance lettre <-> marqueur en mm

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(LETTER_SIZE);
    pdf.setTextColor(60, 60, 60);
    // angle jsPDF : sens antihoraire. Chaque lettre est orientée pour être
    // lisible quand SON bord est en haut de la carte.
    letterAt(pdf, 'A', cx, my - gap, 0);
    letterAt(pdf, 'B', mx + MARKER_MM + gap, cy, 270);
    letterAt(pdf, 'C', cx, my + MARKER_MM + gap + 3, 180);
    letterAt(pdf, 'D', mx - gap, cy, 90);

    // Numéro d'élève dans les 4 coins (lisible quelle que soit la rotation).
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    const m = 7;
    letterAt(pdf, String(numero), m + 2, m + 2, 0);
    letterAt(pdf, String(numero), PAGE_W - m, m + 2, 90);
    letterAt(pdf, String(numero), PAGE_W - m, PAGE_H - m, 180);
    letterAt(pdf, String(numero), m + 2, PAGE_H - m, 270);

    // Identification (numéro + éventuellement nom) en pied de carte.
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const label = 'Carte n\u00b0 ' + numero + (nomAffiche ? ' \u2014 ' + nomAffiche : '');
    pdf.text(label, cx, PAGE_H - 6, { align: 'center' });

    // Consigne de prise en main.
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Tenir la carte par les bords blancs, la lettre de ta r\u00e9ponse vers le haut.',
      cx, my + MARKER_MM + gap + 10, { align: 'center' });
  }

  function letterAt(pdf, txt, x, y, angleDeg) {
    pdf.text(txt, x, y, { align: 'center', angle: angleDeg });
  }

  async function generatePDF(includeNames) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const roster = await Storage.getRoster();

    for (let numero = 1; numero <= 40; numero++) {
      if (numero > 1) pdf.addPage('a5', 'portrait');
      const e = roster[numero - 1] || {};
      const nom = includeNames && (e.prenom || e.nom)
        ? [e.prenom, e.nom].filter(Boolean).join(' ') : '';
      drawCard(pdf, numero, nom);
    }
    pdf.save('cartes-reponses.pdf');
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
      pdf.text((isAnswer ? 'R\u00e9ponse ' : 'Question ') + q.num, x + 5, y + 7);
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
    pdf.save('flashcards-' + IO.slug(quiz.titre) + '.pdf');
  }

  function init() {
    document.getElementById('btn-generate-cards').onclick = async () => {
      const btn = document.getElementById('btn-generate-cards');
      const status = document.getElementById('cards-status');
      const includeNames = document.getElementById('cards-names').checked;
      btn.disabled = true;
      status.textContent = 'G\u00e9n\u00e9ration en cours\u2026';
      status.classList.remove('error');
      try {
        await generatePDF(includeNames);
        status.textContent = 'PDF t\u00e9l\u00e9charg\u00e9 : cartes-reponses.pdf (40 pages A5).';
      } catch (e) {
        status.textContent = 'Erreur : ' + e.message;
        status.classList.add('error');
      } finally {
        btn.disabled = false;
      }
    };
  }

  return { init, drawMarker, flashcardsPDF };
})();
