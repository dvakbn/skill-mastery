// DOM helpers, safe markdown-lite renderer and tiny SVG charts (no dependencies).
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v; else if (v === true) el.setAttribute(k, ''); else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid instanceof Node ? kid : document.createTextNode(String(kid))); }
  return el;
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
export function md(src) {
  const out = []; const parts = String(src).split(/```/);
  parts.forEach((part, i) => {
    if (i % 2) { out.push(`<pre><code>${esc(part.replace(/^[a-z]*\n/i, '').replace(/\n$/, ''))}</code></pre>`); return; }
    for (const block of part.split(/\n{2,}/)) {
      const b = block.trim(); if (!b) continue; const lines = b.split('\n');
      if (lines.every(l => /^\s*[-•]\s+/.test(l))) out.push('<ul>' + lines.map(l => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('') + '</ul>');
      else if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) out.push('<ol>' + lines.map(l => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>');
      else if (lines.length > 1 && lines.every(l => l.includes('|'))) { // simple table
        const rows = lines.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        out.push('<div class="tablewrap"><table>' + rows.map((r, ri) => '<tr>' + r.map(c => ri === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table></div>');
      } else out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
    }
  });
  return out.join('');
}
export const mdEl = (src, cls = 'prose') => h('div', { class: cls, html: md(src) });
export const pctText = x => x == null ? '—' : Math.round(x * 100) + '%';
export const fmtDate = k => new Date(k + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateLong = k => new Date(k + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, ...kids) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(k)); return el; }
export function sparkline(values, { w = 120, h: ht = 32, color = 'var(--accent)' } = {}) {
  const pts = values.map((v, i) => v == null ? null : [i, v]).filter(Boolean); const s = svg('svg', { viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, role: 'img', 'aria-label': 'trend' });
  if (pts.length < 2) { s.append(svg('line', { x1: 0, x2: w, y1: ht / 2, y2: ht / 2, stroke: 'var(--line)', 'stroke-dasharray': '3 3' })); return s; }
  const n = values.length - 1; const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${(i / n * (w - 4) + 2).toFixed(1)},${(ht - 3 - v * (ht - 6)).toFixed(1)}`).join('');
  s.append(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); const [li, lv] = pts[pts.length - 1];
  s.append(svg('circle', { cx: li / n * (w - 4) + 2, cy: ht - 3 - lv * (ht - 6), r: 2.5, fill: color })); return s;
}
// Line chart: series [{name,color,points:[{x:label,y:0..1|null}]}]
export function lineChart(series, { w = 640, h: ht = 220, labels = [] } = {}) {
  const pad = { l: 34, r: 10, t: 10, b: 24 }; const s = svg('svg', { viewBox: `0 0 ${w} ${ht}`, class: 'chart', role: 'img' });
  const iw = w - pad.l - pad.r, ih = ht - pad.t - pad.b; const n = Math.max(1, (labels.length || series[0].points.length) - 1);
  for (const g of [0, .25, .5, .75, 1]) { const y = pad.t + ih - g * ih; s.append(svg('line', { x1: pad.l, x2: w - pad.r, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }), svg('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end', class: 'ax' }, Math.round(g * 100))); }
  const step = Math.ceil(labels.length / 6); labels.forEach((l, i) => { if (i % step === 0) s.append(svg('text', { x: pad.l + i / n * iw, y: ht - 6, 'text-anchor': 'middle', class: 'ax' }, l)); });
  for (const se of series) { let d = '', pen = false; se.points.forEach((p, i) => { if (p.y == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${(pad.l + i / n * iw).toFixed(1)},${(pad.t + ih - p.y * ih).toFixed(1)}`; pen = true; });
    s.append(svg('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' })); se.points.forEach((p, i) => { if (p.y != null) s.append(svg('circle', { cx: pad.l + i / n * iw, cy: pad.t + ih - p.y * ih, r: 3.5, fill: se.color }, svg('title', {}, `${se.name} ${p.x}: ${Math.round(p.y * 100)}%`))); }); }
  return s;
}
export function heatmap(counts, days, { cell = 13, gap = 3 } = {}) { // counts: Map day→n ; days: array of day keys oldest→newest (multiple of 7)
  const weeks = days.length / 7; const w = weeks * (cell + gap), ht = 7 * (cell + gap); const s = svg('svg', { viewBox: `0 0 ${w} ${ht}`, class: 'heat', role: 'img', 'aria-label': 'activity heatmap' });
  days.forEach((d, i) => { const n = counts.get(d) || 0; const lvl = n === 0 ? 0 : n < 4 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4;
    s.append(svg('rect', { x: Math.floor(i / 7) * (cell + gap), y: (i % 7) * (cell + gap), width: cell, height: cell, rx: 3, class: 'h' + lvl }, svg('title', {}, `${d}: ${n} activit${n === 1 ? 'y' : 'ies'}`))); });
  return s;
}
export function bar(value, { color = 'var(--accent)', label } = {}) { return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round((value || 0) * 100), 'aria-label': label || '' }, h('i', { style: `width:${Math.round(Math.max(0, Math.min(1, value || 0)) * 100)}%;background:${color}` })); }
export function toast(msg, kind = '') { const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg); document.body.append(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200); }
export function confirmDialog(msg, { ok = 'Continue', cancel = 'Cancel' } = {}) {
  return new Promise(res => { const d = h('dialog', { class: 'dlg' }, h('p', msg), h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => { d.close(); res(false); } }, cancel), h('button', { class: 'btn', onclick: () => { d.close(); res(true); } }, ok))); document.body.append(d); d.addEventListener('close', () => { d.remove(); res(false); }); d.showModal(); });
}
