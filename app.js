const state = { days: 7, cat: 'all' };

const DAY_MS = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // shown Monday first
const WEEKDAY_INDEX = [1, 2, 3, 4, 5, 6, 0];                       // matching Date.getDay()

const dh = (n) => `${Math.round(n).toLocaleString('fr-FR')} DH`;
const num = (n) => Math.round(n).toLocaleString('fr-FR');
const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const $ = (id) => document.getElementById(id);

/* ---------- reading the sales ---------- */
function today() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

// Sales between two dates, keeping only the lines in the chosen category
function salesBetween(from, to) {
  const out = [];
  for (const s of SALES) {
    if (s.date < from || s.date >= to) continue;
    const lines = state.cat === 'all' ? s.lines : s.lines.filter(([id]) => PRODUCT_BY_ID[id].cat === state.cat);
    if (lines.length) out.push({ ...s, lines });
  }
  return out;
}

function totals(sales) {
  let revenue = 0, items = 0;
  for (const s of sales) {
    for (const [id, qty] of s.lines) {
      revenue += qty * PRODUCT_BY_ID[id].price;
      items += qty;
    }
  }
  return { revenue, items, orders: sales.length, basket: sales.length ? revenue / sales.length : 0 };
}

/* ---------- key numbers ---------- */
function delta(el, now, before, hasBefore) {
  if (!hasBefore || !before) {
    el.textContent = 'No earlier period to compare';
    return;
  }
  const pct = ((now - before) / before) * 100;
  const dir = pct >= 0 ? 'up' : 'down';
  const arrow = pct >= 0 ? '▲' : '▼';
  el.innerHTML = `<b class="${dir}">${arrow} ${Math.abs(pct).toFixed(1)}%</b> vs previous ${state.days} days`;
}

function renderKpis(now, before, hasBefore) {
  $('kpi-revenue').textContent = dh(now.revenue);
  $('kpi-orders').textContent = num(now.orders);
  $('kpi-basket').textContent = `${now.basket.toFixed(1).replace('.', ',')} DH`;
  $('kpi-items').textContent = num(now.items);
  delta($('kpi-revenue-delta'), now.revenue, before.revenue, hasBefore);
  delta($('kpi-orders-delta'), now.orders, before.orders, hasBefore);
  delta($('kpi-basket-delta'), now.basket, before.basket, hasBefore);
  delta($('kpi-items-delta'), now.items, before.items, hasBefore);
}

/* ---------- daily sales chart ---------- */
function dailySeries(sales, from) {
  const days = Array.from({ length: state.days }, (_, i) => ({
    date: new Date(from.getTime() + i * DAY_MS), revenue: 0, orders: 0,
  }));
  for (const s of sales) {
    const i = Math.round((s.date - from) / DAY_MS);
    if (!days[i]) continue;
    days[i].orders++;
    for (const [id, qty] of s.lines) days[i].revenue += qty * PRODUCT_BY_ID[id].price;
  }
  return days;
}

function niceMax(v) {
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
}

