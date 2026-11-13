'use strict';
/* Car Rental Finder: information only. It never books anything and never asks for a driver's license number,
   card numbers, SSN or passwords. Everything you type stays on this device. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, d = 0) => (n == null || isNaN(n)) ? 'n/a' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (iso) => { if (!iso) return 'n/a'; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtDT = (iso) => { if (!iso) return 'n/a'; return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' }); };
const store = {
  get(k, d) { try { const v = localStorage.getItem('crf-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('crf-' + k, JSON.stringify(v)); } catch (e) {} }
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let DATA = null, STATUS = null;
const LIVE = store.get('live', {});
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
function initials(n) { return n.replace(/\(.*?\)/g, '').replace(/Rent A Car|\.com/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
function ext(url, label, cls = 'btn') { return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`; }
function src(key) { const s = DATA.sources[key]; if (!s) return ''; return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`; }
function countUp(el, to, prefix = '$', dec = 0) {
  const fmt = (v) => prefix + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (!el) return; if (reduced || to == null || isNaN(to)) { el.textContent = (to == null || isNaN(to)) ? 'n/a' : fmt(to); return; }
  const from = Number(el.dataset.v || 0), start = performance.now(), dur = 600; el.dataset.v = to;
  const step = (t) => { const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function setPressed(sel, b) { $$(sel).forEach((x) => x.setAttribute('aria-pressed', x === b)); }
const allSites = () => [...DATA.search, ...DATA.companies, ...DATA.jamaica];
function siteState(id) {
  const l = LIVE[id]; if (l && (!STATUS || !STATUS.checked || l.t > STATUS.checked)) return l;
  const s = STATUS && STATUS.sites && STATUS.sites[id]; if (s) return { state: s.state, t: STATUS.checked };
  return l || { state: 'unknown' };
}
const stateText = { up: 'Website online', blocked: 'Website online (it blocks robot checks)', error: 'Website had an error at the last check', unknown: 'Could not check this website automatically' };
function dot(id) { const s = siteState(id); return `<span class="dot ${s.state}" title="${esc(stateText[s.state] || '')}"></span>`; }
function logo(item) { return `<span class="logo" style="background:${item.color};color:${item.fg || '#fff'}" aria-hidden="true">${esc(initials(item.name))}${dot(item.id)}</span>`; }

/* ---------- places ---------- */
const PICKS = [
  { id: 'DFW', label: 'DFW Airport', sub: 'Dallas/Fort Worth', text: 'DFW', code: 'DFW', kayak: 'DFW', fee: 'dfw' },
  { id: 'DAL', label: 'Love Field', sub: 'Dallas (DAL)', text: 'DAL', code: 'DAL', kayak: 'DAL', fee: 'dal' },
  { id: 'FRISCO', label: 'Frisco', sub: 'Neighborhood offices', text: 'Frisco, TX', code: null, kayak: 'Frisco,TX-c12219', fee: 'frisco', frisco: true },
  { id: 'MBJ', label: 'Montego Bay', sub: 'Jamaica (MBJ)', text: 'MBJ', code: 'MBJ', kayak: 'MBJ', fee: 'jam', jam: true },
  { id: 'KIN', label: 'Kingston', sub: 'Jamaica (KIN)', text: 'KIN', code: 'KIN', kayak: 'KIN', fee: 'jam', jam: true }
];
function resolvePlace(raw) {
  const t = String(raw || '').trim(); if (!t) return null;
  const pk = PICKS.find((p) => p.id.toLowerCase() === t.toLowerCase() || p.text.toLowerCase() === t.toLowerCase() || p.label.toLowerCase() === t.toLowerCase());
  if (pk) return pk;
  if (/^[A-Za-z]{3}$/.test(t)) { const c = t.toUpperCase(); return { id: c, label: c, text: c, code: c, kayak: c, jam: ['MBJ', 'KIN', 'OCJ'].includes(c) }; }
  return { id: t, label: t, text: t, code: null, kayak: null, jam: /jamaica|montego|kingston|negril|ocho rios/i.test(t), frisco: /frisco/i.test(t) };
}

/* ---------- trip state ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function defaultTrip() { const a = new Date(); a.setDate(a.getDate() + 7); const b = new Date(a); b.setDate(b.getDate() + 4); return { pu: 'DFW', same: true, dro: '', d1: isoDay(a), t1: '10:00', d2: isoDay(b), t2: '10:00', age: 58, cls: 'any' }; }
let TRIP = Object.assign(defaultTrip(), store.get('trip', {}));
if (!TRIP.d1 || new Date(TRIP.d1 + 'T23:59') < new Date()) { const d = defaultTrip(); TRIP.d1 = d.d1; TRIP.d2 = d.d2; }
function tripDays(t = TRIP) { const a = new Date(t.d1 + 'T' + t.t1), b = new Date(t.d2 + 'T' + t.t2); const h = (b - a) / 36e5; return h > 0 ? Math.max(1, Math.ceil(h / 24 - 0.0001)) : 0; }
const CLASSES = [['any', 'Any car'], ['small', 'Small / economy'], ['medium', 'Mid-size'], ['large', 'Full-size'], ['suv', 'SUV'], ['van', 'Minivan'], ['luxury', 'Luxury'], ['pickup', 'Pickup truck']];
const KAYAK_CLASS = { small: 'small', suv: 'suv' };   // the only class filters confirmed to work in Kayak links

/* ---------- deep links ---------- */
function mdY(iso) { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; }
function ampm(t) { let [h, m] = t.split(':').map(Number); const s = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return pad(h) + pad(m) + s; }
function hourOnly(t) { return Number(t.split(':')[0]); }
function buildLinks(t) {
  const pu = resolvePlace(t.pu), dr = t.same ? null : resolvePlace(t.dro);
  const dropSame = !dr || dr.text === pu.text;
  const e = encodeURIComponent;
  const [y1, m1, dd1] = t.d1.split('-'), [y2, m2, dd2] = t.d2.split('-');
  const out = {};
  // Kayak: /cars/{place}[/{return}]/{YYYY-MM-DD}-{H}h/{YYYY-MM-DD}-{H}h  (tested)
  if (pu.kayak && (dropSame || dr.kayak)) {
    let u = `https://www.kayak.com/cars/${pu.kayak}${dropSame ? '' : '/' + dr.kayak}/${t.d1}-${hourOnly(t.t1)}h/${t.d2}-${hourOnly(t.t2)}h`;
    if (KAYAK_CLASS[t.cls]) u += '?fs=carclass=' + KAYAK_CLASS[t.cls];
    out.kayak = { url: u, mode: 'pre', note: 'Times are rounded to the hour.' };
  } else out.kayak = { url: 'https://www.kayak.com/cars', mode: 'home', note: 'Kayak links work with airport codes (like DFW) and Frisco. Type your place on the page.' };
  // Expedia group format: carsearch?locn=&loc2=&date1=MM/DD/YYYY&date2=&time1=hhmmAM&time2=  (tested on Hotwire)
  const eg = `locn=${e(pu.text)}${dropSame ? '' : '&loc2=' + e(dr.text)}&date1=${e(mdY(t.d1))}&date2=${e(mdY(t.d2))}&time1=${ampm(t.t1)}&time2=${ampm(t.t2)}`;
  out.hotwire = { url: 'https://www.hotwire.com/carsearch?' + eg, mode: 'pre' };
  out.expedia = { url: 'https://www.expedia.com/carsearch?' + eg, mode: 'pre2', note: 'If your dates don\'t show, enter them on the page.' };
  // Priceline: /drive/search/r/{pickup}/{return}/{YYYYMMDD-HH:MM}/{YYYYMMDD-HH:MM}/list
  out.priceline = { url: `https://www.priceline.com/drive/search/r/${e(pu.text)}/${e((dropSame ? pu : dr).text)}/${y1}${m1}${dd1}-${t.t1}/${y2}${m2}${dd2}-${t.t2}/list`, mode: 'pre2', note: 'If your dates don\'t show, enter them on the page.' };
  // Rentalcars.com: airport codes only (tested), includes driver age
  if (pu.code && (dropSame || dr.code)) {
    const rc = (dropSame ? pu : dr).code; const [h1, mi1] = t.t1.split(':').map(Number), [h2, mi2] = t.t2.split(':').map(Number);
    out.rentalcars = { url: `https://www.rentalcars.com/search-results?locationIata=${pu.code}&dropLocationIata=${rc}&puDay=${+dd1}&puMonth=${+m1}&puYear=${y1}&puHour=${h1}&puMinute=${mi1}&doDay=${+dd2}&doMonth=${+m2}&doYear=${y2}&doHour=${h2}&doMinute=${mi2}&driversAge=${t.age}&ftsType=A&dropFtsType=A`, mode: 'pre', note: 'Includes your driver age.' };
  } else out.rentalcars = { url: 'https://www.rentalcars.com/', mode: 'home', note: 'Rentalcars.com links work with airport codes. Type your place on the page.' };
  // Turo: search?location=&startDate=MM/DD/YYYY&startTime=HH:MM&endDate=&endTime=
  out.turo = pu.jam ? { url: 'https://turo.com/', mode: 'home', note: 'For Jamaica, use the Jamaica companies below.' } : { url: `https://turo.com/us/en/search?location=${e(pu.text)}&startDate=${e(mdY(t.d1))}&startTime=${e(t.t1)}&endDate=${e(mdY(t.d2))}&endTime=${e(t.t2)}`, mode: 'pre2', note: 'If your dates don\'t show, enter them on the page.' };
  out.costco = { url: 'https://www.costcotravel.com/Rental-Cars', mode: 'home', note: 'Costco Travel has no trip links. Sign in and enter your trip.' };
  out.autoslash = { url: 'https://www.autoslash.com/', mode: 'home', note: 'Fill in the free quote form, or track a rental you already booked.' };
  return { pu, dr: dropSame ? null : dr, links: out };
}
const modeText = { pre: '✓ Opens with your trip filled in', pre2: '✓ Trip filled in (double-check it)', home: 'Opens the site\'s search page' };

