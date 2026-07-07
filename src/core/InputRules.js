/**
 * InputRules / PasteRules — the engine behind in-place auto-formatting.
 *
 * An input rule is `{ find: RegExp, replace?: string|fn, handler?: fn }`. On each
 * text input the text in the caret's text node up to the caret is tested against
 * `find`; the rule fires only when the match ends exactly at the caret (i.e. on
 * the just-typed tail). `replace` swaps the matched text; `handler({editor,match,
 * range})` does custom DOM surgery (e.g. wrap in a mark).
 *
 * Paste rules are `{ find: RegExp(global), replace: (…)=>htmlString }` applied to
 * the text nodes of pasted (already-sanitized) HTML — e.g. linkify bare URLs.
 */

/** Run input rules against the caret. Returns true if a rule fired. */
export function runInputRules(editor, rules) {
  if (!rules || rules.length === 0) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !editor.content.contains(node)) return false;
  // Code content stays literal — same guard MarkdownShortcuts applies to PRE
  // blocks, and paste rules apply via their a/code/pre skip.
  if (node.parentElement?.closest('pre, code')) return false;

  const caret = range.startOffset;
  const before = node.textContent.slice(0, caret);

  for (const rule of rules) {
    rule.find.lastIndex = 0;
    const m = rule.find.exec(before);
    if (!m) continue;
    const end = m.index + m[0].length;
    if (end !== caret) continue;                 // only fire on the just-typed tail

    const matchRange = document.createRange();
    matchRange.setStart(node, m.index);
    matchRange.setEnd(node, end);

    editor.history.saveNow();
    if (typeof rule.handler === 'function') {
      rule.handler({ editor, match: m, range: matchRange });
    } else {
      const rep = typeof rule.replace === 'function' ? rule.replace(m) : rule.replace;
      matchRange.deleteContents();
      const tn = document.createTextNode(rep);
      matchRange.insertNode(tn);
      const after = document.createRange();
      after.setStartAfter(tn);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    editor._notifyChange();
    return true;
  }
  return false;
}

function _escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Apply paste rules to a sanitized HTML string; returns transformed HTML. */
export function runPasteRules(html, rules) {
  if (!rules || rules.length === 0) return html;
  const div = document.createElement('div');
  div.innerHTML = html;

  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const tn of nodes) {
    if (tn.parentElement?.closest('a, code, pre')) continue;   // don't rewrite links/code
    const base = _escapeText(tn.textContent);
    let out = base;
    for (const rule of rules) {
      const flags = rule.find.flags.includes('g') ? rule.find.flags : rule.find.flags + 'g';
      const re = new RegExp(rule.find.source, flags);
      out = out.replace(re, (...args) => rule.replace(...args));
    }
    if (out !== base) {
      const span = document.createElement('span');
      span.innerHTML = out;
      tn.replaceWith(...span.childNodes);
    }
  }
  return div.innerHTML;
}