function renderChart(series) {
  const box = $('chart');
  const W = box.clientWidth, H = box.clientHeight;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const iw = W - pad.left - pad.right, ih = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...series.map((d) => d.revenue), 1));
  const avg = series.reduce((s, d) => s + d.revenue, 0) / series.length;
  const slot = iw / series.length;
  const bw = Math.max(2, slot * (series.length > 40 ? 0.7 : 0.62));
  const y = (v) => pad.top + ih - (v / max) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = series.length <= 7 ? 1 : series.length <= 30 ? 5 : 14;

  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="grid">`;
  for (const t of ticks) {
    svg += `<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(t)}" y2="${y(t)}"/>`;
    svg += `<text x="${pad.left - 8}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`;
  }
  svg += '</g><g class="bars">';
  series.forEach((d, i) => {
    const x = pad.left + i * slot + (slot - bw) / 2;
    const weekend = d.date.getDay() === 0 || d.date.getDay() === 6;
    svg += `<rect class="bar${weekend ? ' is-weekend' : ''}" data-i="${i}" x="${x}" y="${y(d.revenue)}" width="${bw}" height="${Math.max(0, pad.top + ih - y(d.revenue))}" rx="${Math.min(4, bw / 3)}"/>`;
  });
  svg += '</g><g class="axis">';
  series.forEach((d, i) => {
    if (i % labelEvery !== 0 && i !== series.length - 1) return;
    if (i === series.length - 1 && i % labelEvery !== 0 && labelEvery > 1) return;
    const x = pad.left + i * slot + slot / 2;
    const label = series.length <= 7 ? d.date.toLocaleDateString('en-GB', { weekday: 'short' }) : d.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    svg += `<text x="${x}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  });
  svg += `</g><line class="avg" x1="${pad.left}" x2="${W - pad.right}" y1="${y(avg)}" y2="${y(avg)}"/>`;
  svg += `<text class="avg-label" x="${pad.left + 6}" y="${y(avg) - 6}">Average ${dh(avg)}</text></svg>`;
  box.innerHTML = svg;

  const best = series.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  $('chart-note').textContent = `Best day: ${shortDate(best.date)}, ${dh(best.revenue)}`;
  box.setAttribute('aria-label', `Bar chart of daily sales. Average ${dh(avg)} a day. Best day ${shortDate(best.date)} with ${dh(best.revenue)}.`);

  // Tooltip
  const tip = $('tooltip');
  const panel = box.parentElement;
  box.querySelectorAll('.bar').forEach((bar) => {
    bar.addEventListener('mouseenter', () => {
      const d = series[bar.dataset.i];
      const r = bar.getBoundingClientRect(), p = panel.getBoundingClientRect();
      tip.innerHTML = `<b>${dh(d.revenue)}</b>${shortDate(d.date)} · ${d.orders} customers`;
      tip.style.left = `${r.left - p.left + r.width / 2}px`;
      tip.style.top = `${r.top - p.top - 8}px`;
      tip.hidden = false;
    });
    bar.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

/* ---------- busy hours ---------- */
function renderHeatmap(sales) {
  const hours = [];
  for (let h = SHOP.opens; h < SHOP.closes; h++) hours.push(h);

  // average customers per weekday and hour
  const counts = {}, dayCount = {};
  for (let i = 0; i < state.days; i++) {
    const d = new Date(today().getTime() - (state.days - i) * DAY_MS).getDay();
    dayCount[d] = (dayCount[d] || 0) + 1;
  }
  for (const s of sales) {
    const k = `${s.day}-${s.hour}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  const avg = (d, h) => (counts[`${d}-${h}`] || 0) / (dayCount[d] || 1);
  let max = 0, peak = null;
  for (const d of WEEKDAY_INDEX) for (const h of hours) {
    const v = avg(d, h);
    if (v > max) { max = v; peak = { d, h }; }
  }

  let html = '<colgroup><col class="heatmap__days"></colgroup><thead><tr><th></th>' + hours.map((h) => `<th scope="col">${h}</th>`).join('') + '</tr></thead><tbody>';
  WEEKDAY_INDEX.forEach((d, row) => {
    html += `<tr><th scope="row">${WEEKDAYS[row]}</th>`;
    for (const h of hours) {
      const v = avg(d, h);
      const label = `${WEEKDAYS[row]} ${h}:00, about ${v.toFixed(1)} customers`;
      html += `<td style="--v:${max ? (v / max).toFixed(3) : 0}" title="${label}"><span class="sr-only">${label}</span></td>`;
    }
    html += '</tr>';
  });
  $('heatmap').innerHTML = html + '</tbody>';

  $('hours-note').textContent = peak
    ? `Busiest: ${WEEKDAYS[WEEKDAY_INDEX.indexOf(peak.d)]} ${peak.h}:00–${peak.h + 1}:00, about ${max.toFixed(1)} customers an hour`
    : '';
}

/* ---------- best sellers ---------- */
function renderTop(sales) {
  const by = {};
  for (const s of sales) for (const [id, qty] of s.lines) {
    by[id] = by[id] || { units: 0, revenue: 0 };
    by[id].units += qty;
    by[id].revenue += qty * PRODUCT_BY_ID[id].price;
  }
  const rows = Object.entries(by).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
  const top = rows[0] ? rows[0][1].revenue : 1;
  $('top-body').innerHTML = rows.map(([id, r]) => `
    <tr>
      <td>${PRODUCT_BY_ID[id].name}<span class="share" aria-hidden="true"><span style="width:${(r.revenue / top) * 100}%"></span></span></td>
      <td class="num">${num(r.units)}</td>
      <td class="num">${dh(r.revenue)}</td>
    </tr>`).join('') || '<tr><td colspan="3">No sales in this period.</td></tr>';
}

/* ---------- low stock ---------- */
const ORDERED_KEY = 'shop-dashboard:ordered';
function loadOrdered() {
  try { return new Set(JSON.parse(localStorage.getItem(ORDERED_KEY) || '[]')); } catch { return new Set(); }
}
function saveOrdered(set) {
  try { localStorage.setItem(ORDERED_KEY, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}
const ordered = loadOrdered();

function renderStock() {
  // average units sold per day over the last 30 days, for every product
  const from = new Date(today().getTime() - 30 * DAY_MS);
  const units = {};
  for (const s of SALES) {
    if (s.date < from) continue;
    for (const [id, qty] of s.lines) units[id] = (units[id] || 0) + qty;
  }
  const low = PRODUCTS
    .filter((p) => (state.cat === 'all' || p.cat === state.cat) && p.stock <= p.reorder)
    .map((p) => ({ ...p, perDay: (units[p.id] || 0) / 30 }))
    .map((p) => ({ ...p, daysLeft: p.perDay ? p.stock / p.perDay : Infinity }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  $('stock-note').textContent = low.length ? `${low.length} below reorder point` : '';
  if (!low.length) {
    $('stock-list').innerHTML = '<li class="stock__empty">Everything in this category is above its reorder point.</li>';
    return;
  }
  $('stock-list').innerHTML = low.map((p) => {
    const isOrdered = ordered.has(p.id);
    const days = p.daysLeft < 1 ? 'less than a day of sales' : `about ${Math.floor(p.daysLeft)} day${Math.floor(p.daysLeft) === 1 ? '' : 's'} of sales`;
    return `<li class="${isOrdered ? 'is-ordered' : ''}${p.stock === 0 ? ' is-out' : ''}">
      <span class="stock__name">${p.name}</span>
      <span class="stock__meta">${isOrdered ? 'Reorder placed' : `${p.stock} left · ${days}`}</span>
      <button type="button" class="stock__btn" data-id="${p.id}" aria-pressed="${isOrdered}">${isOrdered ? 'Ordered ✓' : 'Mark ordered'}</button>
    </li>`;
  }).join('');
}

$('stock-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.stock__btn');
  if (!btn) return;
  const id = btn.dataset.id;
  ordered.has(id) ? ordered.delete(id) : ordered.add(id);
  saveOrdered(ordered);
  renderStock();
  $('stock-list').querySelector(`[data-id="${id}"]`)?.focus();
});

/* ---------- putting it together ---------- */
function render() {
  const end = today();
  const start = new Date(end.getTime() - state.days * DAY_MS);
  const prevStart = new Date(start.getTime() - state.days * DAY_MS);
  const earliest = SALES[0].date;

  const now = salesBetween(start, end);
  const before = salesBetween(prevStart, start);
  const hasBefore = prevStart >= earliest;

  $('period-label').textContent = `Last ${state.days} days · ${shortDate(start)} to ${shortDate(new Date(end.getTime() - DAY_MS))}${state.cat === 'all' ? '' : ` · ${state.cat}`}`;
  renderKpis(totals(now), totals(before), hasBefore);
  renderChart(dailySeries(now, start));
  renderHeatmap(now);
  renderTop(now);
  renderStock();
}

// Filters
const catSelect = $('category');
catSelect.insertAdjacentHTML('beforeend', CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join(''));
catSelect.addEventListener('change', () => { state.cat = catSelect.value; render(); });

document.querySelectorAll('.segmented button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.segmented button').forEach((b) => b.setAttribute('aria-checked', b === btn));
    state.days = Number(btn.dataset.days);
    render();
  });
});

render();

// Redraw the chart whenever its box changes size (window resize, fonts loading, filters changing panel heights)
let lastSize = '';
let frame;
new ResizeObserver(([entry]) => {
  const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
  if (size === lastSize) return;
  lastSize = size;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
}).observe($('chart'));