/* ---------- router ---------- */
const VIEWS = { search: viewSearch, compare: viewCompare, mine: viewMine, calc: viewCalc, tips: viewTips };
function route() {
  const name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'search';
  const fn = VIEWS[name] || viewSearch;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.go === name ? 'page' : 'false'));
  const m = $('#main'); m.innerHTML = '<div class="view"></div>'; fn(m.firstChild);
  window.scrollTo(0, 0);
}
function go(name) { if (location.hash === '#/' + name) route(); else location.hash = '#/' + name; }

/* ---------- Search ---------- */
function pickButtons(which, current) {
  return PICKS.map((p) => `<button type="button" class="pick" data-${which}="${p.id}" aria-pressed="${current && resolvePlace(current) && resolvePlace(current).id === p.id}"><b>${esc(p.label)}</b><small>${esc(p.sub)}</small></button>`).join('');
}
function viewSearch(el) {
  const recent = store.get('recent', []);
  el.innerHTML = `
  <section class="hero">
    <h1>Find the best and cheapest rental car</h1>
    <p class="lead">Pick where and when. One tap opens price searches on the big comparison sites and the rental companies, with your trip already filled in where the site allows it.</p>
    <div class="car" aria-hidden="true">🚙</div>
  </section>
  <form class="card" id="tripForm" autocomplete="off" novalidate>
    <h2 style="margin-top:0">1. Pick-up place</h2>
    <div class="picks" role="group" aria-label="Quick picks for pick-up">${pickButtons('pu', TRIP.pu)}</div>
    <div class="field"><label for="pu">Or type any city or airport</label><input id="pu" list="placeList" value="${esc(TRIP.pu)}" placeholder="Example: DFW, Frisco, TX, Orlando, MCO"></div>
    <datalist id="placeList">${PICKS.map((p) => `<option value="${esc(p.text)}">${esc(p.label + ' · ' + p.sub)}</option>`).join('')}</datalist>
    <label class="cbx"><input type="checkbox" id="same" ${TRIP.same ? 'checked' : ''}> Return the car to the same place</label>
    <div id="dropBox" ${TRIP.same ? 'hidden' : ''}>
      <div class="picks" role="group" aria-label="Quick picks for return">${pickButtons('dro', TRIP.dro)}</div>
      <div class="field"><label for="dro">Return place</label><input id="dro" list="placeList" value="${esc(TRIP.dro)}" placeholder="Example: DAL"></div>
    </div>
    <h2>2. Dates and times</h2>
    <div class="form-grid">
      <div class="field"><label for="d1">Pick-up</label><div class="dt"><input type="date" id="d1" value="${TRIP.d1}"><input type="time" id="t1" value="${TRIP.t1}" step="1800"></div></div>
      <div class="field"><label for="d2">Return</label><div class="dt"><input type="date" id="d2" value="${TRIP.d2}"><input type="time" id="t2" value="${TRIP.t2}" step="1800"></div></div>
    </div>
    <h2>3. Driver and car</h2>
    <div class="form-grid">
      <div class="field"><label for="age">Driver age</label><input type="number" id="age" min="18" max="99" inputmode="numeric" value="${TRIP.age}"></div>
      <div class="field"><label for="cls">Car class</label><select id="cls">${CLASSES.map(([v, l]) => `<option value="${v}" ${TRIP.cls === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="trip" id="tripSum" style="margin-top:8px"></div>
    <button type="submit" class="btn go-btn" id="findBtn">🔎 Find prices</button>
    <p class="small muted" style="margin:8px 0 0">The app only opens the websites. It never books a car or takes payment, and it never asks for your license or card number.</p>
  </form>
  ${recent.length ? `<div class="card"><h3>Recent trips</h3><div class="recent">${recent.map((r, i) => `<button type="button" class="chip" data-recent="${i}">${esc(r.pu)}${r.same ? '' : ' → ' + esc(r.dro)} · ${fmtDate(r.d1)}</button>`).join('')}</div></div>` : ''}
  <div id="results"></div>`;
  const form = $('#tripForm');
  const read = () => { TRIP = { pu: $('#pu').value.trim(), same: $('#same').checked, dro: $('#dro').value.trim(), d1: $('#d1').value, t1: $('#t1').value || '10:00', d2: $('#d2').value, t2: $('#t2').value || '10:00', age: Math.max(18, Math.min(99, parseInt($('#age').value, 10) || 58)), cls: $('#cls').value }; store.set('trip', TRIP); summary(); };
  const summary = () => {
    const days = tripDays(); const pu = resolvePlace(TRIP.pu);
    let warn = '';
    if (!TRIP.pu) warn = '<span class="badge bad">Pick a place</span>';
    else if (!TRIP.d1 || !TRIP.d2 || days === 0) warn = '<span class="badge bad">Return must be after pick-up</span>';
    else if (new Date(TRIP.d1 + 'T' + TRIP.t1) < new Date()) warn = '<span class="badge warn">Pick-up date is in the past</span>';
    $('#tripSum').innerHTML = `<span class="badge ok">${days || 0} rental day${days === 1 ? '' : 's'}</span>${pu ? `<span class="badge">${esc(pu.label)}${TRIP.same ? '' : ' → ' + esc((resolvePlace(TRIP.dro) || {}).label || 'return?')}</span>` : ''}<span class="badge">Age ${TRIP.age}${TRIP.age < 25 ? ' · young-driver fees likely' : ''}</span>${warn}`;
  };
  $$('[data-pu]', el).forEach((b) => b.onclick = () => { $('#pu').value = PICKS.find((p) => p.id === b.dataset.pu).text; setPressed('[data-pu]', b); read(); });
  $$('[data-dro]', el).forEach((b) => b.onclick = () => { $('#dro').value = PICKS.find((p) => p.id === b.dataset.dro).text; setPressed('[data-dro]', b); read(); });
  $('#same').onchange = () => { $('#dropBox').hidden = $('#same').checked; read(); };
  $('#d1').onchange = () => { if ($('#d2').value <= $('#d1').value) { const d = new Date($('#d1').value + 'T12:00'); d.setDate(d.getDate() + 3); $('#d2').value = isoDay(d); } read(); };
  ['pu', 'dro', 't1', 'd2', 't2', 'age', 'cls'].forEach((id) => { $('#' + id).addEventListener('change', read); $('#' + id).addEventListener('input', () => { if (id === 'pu') $$('[data-pu]').forEach((b) => b.setAttribute('aria-pressed', resolvePlace($('#pu').value) && resolvePlace($('#pu').value).id === b.dataset.pu)); }); });
  $$('[data-recent]', el).forEach((b) => b.onclick = () => { const r = recent[+b.dataset.recent]; TRIP = Object.assign(defaultTrip(), r); if (new Date(TRIP.d1 + 'T23:59') < new Date()) { const d = defaultTrip(); TRIP.d1 = d.d1; TRIP.d2 = d.d2; } store.set('trip', TRIP); route(); setTimeout(() => $('#findBtn').click(), 50); });
  form.onsubmit = (ev) => {
    ev.preventDefault(); read();
    if (!TRIP.pu) { toast('Pick a pick-up place first'); $('#pu').focus(); return; }
    if (!TRIP.same && !TRIP.dro) { toast('Pick a return place, or tick "same place"'); $('#dro').focus(); return; }
    if (!tripDays()) { toast('The return must be after the pick-up'); $('#d2').focus(); return; }
    const key = JSON.stringify([TRIP.pu, TRIP.same, TRIP.dro, TRIP.d1, TRIP.d2]);
    store.set('recent', [TRIP, ...store.get('recent', []).filter((r) => JSON.stringify([r.pu, r.same, r.dro, r.d1, r.d2]) !== key)].slice(0, 5));
    showResults();
  };
  summary();
  if (store.get('showRes', false)) showResults(false);
}
function linkCard(item, l, i) {
  return `<div class="lk" style="animation-delay:${Math.min(i, 12) * 50}ms">
    <div class="lk-top">${logo(item)}<div style="min-width:0"><b>${esc(item.name)}</b><br><span class="mode ${l.mode === 'home' ? 'home' : 'pre'}">${modeText[l.mode]}</span></div></div>
    <p>${esc(item.desc || '')}${l.note ? ' ' + esc(l.note) : ''}</p>
    ${ext(l.url, 'Open ' + esc(item.name) + ' ↗', 'btn' + (l.mode === 'home' ? ' ghost' : ''))}
  </div>`;
}
function showResults(scroll = true) {
  if (!$('#results')) return;
  store.set('showRes', true);
  const { pu, dr, links } = buildLinks(TRIP); const days = tripDays();
  const searchCards = DATA.search.map((s, i) => linkCard(s, links[s.id], i)).join('');
  const brandList = [...DATA.companies].sort((a, b) => a.name.localeCompare(b.name));
  const brandCards = brandList.map((c, i) => {
    const fr = pu.frisco && c.frisco;
    const l = fr ? { url: c.frisco, mode: 'home', note: 'Opens its Frisco locations page.' } : { url: c.site, mode: 'home', note: '' };
    return linkCard(Object.assign({}, c, { desc: (c.jdp ? `J.D. Power 2026: ${c.jdp}/1,000. ` : '') + (c.perks.length ? c.perks[0][0] + '.' : '') }), l, i);
  }).join('');
  const jam = (pu.jam || (dr && dr.jam)) ? `<div class="sec-h"><h2>🇯🇲 Jamaica rental companies</h2></div><div class="links">${DATA.jamaica.map((j, i) => linkCard(Object.assign({}, j, { desc: j.note }), { url: j.site, mode: 'home' }, i)).join('')}</div>
    <div class="note">Jamaica: you drive on the <b>left</b>. Visa's rental car collision coverage does <b>not</b> cover Jamaica, so plan on the rental company's collision waiver unless your card confirms coverage in writing. More in <a href="#/tips?jamaica">Save money</a>.</div>` : '';
  const tripTxt = `Car rental: ${pu.label}${dr ? ' to ' + dr.label : ''}, pick up ${fmtDate(TRIP.d1)} ${TRIP.t1}, return ${fmtDate(TRIP.d2)} ${TRIP.t2} (${days} days), driver age ${TRIP.age}, ${CLASSES.find((c) => c[0] === TRIP.cls)[1]}`;
  $('#results').innerHTML = `
  <div class="card good" style="margin-top:14px"><b>Your trip:</b> ${esc(tripTxt)}.
    <div class="row" style="margin-top:8px"><button type="button" class="btn small" id="copyTrip">📋 Copy trip details</button><button type="button" class="btn small ghost" id="toCalc">🎚️ Estimate the total</button><button type="button" class="btn small ghost" id="addQ">📝 Save a price I found</button></div>
    <div class="road" aria-hidden="true"><span class="rc">🚗</span></div></div>
  <div class="sec-h"><h2>Comparison sites: check these first</h2><small class="muted">Green = trip filled in</small></div>
  <div class="links">${searchCards}</div>
  ${jam}
  <div class="sec-h"><h2>Rental companies direct</h2><button type="button" class="btn small ghost" id="chk2">↻ Check websites now</button></div>
  <p class="small muted" style="margin-top:0">These sites don't accept trip links, so each opens its search page. Tap "Copy trip details" above to paste your dates. Dots show whether each website was online at the last check${STATUS ? ' (' + esc(fmtDT(STATUS.checked)) + ')' : ''}.</p>
  <div class="links">${brandCards}</div>`;
  $('#copyTrip').onclick = async () => { try { await navigator.clipboard.writeText(tripTxt); toast('Trip details copied'); } catch (e) { toast('Could not copy on this device'); } };
  $('#toCalc').onclick = () => { CALC.days = Math.min(30, days); store.set('calc', CALC); go('calc'); };
  $('#addQ').onclick = () => { store.set('draft', { days, where: pu.fee || 'other' }); go('mine'); };
  $('#chk2').onclick = () => checkSites().then(() => { if ($('#results')) showResults(false); });
  if (scroll) $('#results').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- live website check (in the browser) ---------- */
async function checkSites() {
  if (!navigator.onLine) { toast('You are offline'); return; }
  toast('Checking websites…'); const t = new Date().toISOString();
  await Promise.all(allSites().map(async (i) => {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 9000);
    try { await fetch(i.site, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal }); LIVE[i.id] = { state: 'up', t }; }
    catch (e) { LIVE[i.id] = { state: 'unknown', t }; }
    clearTimeout(tm);
  }));
  store.set('live', LIVE);
  const up = Object.values(LIVE).filter((x) => x.t === t && x.state === 'up').length;
  toast(`${up} of ${allSites().length} websites answered`);
}

/* ---------- Compare ---------- */
const CS = Object.assign({ sort: 'rated', q: '', f: '' }, store.get('cmp', {}));
function viewCompare(el) {
  const top = [...DATA.companies].sort((a, b) => b.jdp - a.jdp)[0];
  el.innerHTML = `
  <section class="hero">
    <h1>Compare rental companies</h1>
    <p class="lead">Customer satisfaction scores from J.D. Power's 2026 study of airport renters, loyalty programs, member discounts, and the fees that get added at DFW and Love Field. Tap a company to see more.</p>
    <div class="stats">
      <div class="stat"><b>${esc(top.name)}</b><span>Highest J.D. Power score 2026 (${top.jdp})</span></div>
      <div class="stat"><b>${DATA.jdpAvg2026}</b><span>Industry average 2026 (up from ${DATA.jdpAvg2025})</span></div>
      <div class="stat"><b>${DATA.companies.length}</b><span>Rental brands rated</span></div>
    </div>
    <div class="car" aria-hidden="true">🚗</div>
  </section>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">J.D. Power 2026 score</h2><small class="muted">out of 1,000 · chart starts at 600</small></div>
    <div class="chart" id="chart" style="margin-top:10px"></div>
    <p class="small muted" style="margin-bottom:0"><span style="display:inline-block;width:3px;height:12px;background:var(--fg);opacity:.6;vertical-align:middle"></span> thin line = industry average (${DATA.jdpAvg2026}). J.D. Power says small gaps may not be meaningful. Tap a bar to jump to that company.</p></div>
  <div class="card">
    <div class="controls">
      <div class="field"><label for="q">Search companies</label><input id="q" type="search" placeholder="Type a name, like Hertz" value="${esc(CS.q)}"></div>
      <div class="field"><label>Sort</label><div class="seg" role="group" aria-label="Sort">
        <button type="button" data-sort="rated" aria-pressed="${CS.sort === 'rated'}">⭐ Best rated</button>
        <button type="button" data-sort="perks" aria-pressed="${CS.sort === 'perks'}">💲 Most discounts</button>
        <button type="button" data-sort="az" aria-pressed="${CS.sort === 'az'}">A–Z</button></div></div>
    </div>
    <div class="row" style="margin-top:6px">
      <button type="button" class="chip" data-f="" aria-pressed="${CS.f === ''}">All</button>
      <button type="button" class="chip" data-f="aarp" aria-pressed="${CS.f === 'aarp'}">AARP discount</button>
      <button type="button" class="chip" data-f="aaa" aria-pressed="${CS.f === 'aaa'}">AAA discount</button>
      <button type="button" class="chip" data-f="costco" aria-pressed="${CS.f === 'costco'}">Costco Travel perk</button>
      <button type="button" class="chip" data-f="above" aria-pressed="${CS.f === 'above'}">Above average score</button>
    </div>
  </div>
  <div class="sec-h"><h2 id="countLbl">Companies</h2><div class="row"><small class="muted">Websites last checked: ${STATUS ? esc(fmtDT(STATUS.checked)) : 'not yet'}</small><button type="button" class="btn small ghost" id="checkNow">↻ Check websites now</button></div></div>
  <div class="list" id="list"></div>
  <div class="card" id="jam"><h2 style="margin-top:0">🇯🇲 Renting in Jamaica</h2>
    ${DATA.jamaica.map((j) => `<div class="lk-top" style="margin:10px 0">${logo(j)}<div style="flex:1"><b>${esc(j.name)}</b><br><small class="muted">${esc(j.note)} Source: ${src(j.src)}</small></div>${ext(j.site, 'Open ↗', 'btn small')}</div>`).join('')}
    <p class="small muted" style="margin-bottom:0">Avis, Budget, Hertz and others also rent at Montego Bay and Kingston. Use the Search tab with MBJ or KIN to compare them.</p></div>
  <div class="card"><h2 style="margin-top:0">Fees added near home</h2>
    <p class="small muted" style="margin-top:0">Example: a 4-day rental at $50 a day ($200 before fees).</p>
    <table class="fee-table"><thead><tr><th>Pick-up place</th><th>What gets added</th><th>Example total</th></tr></thead><tbody>
    ${DATA.fees.map((f) => `<tr><td><b>${esc(f.place)}</b></td><td>${f.lines.map(esc).join('<br>')}<br><small class="muted">${esc(f.note)}</small></td><td><b>${f.pct == null ? 'See quote' : money(200 * (1 + f.pct / 100) + 4 * f.perDay, 2)}</b></td></tr>`).join('')}
    </tbody></table>
    <p class="small muted" style="margin-bottom:0">Sources: ${src('alamofees')}; ${src('dwu')}; ${src('txtax')}. Each company sets its own recovery fees, so read the price summary before you book.</p></div>
  <div class="card"><h2 style="margin-top:0">Young drivers and extra drivers</h2><ul>
    <li>Drivers under 25 usually pay a daily young-renter fee. Hertz's is $25 a day; AAA members 20 to 24 don't pay it. <small class="muted">${src('aaa')}</small></li>
    <li>Adding a second driver usually costs extra. Hertz charges $15 a day per driver, but extra AAA drivers are free. <small class="muted">${src('aaa')}</small></li>
    <li>AARP members get one additional driver free at Avis, Budget and Payless. <small class="muted">${src('aarp')}; ${src('payless')}</small></li>
    <li>Booking through Costco Travel waives one additional-driver fee at Enterprise, Alamo, Avis and Budget in the U.S. <small class="muted">${src('costco')}</small></li>
  </ul></div>
  <div class="card"><h2 style="margin-top:0">Sources</h2><ul class="sources small">${['jdp26', 'jdp26all', 'btn26', 'jdp25'].map((k) => `<li>${src(k)}</li>`).join('')}</ul>
    <p class="small muted">The study surveyed 7,845 people who rented at airports from August 2025 to August 2026. Scores are on a 1,000-point scale. 2025 scores are shown only where they were published. Data reviewed ${fmtDate(DATA.dataReviewed)}.</p></div>`;
  $('#q').oninput = (e) => { CS.q = e.target.value; save(); drawList(false); };
  $$('[data-sort]', el).forEach((b) => b.onclick = () => { CS.sort = b.dataset.sort; setPressed('[data-sort]', b); save(); drawList(); });
  $$('[data-f]', el).forEach((b) => b.onclick = () => { CS.f = b.dataset.f; setPressed('[data-f]', b); save(); drawList(); });
  $('#checkNow').onclick = () => checkSites().then(() => { if ($('#list')) drawList(false); });
  drawChart(); drawList();
  function save() { store.set('cmp', CS); }
}
function drawChart() {
  const arr = [...DATA.companies].sort((a, b) => b.jdp - a.jdp); const lo = 600, hi = 760;
  const pct = (v) => Math.max(2, (v - lo) / (hi - lo) * 100);
  $('#chart').innerHTML = arr.map((c) => `<div class="bar-row" data-jump="${c.id}" role="button" tabindex="0" aria-label="${esc(c.name)} ${c.jdp}"><span>${esc(c.name.replace(' Rent A Car', ''))}</span><div class="bar-track"><div class="bar" data-w="${pct(c.jdp)}" style="background:${c.color}"></div><div class="avg-line" style="left:${pct(DATA.jdpAvg2026)}%"></div></div><span class="v">${c.jdp}</span></div>`).join('');
  requestAnimationFrame(() => setTimeout(() => $$('#chart .bar').forEach((b) => b.style.width = b.dataset.w + '%'), 30));
  $$('#chart [data-jump]').forEach((r) => { const f = () => { CS.q = ''; CS.f = ''; $('#q').value = ''; setPressed('[data-f]', $('[data-f=""]')); drawList(false); const card = document.getElementById('c-' + r.dataset.jump); if (card) { card.classList.add('open'); card.querySelector('.ins-head').setAttribute('aria-expanded', 'true'); card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); } }; r.onclick = f; r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }; });
}
function drawList(anim = true) {
  if (!$('#list')) return;
  const q = CS.q.trim().toLowerCase();
  let arr = DATA.companies.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!CS.f || (CS.f === 'above' ? c.jdp > DATA.jdpAvg2026 : c.tags.includes(CS.f))));
  arr.sort({ rated: (a, b) => b.jdp - a.jdp, perks: (a, b) => b.perks.length - a.perks.length || b.jdp - a.jdp, az: (a, b) => a.name.localeCompare(b.name) }[CS.sort]);
  const rank = [...DATA.companies].sort((a, b) => b.jdp - a.jdp).map((c) => c.id);
  $('#countLbl').textContent = `${arr.length} compan${arr.length === 1 ? 'y' : 'ies'}`;
  $('#list').innerHTML = arr.length ? arr.map((c, i) => {
    const r = rank.indexOf(c.id) + 1; const st = siteState(c.id);
    return `<article class="ins" id="c-${c.id}" style="${anim ? `animation-delay:${i * 45}ms` : 'animation:none;opacity:1;transform:none'}">
      <button type="button" class="ins-head" aria-expanded="false">${logo(c)}<span class="ins-name"><b>${esc(c.name)}</b><small>#${r} of ${DATA.companies.length} · ${esc(c.parent)}</small></span><span class="score">${c.jdp}<small>J.D. Power 2026</small></span><span class="chev" aria-hidden="true">▾</span></button>
      <div class="badges">${c.jdp > DATA.jdpAvg2026 ? '<span class="badge ok">Above average</span>' : '<span class="badge warn">Below average</span>'}${r <= 3 ? '<span class="badge top">🏆 Top 3</span>' : ''}${c.tags.includes('aarp') ? '<span class="badge">AARP</span>' : ''}${c.tags.includes('aaa') ? '<span class="badge">AAA</span>' : ''}${c.tags.includes('costco') ? '<span class="badge">Costco Travel</span>' : ''}</div>
      <div class="more"><div><div class="more-in">
        <table><tbody>
          <tr><th>Loyalty program</th><td>${c.loyalty ? esc(c.loyalty) + ' (free to join)' : 'n/a (check the website)'}</td></tr>
          <tr><th>2025 score</th><td>${c.jdp25 ? c.jdp25 + ` (${c.jdp - c.jdp25 >= 0 ? '+' : ''}${c.jdp - c.jdp25} in 2026)` : 'n/a (not published separately)'}</td></tr>
          <tr><th>Company group</th><td>${esc(c.parent)}</td></tr>
          <tr><th>Website</th><td>${esc(stateText[st.state])}${st.t ? ' · ' + esc(fmtDT(st.t)) : ''}</td></tr>
        </tbody></table>
        ${c.perks.length ? `<b>Member discounts</b><ul class="small">${c.perks.map((p) => `<li>${esc(p[0])} <span class="muted">(${src(p[1])})</span></li>`).join('')}</ul>` : '<p class="small muted">No verified member discount found. Ask about Costco, AAA or AARP rates anyway.</p>'}
      </div></div></div>
      <div class="ins-actions">${ext(c.site, 'Open website ↗', 'btn')}${c.frisco ? ext(c.frisco, 'Frisco locations ↗', 'btn ghost') : ''}<button type="button" class="btn ghost" data-searchgo>🔎 Search my trip</button></div>
    </article>`;
  }).join('') : '<div class="card muted">No companies match. Clear the search or pick "All".</div>';
  $$('#list .ins-head').forEach((h) => h.onclick = () => { const a = h.closest('.ins'); a.classList.toggle('open'); h.setAttribute('aria-expanded', a.classList.contains('open')); });
  $$('#list [data-searchgo]').forEach((b) => b.onclick = () => go('search'));
}

/* ---------- My quotes ---------- */
function feePreset(id) { const f = DATA.fees.find((x) => x.id === id); return f && f.pct != null ? { pct: f.pct, perDay: f.perDay } : { pct: 0, perDay: 0 }; }
function quoteTotal(q) {
  const base = q.kind === 'daily' ? q.amount * q.days : q.amount;
  if (q.incl) return { base, fees: 0, extras: q.extras * q.days + q.once, total: base + q.extras * q.days + q.once };
  const fees = base * (q.pct / 100) + q.perDay * q.days;
  const extras = q.extras * q.days + q.once;
  return { base, fees, extras, total: base + fees + extras };
}
function viewMine(el) {
  const draft = store.get('draft', null); store.set('draft', null);
  const where = draft ? draft.where : 'dfw'; const pre = feePreset(where);
  el.innerHTML = `
  <section class="hero"><h1>My quotes</h1><p class="lead">Type in the prices you find. The app adds taxes and fees, works out the cost per day and ranks them from cheapest. Saved only on this device.</p><div class="car" aria-hidden="true">🚕</div></section>
  <form class="card" id="qForm" autocomplete="off">
    <h2 style="margin-top:0">Add a price</h2>
    <div class="form-grid">
      <div class="field"><label for="qCo">Company or website</label><input id="qCo" list="coList" required placeholder="Example: Costco Travel / Alamo"></div>
      <datalist id="coList">${[...DATA.search, ...DATA.companies, ...DATA.jamaica.slice(0, 1)].map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>
      <div class="field"><label for="qWhere">Pick-up place</label><select id="qWhere">${DATA.fees.map((f) => `<option value="${f.id}" ${where === f.id ? 'selected' : ''}>${esc(f.place)}</option>`).join('')}<option value="other" ${where === 'other' ? 'selected' : ''}>Somewhere else</option></select></div>
      <div class="field"><label for="qKind">Price shown</label><select id="qKind"><option value="daily">Per day</option><option value="total">Total for the trip (before taxes)</option></select></div>
      <div class="field"><label for="qAmt">Price ($)</label><input id="qAmt" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="Example: 45"></div>
      <div class="field"><label for="qDays">Rental days</label><input id="qDays" type="number" min="1" max="60" value="${draft ? draft.days : 4}" inputmode="numeric"></div>
      <div class="field"><label for="qCar">Car (optional)</label><input id="qCar" placeholder="Example: Toyota Corolla or similar"></div>
      <div class="full"><label class="cbx"><input type="checkbox" id="qIncl"> The price already includes taxes and fees</label></div>
      <div class="field"><label for="qPct">Taxes and % fees</label><input id="qPct" type="number" min="0" max="60" step="0.01" value="${pre.pct}"><small class="muted">Filled in for the place you picked. Change it to match your quote.</small></div>
      <div class="field"><label for="qPerDay">Daily fees ($ per day)</label><input id="qPerDay" type="number" min="0" step="0.01" value="${pre.perDay}"></div>
      <div class="field"><label for="qExtras">Add-ons ($ per day)</label><input id="qExtras" type="number" min="0" step="0.01" value="0"><small class="muted">Insurance you buy at the counter, car seat, toll pass…</small></div>
      <div class="field"><label for="qOnce">One-time costs ($)</label><input id="qOnce" type="number" min="0" step="0.01" value="0"><small class="muted">Prepaid fuel, one-way fee…</small></div>
      <div class="field full"><label for="qNote">Notes (optional)</label><input id="qNote" placeholder="Example: free cancellation, pay later"></div>
    </div>
    <div class="row"><button type="submit" class="btn">➕ Add to my list</button><span class="small muted" id="qPreview"></span></div>
  </form>
  <div class="sec-h"><h2 id="qCount">Your quotes</h2><div class="row"><button type="button" class="btn small ghost" id="qExport">⬇️ Export</button><label class="btn small ghost" for="qImport" style="cursor:pointer">⬆️ Import</label><input type="file" id="qImport" accept="application/json,.json" hidden><button type="button" class="btn small danger" id="qClear">Clear all</button></div></div>
  <div id="qList"></div>
  <p class="small muted">Tip: book a "pay later" rate with free cancellation, keep checking, and switch if you find a lower total here.</p>`;
  const f = $('#qForm');
  const readQ = () => ({ id: Date.now().toString(36), co: $('#qCo').value.trim(), where: $('#qWhere').value, kind: $('#qKind').value, amount: +$('#qAmt').value || 0, days: Math.max(1, +$('#qDays').value || 1), car: $('#qCar').value.trim(), incl: $('#qIncl').checked, pct: +$('#qPct').value || 0, perDay: +$('#qPerDay').value || 0, extras: +$('#qExtras').value || 0, once: +$('#qOnce').value || 0, note: $('#qNote').value.trim(), added: new Date().toISOString() });
  const preview = () => { const q = readQ(); $('#qPreview').textContent = q.amount ? `Total ≈ ${money(quoteTotal(q).total, 2)} (${money(quoteTotal(q).total / q.days, 2)} a day)` : ''; };
  $('#qWhere').onchange = () => { const p = feePreset($('#qWhere').value); $('#qPct').value = p.pct; $('#qPerDay').value = p.perDay; preview(); };
  $('#qIncl').onchange = () => { $('#qPct').disabled = $('#qPerDay').disabled = $('#qIncl').checked; preview(); };
  f.addEventListener('input', preview);
  f.onsubmit = (e) => { e.preventDefault(); const q = readQ(); if (!q.co) { toast('Type the company name'); $('#qCo').focus(); return; } if (!q.amount) { toast('Type the price'); $('#qAmt').focus(); return; } const all = store.get('quotes', []); all.push(q); store.set('quotes', all); toast('Added'); f.reset(); $('#qDays').value = q.days; $('#qWhere').value = q.where; $('#qWhere').onchange(); $('#qPreview').textContent = ''; drawQuotes(q.id); };
  $('#qExport').onclick = () => { const blob = new Blob([JSON.stringify({ app: 'Car Rental Finder', exported: new Date().toISOString(), quotes: store.get('quotes', []) }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'car-rental-quotes.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Saved car-rental-quotes.json'); };
  $('#qImport').onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { const j = JSON.parse(await file.text()); const list = (Array.isArray(j) ? j : j.quotes || []).filter((q) => q && q.co && typeof q.amount === 'number').map((q) => ({ id: String(q.id || Math.random().toString(36).slice(2)), co: String(q.co).slice(0, 80), where: String(q.where || 'other'), kind: q.kind === 'total' ? 'total' : 'daily', amount: +q.amount || 0, days: Math.max(1, +q.days || 1), car: String(q.car || '').slice(0, 80), incl: !!q.incl, pct: +q.pct || 0, perDay: +q.perDay || 0, extras: +q.extras || 0, once: +q.once || 0, note: String(q.note || '').slice(0, 200), added: q.added || new Date().toISOString() })); const cur = store.get('quotes', []); const ids = new Set(cur.map((q) => q.id)); store.set('quotes', cur.concat(list.filter((q) => !ids.has(q.id)))); toast(`Imported ${list.length} quote${list.length === 1 ? '' : 's'}`); drawQuotes(); } catch (err) { toast('That file could not be read'); } e.target.value = ''; };
  $('#qClear').onclick = () => { if (!store.get('quotes', []).length) return; if (confirm('Delete all saved quotes on this device?')) { store.set('quotes', []); drawQuotes(); } };
  drawQuotes();
}
function drawQuotes(newId) {
  const all = store.get('quotes', []).map((q) => Object.assign({}, q, { t: quoteTotal(q) })).sort((a, b) => a.t.total - b.t.total);
  $('#qCount').textContent = all.length ? `Your quotes (${all.length}), cheapest first` : 'Your quotes';
  const place = (id) => (DATA.fees.find((f) => f.id === id) || { place: 'Somewhere else' }).place;
  const medal = ['🥇', '🥈', '🥉'];
  $('#qList').innerHTML = all.length ? all.map((q, i) => `<div class="q ${i === 0 ? 'best' : ''}" style="animation-delay:${i * 50}ms">
    <span class="medal" aria-hidden="true">${medal[i] || '#' + (i + 1)}</span>
    <div><b>${esc(q.co)}</b>${q.car ? ' · ' + esc(q.car) : ''}<br><small class="muted">${esc(place(q.where))} · ${q.days} day${q.days === 1 ? '' : 's'} · base ${money(q.t.base, 2)}${q.incl ? ' (fees included)' : ` + fees ${money(q.t.fees, 2)}`}${q.t.extras ? ` + add-ons ${money(q.t.extras, 2)}` : ''}${q.note ? ' · ' + esc(q.note) : ''}</small>
    ${i > 0 ? `<br><small class="muted">${money(q.t.total - all[0].t.total, 2)} more than the cheapest</small>` : (all.length > 1 ? '<br><small style="color:var(--ok);font-weight:700">Cheapest so far</small>' : '')}</div>
    <div style="text-align:right"><b style="font-size:1.25rem;color:var(--acc)">${money(q.t.total, 2)}</b><br><small class="muted">${money(q.t.total / q.days, 2)}/day</small><br><button type="button" class="btn small danger" data-del="${esc(q.id)}" aria-label="Delete ${esc(q.co)}" style="margin-top:4px">Delete</button></div>
  </div>`).join('') : '<div class="card muted">No quotes yet. Use the Search tab, then type the prices you find here.</div>';
  $$('[data-del]').forEach((b) => b.onclick = () => { store.set('quotes', store.get('quotes', []).filter((q) => q.id !== b.dataset.del)); drawQuotes(); toast('Deleted'); });
}

/* ---------- Calculator ---------- */
const CALC = Object.assign({ days: 4, rate: 50, preset: 'dfw', pct: 27.78, perDay: 11.03, extras: 0, fuel: 'self', miles: 300, mpg: 30, gas: 3.00, tank: 70 }, store.get('calc', {}));
function calcTotal(c, pct = c.pct, perDay = c.perDay) {
  const base = c.days * c.rate, fees = base * pct / 100 + perDay * c.days, extras = c.extras * c.days;
  const fuel = c.fuel === 'self' ? (c.miles / Math.max(1, c.mpg)) * c.gas : c.tank;
  return { base, fees, extras, fuel, total: base + fees + extras + fuel };
}
function viewCalc(el) {
  const sl = (id, label, min, max, step, unit = '') => `<div class="sl"><div class="row"><label for="s-${id}">${label}</label><output id="o-${id}"></output></div><input class="range" type="range" id="s-${id}" min="${min}" max="${max}" step="${step}" value="${CALC[id]}"></div>`;
  el.innerHTML = `
  <section class="hero"><h1>Trip cost calculator</h1><p class="lead">Slide to see what a rental really costs once taxes, airport fees, add-ons and gas are added.</p><div class="car" aria-hidden="true">🚐</div></section>
  <div class="grid two">
    <div class="card">
      <h2 style="margin-top:0">Your rental</h2>
      ${sl('days', 'Rental days', 1, 30, 1)}
      ${sl('rate', 'Daily rate', 10, 250, 1)}
      <div style="margin:10px 0 4px"><b>Pick-up place</b></div>
      <div class="seg" role="group" aria-label="Fee preset">${DATA.fees.filter((f) => f.pct != null).map((f) => `<button type="button" data-preset="${f.id}" aria-pressed="${CALC.preset === f.id}">${esc(f.place.replace(' (off-airport)', '').replace('Frisco neighborhood office', 'Frisco office').replace('Dallas Love Field (DAL)', 'Love Field'))}</button>`).join('')}<button type="button" data-preset="custom" aria-pressed="${CALC.preset === 'custom'}">My own</button></div>
      ${sl('pct', 'Taxes and % fees', 0, 40, 0.01)}
      ${sl('perDay', 'Daily fees', 0, 25, 0.01)}
      ${sl('extras', 'Add-ons per day (insurance, seats, tolls)', 0, 60, 1)}
      <div style="margin:10px 0 4px"><b>Fuel</b></div>
      <div class="seg" role="group" aria-label="Fuel"><button type="button" data-fuel="self" aria-pressed="${CALC.fuel === 'self'}">⛽ I refill it</button><button type="button" data-fuel="pre" aria-pressed="${CALC.fuel === 'pre'}">Prepaid tank</button></div>
      <div id="fuelSelf">${sl('miles', 'Miles you will drive', 0, 2000, 10)}${sl('mpg', 'Car miles per gallon', 12, 55, 1)}${sl('gas', 'Gas price per gallon (your area)', 2, 6, 0.01)}</div>
      <div id="fuelPre">${sl('tank', 'Prepaid fuel price', 20, 150, 1)}</div>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Estimated total</h2>
      <div class="total-box"><div class="stat"><b id="cTotal">$0</b><span>Trip total</span></div><div class="stat"><b id="cDay">$0</b><span>Real cost per day</span></div></div>
      <div class="stack" id="cStack" aria-hidden="true"><div style="background:#0d8478"></div><div style="background:#f97316"></div><div style="background:#8b5cf6"></div><div style="background:#eab308"></div></div>
      <div class="legend"><span><i style="background:#0d8478"></i>Base <b id="lBase"></b></span><span><i style="background:#f97316"></i>Taxes and fees <b id="lFees"></b></span><span><i style="background:#8b5cf6"></i>Add-ons <b id="lExtras"></b></span><span><i style="background:#eab308"></i>Fuel <b id="lFuel"></b></span></div>
      <h3 style="margin-top:18px">Same car, same price: airport or Frisco office?</h3>
      <div class="vs" id="vs"></div>
      <p class="small muted" id="vsNote"></p>
      <div class="row"><button type="button" class="btn" id="cSave">📝 Save as a quote</button><button type="button" class="btn ghost" id="cReset">Reset</button></div>
      <p class="small muted">Fee presets use Alamo's published fees and the 10% Texas rental tax (${src('alamofees')}; ${src('txtax')}). Estimates only.</p>
    </div>
  </div>`;
  const fmt = { days: (v) => v + ' day' + (v == 1 ? '' : 's'), rate: (v) => money(v) + '/day', pct: (v) => (+v).toFixed(2) + '%', perDay: (v) => money(v, 2) + '/day', extras: (v) => money(v) + '/day', miles: (v) => v + ' mi', mpg: (v) => v + ' mpg', gas: (v) => money(v, 2), tank: (v) => money(v) };
  const upd = () => {
    Object.keys(fmt).forEach((k) => { const o = $('#o-' + k); if (o) o.textContent = fmt[k](CALC[k]); });
    $('#fuelSelf').hidden = CALC.fuel !== 'self'; $('#fuelPre').hidden = CALC.fuel === 'self';
    const r = calcTotal(CALC); countUp($('#cTotal'), r.total, '$', 2); countUp($('#cDay'), r.total / CALC.days, '$', 2);
    [r.base, r.fees, r.extras, r.fuel].forEach((v, i) => { $$('#cStack>div')[i].style.width = (r.total ? v / r.total * 100 : 0) + '%'; });
    $('#lBase').textContent = money(r.base, 2); $('#lFees').textContent = money(r.fees, 2); $('#lExtras').textContent = money(r.extras, 2); $('#lFuel').textContent = money(r.fuel, 2);
    const a = feePreset('dfw'), b = feePreset('dal'), fr = feePreset('frisco');
    const ta = calcTotal(CALC, a.pct, a.perDay).total, tb = calcTotal(CALC, b.pct, b.perDay).total, tf = calcTotal(CALC, fr.pct, fr.perDay).total;
    const min = Math.min(ta, tb, tf);
    $('#vs').innerHTML = [['DFW Airport', ta], ['Love Field', tb], ['Frisco office', tf]].map(([n, v]) => `<div class="stat ${v === min ? 'win' : ''}"><b>${money(v, 2)}</b><span>${n}${v === min ? ' · cheapest' : ''}</span></div>`).join('');
    $('#vsNote').textContent = `Picking up in Frisco instead of DFW saves about ${money(ta - tf, 2)} on fees alone, if the daily rate is the same. Off-airport rates are often different, so compare real quotes.`;
    store.set('calc', CALC);
  };
  ['days', 'rate', 'pct', 'perDay', 'extras', 'miles', 'mpg', 'gas', 'tank'].forEach((k) => { $('#s-' + k).oninput = (e) => { CALC[k] = +e.target.value; if (k === 'pct' || k === 'perDay') { CALC.preset = 'custom'; setPressed('[data-preset]', $('[data-preset="custom"]')); } upd(); }; });
  $$('[data-preset]', el).forEach((b) => b.onclick = () => { CALC.preset = b.dataset.preset; setPressed('[data-preset]', b); if (b.dataset.preset !== 'custom') { const p = feePreset(b.dataset.preset); CALC.pct = p.pct; CALC.perDay = p.perDay; $('#s-pct').value = p.pct; $('#s-perDay').value = p.perDay; } upd(); });
  $$('[data-fuel]', el).forEach((b) => b.onclick = () => { CALC.fuel = b.dataset.fuel; setPressed('[data-fuel]', b); upd(); });
  $('#cSave').onclick = () => { const r = calcTotal(CALC); const all = store.get('quotes', []); all.push({ id: Date.now().toString(36), co: 'Calculator estimate', where: CALC.preset === 'custom' ? 'other' : CALC.preset, kind: 'daily', amount: CALC.rate, days: CALC.days, car: '', incl: false, pct: CALC.pct, perDay: CALC.perDay, extras: CALC.extras, once: +r.fuel.toFixed(2), note: 'Fuel ' + money(r.fuel, 2), added: new Date().toISOString() }); store.set('quotes', all); toast('Saved to My quotes'); };
  $('#cReset').onclick = () => { localStorage.removeItem('crf-calc'); Object.assign(CALC, { days: 4, rate: 50, preset: 'dfw', pct: 27.78, perDay: 11.03, extras: 0, fuel: 'self', miles: 300, mpg: 30, gas: 3.00, tank: 70 }); route(); };
  upd();
}

/* ---------- Save money tips ---------- */
function viewTips(el) {
  const done = store.get('tips', {});
  const tips = [
    ['airport', '🏢 Rent away from the airport when you can', `<p>Airport pick-ups add big fees. At DFW, Alamo adds a 12.78% concession recovery fee, a 5% venue tax and about $11 a day in other charges, on top of the 10% Texas rental tax. Love Field adds 12.22% plus about $5.85 a day. A Frisco neighborhood office usually charges just the 10% tax.</p><p>Picking up in Frisco after a ride home can save money on longer rentals. Use the <a href="#/calc">Calculator</a> to compare. Avis and Budget have Frisco offices: ${ext('https://www.avis.com/en/locations/nam/us/tx/frisco', 'Avis Frisco ↗', '')} · ${ext('https://www.budget.com/en/locations/us/tx/frisco/f1r', 'Budget Frisco ↗', '')}</p><small class="muted">Sources: ${src('alamofees')}; ${src('txtax')}</small>`],
    ['prepay', '💳 Prepay or pay later?', `<p>"Pay now" rates are often cheaper. For example, AARP's Avis and Budget discount is up to 35% off when you pay now, but up to 30% when you pay later.</p><p>Pay-later rates usually let you cancel for free, so you can rebook if the price drops. Prepaid rates may charge a fee to cancel or change. Read the cancellation rule before you choose.</p><small class="muted">Source: ${src('aarp')}</small>`],
    ['members', '🎟️ Use Costco, AAA and AARP rates', `<ul><li><b>Costco Travel</b> (members): often low prices, and one additional-driver fee waived at Enterprise, Alamo, Avis and Budget in the U.S. ${ext('https://www.costcotravel.com/Rental-Cars', 'Costco Travel ↗', '')}</li><li><b>AAA + Hertz</b>: up to 20% off the base rate, extra AAA drivers free, a free child seat and 10% off prepaid fuel. ${ext('https://discounts.aaa.com/travel/hertz', 'AAA Hertz page ↗', '')}</li><li><b>AARP</b> (you're 58; if you're a member): up to 35% off Avis and Budget base rates (pay now) or 30% (pay later), plus one additional driver free; 5% off Payless; up to 30% off select rentals through the AARP Travel Center powered by Expedia. ${ext('https://www.aarp.org/membership/benefits/car-rental-discounts/', 'AARP car rentals ↗', '')}</li></ul><p>Check each discounted price against Kayak. A member rate is not always the lowest.</p><small class="muted">Sources: ${src('costco')}; ${src('aaa')}; ${src('aarp')}</small>`],
    ['cards', '🛡️ Credit card coverage vs. the counter\'s insurance', `<p>Many credit cards cover damage to the rental car if you pay with that card and <b>decline</b> the rental company's collision damage waiver (CDW/LDW). Most card coverage does <b>not</b> include liability (injury or damage to others), and some cards only pay after your own auto insurance.</p><p>Before you go: call the number on your card or read its benefit guide, and ask your auto insurer whether your policy covers rentals. Then you can say no to coverage you already have.</p><small class="muted">Source: ${src('nw')}</small>`],
    ['rebook', '🔁 Book early, then keep checking with AutoSlash', `<p>Book a free-cancellation, pay-later rate as soon as you know your trip. Then add it to AutoSlash's free tracker. It emails you if it finds a lower price, so you can rebook and cancel the old one.</p>${ext('https://www.autoslash.com/', 'Open AutoSlash ↗', 'btn small')}`],
    ['fuel', '⛽ Skip the fuel package unless you\'ll return it empty', `<p>A prepaid tank only pays off if you bring the car back nearly empty, because you get no money back for gas left in the tank. Usually it's cheapest to refill at a station near the return location and keep the receipt. If you'd rather prepay at Hertz, AAA members get 10% off prepaid fuel.</p><small class="muted">Source: ${src('aaa')}</small>`],
    ['drivers', '👥 Extra drivers and young drivers', `<p>Hertz charges $15 a day for each extra driver and $25 a day for drivers under 25. AAA members get both waived at Hertz (young-renter waiver for ages 20 to 24). AARP members get one free extra driver at Avis, Budget and Payless. Costco Travel bookings get one free extra driver at Enterprise, Alamo, Avis and Budget in the U.S.</p><small class="muted">Sources: ${src('aaa')}; ${src('aarp')}; ${src('payless')}; ${src('costco')}</small>`],
    ['check', '📸 Before you drive off', `<p>Walk around the car and take photos or a video of every scratch, the fuel level and the mileage. Do the same when you return it. Ask how tolls are billed. A toll-pass add-on can cost more than the tolls.</p>`],
    ['jamaica', '🇯🇲 Renting in Jamaica', `<ul><li>Jamaica drives on the <b>left</b>, and most cars are right-hand drive. Speed limits are 50 km/h (30 mph) in built-up areas and 80 km/h (50 mph) on highways.</li><li>Your U.S. license is fine for up to three months per visit. Seat belts are required for everyone.</li><li>The Jamaica Tourist Board says renters must be at least 25. Island Car Rentals rents standard cars to drivers 21 to 75, with a possible under-25 surcharge.</li><li><b>Insurance:</b> Visa's rental car collision coverage excludes Jamaica. Unless your card confirms Jamaica coverage in writing, plan to buy the rental company's collision waiver and ask how big the deductible is.</li><li>Rent from a company on the Jamaica Tourist Board's licensed list.</li></ul><small class="muted">Sources: ${src('jtb')}; ${src('icr')}; ${src('visa')}</small>`]
  ];
  el.innerHTML = `
  <section class="hero"><h1>Ways to save money</h1><p class="lead">Tick each tip as you use it. Your ticks are saved on this device.</p><div class="progress" style="margin-top:8px"><div id="tipBar"></div></div><p class="small muted" id="tipCount" style="margin:6px 0 0"></p><div class="car" aria-hidden="true">💵</div></section>
  ${tips.map(([id, title, body]) => `<details data-tip="${id}"><summary><span><input type="checkbox" data-done="${id}" ${done[id] ? 'checked' : ''} aria-label="Mark as done" style="width:20px;height:20px;min-height:0;vertical-align:middle;margin-right:8px;accent-color:var(--ok)">${title}</span></summary><div>${body}</div></details>`).join('')}
  <p class="small muted">Information only, not insurance or legal advice. Prices and rules change, so confirm on the company's website before you book.</p>`;
  const bar = () => { if (!$('#tipBar')) return; const n = Object.values(done).filter(Boolean).length; $('#tipBar').style.width = (n / tips.length * 100) + '%'; $('#tipCount').textContent = `${n} of ${tips.length} tips used`; };
  $$('[data-done]', el).forEach((c) => { c.onclick = (e) => e.stopPropagation(); c.onchange = () => { done[c.dataset.done] = c.checked; store.set('tips', done); bar(); }; });
  if (location.hash.includes('jamaica')) { const d = $('[data-tip="jamaica"]'); if (d) d.open = true; }
  setTimeout(bar, 60);
}

/* ---------- shell ---------- */
function net() { const p = $('#netPill'); const on = navigator.onLine; p.className = 'pill ' + (on ? 'on' : 'off'); p.textContent = on ? 'Online' : 'Offline'; p.title = on ? 'Connected to the internet' : 'No internet: showing saved data'; }
function theme() { const b = $('#themeBtn'); const dark = document.documentElement.dataset.theme === 'dark'; b.textContent = dark ? 'Light mode' : 'Dark mode'; b.setAttribute('aria-pressed', dark); }
async function boot() {
  net(); addEventListener('online', net); addEventListener('offline', net); theme();
  $('#themeBtn').onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; store.set('theme', d); theme(); };
  $$('.tabs button').forEach((b) => b.onclick = () => go(b.dataset.go));
  try { DATA = await (await fetch('data/companies.json', { cache: 'no-cache' })).json(); }
  catch (e) { $('#main').innerHTML = '<div class="card">Could not load the app data. Check your internet connection and reload.</div>'; return; }
  try { STATUS = await (await fetch('data/status.json', { cache: 'no-cache' })).json(); } catch (e) { STATUS = null; }
  addEventListener('hashchange', route); route();
}
boot();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
