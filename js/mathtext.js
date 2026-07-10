/* mathtext.js — rendu des écritures mathématiques dans les textes.
   Syntaxe : $\frac{3}{4}$ entre deux symboles dollar. Le reste du texte est
   inséré en texte brut (jamais interprété comme du HTML). Si KaTeX n'est pas
   chargé ou si la formule est invalide, le texte source est affiché tel quel. */

const MathText = (() => {

  function render(el, text) {
    el.textContent = '';
    String(text == null ? '' : text).split(/(\$[^$]+\$)/).forEach(part => {
      if (part.length > 2 && part[0] === '$' && part[part.length - 1] === '$'
          && typeof katex !== 'undefined') {
        const span = document.createElement('span');
        try {
          katex.render(part.slice(1, -1), span, { throwOnError: false });
        } catch (_) {
          span.textContent = part;
        }
        el.appendChild(span);
      } else if (part) {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  /* Version texte brut (info-bulles, exports TXT/CSV) : retire les $. */
  function plain(text) {
    return String(text == null ? '' : text).replace(/\$([^$]+)\$/g, '$1');
  }

  return { render, plain };
})();
