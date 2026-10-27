// Typesets the one-line math in the questions ("(x - 1) / (x + 2)", "&radic;(x + 4)",
// "{ x&sup2; (x &le; 0), x - 1 (x > 0) }") with KaTeX, so it reads like the printed paper:
// stacked fractions, real roots and piecewise braces. Anything that fails to convert keeps
// its plain text, so a question is never lost.
(function () {
  const FN = ['arcsin', 'arccos', 'arctan', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'lim', 'ln', 'log'];
  const SYMBOLS = [
    ['→', '\\to '], ['∞', '\\infty '], ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['π', '\\pi '],
    ['θ', '\\theta '], ['∈', '\\in '], ['∉', '\\notin '], ['⇒', '\\Rightarrow '], ['·', '\\cdot '],
    ['×', '\\times '], ['∘', '\\circ '], ['−', '-'], ['…', '\\ldots '], ['∪', '\\cup '], ['∩', '\\cap '],
    ['∅', '\\varnothing '], ['ℝ', '\\mathbb{R} '], ['ℤ', '\\mathbb{Z} '], ['±', '\\pm '], ['°', '^{\\circ}'], ['≈', '\\approx '],
    ['½', '\\tfrac{1}{2}'], ['¼', '\\tfrac{1}{4}'], ['¾', '\\tfrac{3}{4}'], ['α', '\\alpha '], ['β', '\\beta '],
    ['δ', '\\delta '], ['ε', '\\varepsilon '], ['⁻¹', '^{-1}'], ['⁻', '^{-}'], ['⁺', '^{+}'], ['¹', '^{1}'],
    ['²', '^{2}'], ['³', '^{3}'], ['⁴', '^{4}'], ['ⁿ', '^{n}'], ['₁', '_{1}'], ['₂', '_{2}'],
    ['⌊', '\\lfloor '], ['⌋', '\\rfloor '], ['%', '\\%']
  ];
  const WORDS_OK = ['Domain', 'Range', 'and', 'only']; // prose an option may contain and still be typeset
  const PH = '\u0005'; // wraps a placeholder index for an already-converted {...} group

  const decoder = document.createElement('textarea');
  function decode(html) {
    decoder.innerHTML = html;
    return decoder.value;
  }

  function matchFwd(s, i, open, close) {
    for (let d = 0, j = i; j < s.length; j++) {
      if (s[j] === open) d++;
      else if (s[j] === close && --d === 0) return j;
    }
    throw new Error('unbalanced');
  }

  function matchBack(s, i, open, close) {
    for (let d = 0, j = i; j >= 0; j--) {
      if (s[j] === close) d++;
      else if (s[j] === open && --d === 0) return j;
    }
    throw new Error('unbalanced');
  }

  // Start of the operand that ends just before index i (a group, a command, a token, plus anything glued on its left).
  function scanBack(s, i) {
    const c = s[i - 1];
    let j;
    if (c === ')') j = matchBack(s, i - 1, '(', ')');
    else if (c === '}') j = matchBack(s, i - 1, '{', '}');
    else if (c === '|' || c === PH) j = s.lastIndexOf(c, i - 2);
    else {
      j = i;
      while (j > 0 && /[A-Za-z0-9.]/.test(s[j - 1])) j--;
      if (j === i) return i;
      if (s[j - 1] === '\\') {
        j--;
        while (j > 0 && /[0-9.]/.test(s[j - 1])) j--; // 2\pi
      }
    }
    // "cos x / ..." and "sin(5x) / ..." divide the whole function value; "π x / 2" divides πx.
    const fn = s.slice(0, j).match(new RegExp(`(\\\\(${FN.join('|')})\\s*(\\^\\{[^{}]*\\})?|\\\\pi)\\s*$`));
    if (fn) j -= fn[0].length;
    while (j > 0) {
      const p = s[j - 1];
      if (p === '}') j = matchBack(s, j - 1, '{', '}');
      else if (/[0-9.]/.test(p) && s[j] === '\\') { while (j > 0 && /[0-9.]/.test(s[j - 1])) j--; } // 7\sqrt{2}
      else if (p === ']' && /\\sqrt$/.test(s.slice(0, s.lastIndexOf('[', j - 1)))) j = s.lastIndexOf('[', j - 1);
      else if (p === '^' || p === '_') j = scanBack(s, j - 1);
      else if (/[A-Za-z]/.test(p)) {
        while (j > 0 && /[A-Za-z]/.test(s[j - 1])) j--;
        if (s[j - 1] === '\\') j--;
      } else break;
    }
    return j;
  }

  // End of the operand that starts at index i.
  function scanFwd(s, i) {
    const c = s[i];
    let j;
    if (c === '(') j = matchFwd(s, i, '(', ')') + 1;
    else if (c === '{') j = matchFwd(s, i, '{', '}') + 1;
    else if (c === '|' || c === PH) j = s.indexOf(c, i + 1) + 1;
    else if (c === '-') j = scanFwd(s, i + 1);
    else if (c === '\\') {
      j = i + 1;
      while (/[A-Za-z]/.test(s[j] || '')) j++;
      const name = s.slice(i + 1, j);
      if (s[j] === '[') j = matchFwd(s, j, '[', ']') + 1; // \sqrt[3]{...}
      while (s[j] === '{') j = matchFwd(s, j, '{', '}') + 1;
      if (FN.includes(name)) {
        let k = j;
        while (s[k] === ' ') k++;
        if (k < s.length) j = scanFwd(s, k);
      }
    } else {
      j = i;
      while (j < s.length && /[A-Za-z0-9.]/.test(s[j])) j++;
      if (j === i) return i;
      if (s[j] === '(' && /[A-Za-z]$/.test(s.slice(i, j))) j = matchFwd(s, j, '(', ')') + 1;
    }
    while (s[j] === '^' || s[j] === '_') j = scanFwd(s, j + 1);
    return j;
  }

  function unwrap(t) {
    t = t.trim();
    return t[0] === '(' && matchFwd(t, 0, '(', ')') === t.length - 1 ? t.slice(1, -1) : t;
  }

  function splitTop(s) {
    const parts = [];
    let d = 0, from = 0;
    for (let i = 0; i < s.length; i++) {
      if ('([{'.includes(s[i])) d++;
      else if (')]}'.includes(s[i])) d--;
      else if (s[i] === ',' && d === 0) { parts.push(s.slice(from, i)); from = i + 1; }
    }
    parts.push(s.slice(from));
    return parts.map(p => p.trim());
  }

  // s is decoded text with \u0001..\u0002 for <sub> and \u0003..\u0004 for <sup>.
  function convert(s, store) {
    // Literal {...}: piecewise functions become cases, anything else a set.
    let m;
    while ((m = /\{([^{}]*)\}/.exec(s))) {
      const pieces = splitTop(m[1]);
      const isCases = pieces.length > 1 && pieces.every(p => /\([^()]*[<>≤≥][^()]*\)$/.test(p));
      const tex = isCases
        ? '\\begin{cases}' + pieces.map(p => {
            const at = matchBack(p, p.length - 1, '(', ')');
            return convert(p.slice(0, at).trim(), store) + ' & ' + convert(p.slice(at + 1, -1).trim(), store);
          }).join(' \\\\ ') + '\\end{cases}'
        : '\\{' + convert(m[1], store) + '\\}';
      store.push(tex);
      s = s.slice(0, m.index) + PH + (store.length - 1) + PH + s.slice(m.index + m[0].length);
    }

    s = s.replace(/(\d)\u0305/g, '\\overline{$1}').replace(/³\s*√/g, '∛');
    for (const [from, to] of SYMBOLS) s = s.split(from).join(to);
    s = s.replace(/\u0001/g, '_{').replace(/\u0003/g, '^{').replace(/[\u0002\u0004]/g, '}');
    s = s.replace(new RegExp(`(?<![\\\\A-Za-z])(${FN.join('|')})(?![A-Za-z])`, 'g'), '\\$1 ');
    s = s.replace(/(?<![\\A-Za-z])([A-Za-z]{3,}|or|is|if|of|at|on|as|in)(?![A-Za-z])/g, '\\;\\text{$1}\\;');

    // Roots: √(...) and √token.
    let r;
    while ((r = s.search(/[√∛]/)) >= 0) {
      const index = s[r] === '∛' ? '[3]' : '';
      let k = r + 1;
      while (s[k] === ' ') k++;
      const end = scanFwd(s, k);
      if (end === k) throw new Error('empty root');
      s = s.slice(0, r) + `\\sqrt${index}{` + unwrap(s.slice(k, end)) + '}' + s.slice(end);
    }

    // Fractions: a / b with each side a group or a token.
    for (let guard = 0; guard < 60; guard++) {
      const k = s.indexOf('/');
      if (k < 0) break;
      let le = k;
      while (le > 0 && s[le - 1] === ' ') le--;
      let rs = k + 1;
      while (s[rs] === ' ') rs++;
      const ls = scanBack(s, le);
      const re = scanFwd(s, rs);
      if (ls === le || re === rs) throw new Error('loose slash');
      s = s.slice(0, ls) + '\\frac{' + unwrap(s.slice(ls, le)) + '}{' + unwrap(s.slice(rs, re)) + '}' + s.slice(re);
    }

    const bars = s.split('|').length - 1;
    if (bars && bars % 2 === 0) {
      let open = true;
      s = s.replace(/\|/g, () => ((open = !open) ? '\\right|' : '\\left|'));
    }
    return s;
  }

  function toTex(html) {
    let s = html
      .replace(/<sub>/g, '\u0001').replace(/<\/sub>/g, '\u0002')
      .replace(/<sup>/g, '\u0003').replace(/<\/sup>/g, '\u0004')
      .replace(/<\/?(b|strong|i|em)>/g, '');
    if (s.includes('<')) throw new Error('markup');
    const store = [];
    s = convert(decode(s), store);
    while (s.includes(PH)) s = s.replace(new RegExp(`${PH}(\\d+)${PH}`, 'g'), (_, n) => store[n]);
    return s;
  }

  // Answer options and number items only count as math when they carry no prose words.
  function looksMathy(html) {
    const text = decode(html.replace(/<[^>]+>/g, ' '));
    const words = text.match(/[A-Za-z]{3,}/g) || [];
    if (words.some(w => !FN.includes(w) && !WORDS_OK.includes(w))) return false;
    return words.length > 0 || /<su[bp]>/.test(html) || /[\/√∛^²³⁻∞πθ≤≥∪∅ℝ∘\d]/.test(text);
  }

  // A worked solution is one step per line; $...$ marks the math inside a step.
  window.stepsHtml = function (text) {
    const steps = String(text).split('\n').map(s => s.trim()).filter(Boolean)
      .map(s => s.replace(/\$([^$]+)\$/g, "<span class='math'>$1</span>"));
    if (steps.length < 2) return steps.join('');
    return '<ol class="steps">' + steps.map(s => `<li>${s}</li>`).join('') + '</ol>';
  };

  window.mathToTex = toTex;
  window.renderMath = function (root) {
    if (!window.katex) return;
    root.querySelectorAll('.math, .math-auto').forEach(el => {
      if (el.dataset.tex) return;
      const html = el.innerHTML;
      if (el.classList.contains('math-auto') && !looksMathy(html)) return;
      try {
        el.innerHTML = katex.renderToString('\\displaystyle ' + toTex(html), { throwOnError: true });
        el.dataset.tex = '1';
      } catch (e) {
        // Keep the plain version.
      }
    });
  };
})();
