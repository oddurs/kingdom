// Foundations — the token scales everything else is built from.
// Values are read *live* from the imported design/tokens.css, so these docs
// can never disagree with what the app actually uses.

export default {
  title: 'Design/Foundations',
  parameters: { layout: 'fullscreen', backgrounds: { default: 'ground' } },
};

const cssvar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const grid = (min = 150) => {
  const d = document.createElement('div');
  d.style.cssText = `display:grid;gap:14px;padding:32px;grid-template-columns:repeat(auto-fill,minmax(${min}px,1fr))`;
  return d;
};
const label = (name, val) => `
  <div style="font-family:var(--sans);font-size:11px;color:var(--ink);margin-top:9px">${name}</div>
  <div style="font-family:var(--sans);font-size:10px;color:var(--faint);font-variant-numeric:tabular-nums">${val}</div>`;

// ---- Colour -------------------------------------------------------------
export const Colour = () => {
  const surfaces = ['--ground', '--ground-2', '--panel', '--edge', '--line', '--ink', '--dim', '--faint'];
  const hues = ['--l-bryo', '--l-fern', '--l-gymno', '--l-basal', '--l-mono', '--l-rosid', '--l-asterid', '--l-eudicot', '--l-root'];
  const wrap = document.createElement('div');
  const section = (title, names) => {
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.cssText = 'font-family:var(--serif);color:var(--ink);margin:8px 32px 0;font-weight:600';
    const g = grid();
    names.forEach((n) => {
      const v = cssvar(n);
      const card = document.createElement('div');
      card.innerHTML = `
        <div style="height:64px;border-radius:var(--r-2);border:1px solid var(--edge);background:${v}"></div>
        ${label(n, v)}`;
      g.append(card);
    });
    wrap.append(h, g);
  };
  section('Surfaces & ink', surfaces);
  section('Lineage hues', hues);
  return wrap;
};

// ---- Typography ---------------------------------------------------------
export const Typography = () => {
  // Two families: a serif for names/display, one sans (Hanken Grotesk) for
  // everything else — labels and data are sans conventions, not a third family.
  const roles = [
    ['--serif', 'Display / names', 'Angiosperms · Caryophyllales', '38px'],
    ['--sans', 'Text / UI', 'Stem-succulents of the Americas', '26px'],
  ];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:26px;padding:32px';
  roles.forEach(([tok, role, sample, size]) => {
    const b = document.createElement('div');
    b.innerHTML = `
      <div style="font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">${role}</div>
      <div style="font-family:var(${tok});font-size:${size};color:var(--ink);margin-top:8px;letter-spacing:var(--track-display)">${sample}</div>
      <div style="font-family:var(--sans);font-size:10px;color:var(--faint);margin-top:6px">var(${tok})</div>`;
    wrap.append(b);
  });
  // the two sans conventions that replaced mono: tracked labels + tabular data
  const conv = document.createElement('div');
  conv.style.cssText = 'border-top:1px solid var(--line);padding-top:22px;display:flex;gap:56px;flex-wrap:wrap';
  conv.innerHTML = `
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Label — sans, uppercase, tracked</div>
      <div style="font-family:var(--sans);font-size:9.5px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--dim);margin-top:8px">Examples · Native range · References</div>
    </div>
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Data — sans, tabular figures</div>
      <div style="font-family:var(--sans);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink);margin-top:6px">389,873 · 14,129 · 611</div>
    </div>`;
  wrap.append(conv);
  return wrap;
};

// ---- Radius -------------------------------------------------------------
export const Radius = () => {
  const g = grid(170);
  [['--r-1', 'controls'], ['--r-2', 'containers'], ['--r-3', 'large surfaces'], ['--r-pill', 'pills']].forEach(([n, use]) => {
    const v = cssvar(n);
    const card = document.createElement('div');
    card.innerHTML = `
      <div style="height:76px;border-radius:var(${n});border:1px solid var(--faint);background:var(--ground-2)"></div>
      ${label(`${n} · ${use}`, v)}`;
    g.append(card);
  });
  return g;
};

// ---- Motion -------------------------------------------------------------
export const Motion = () => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:32px;font-family:var(--sans);color:var(--ink)';
  const rows = [
    ['--dur-1', 'quick — hovers, taps, focus'],
    ['--dur-2', 'considered — panels, reflows, grows'],
    ['--ease-out', 'entrances & most transitions'],
    ['--ease-settle', 'things that come to rest (springy settle)'],
  ];
  wrap.innerHTML =
    `<p style="color:var(--dim);max-width:52ch;margin:0 0 20px">One shared motion language. Hover a dot to feel each easing / duration pair.</p>` +
    rows.map(([n, use]) => `
      <div style="display:flex;align-items:center;gap:16px;margin:10px 0">
        <div class="motion-demo" style="width:26px;height:26px;border-radius:var(--r-pill);background:var(--l-fern);
             transition:transform ${n.startsWith('--dur') ? `var(${n}) var(--ease-out)` : `var(--dur-2) var(${n})`}"></div>
        <code style="font-family:var(--sans);font-size:12px;color:var(--ink)">var(${n})</code>
        <span style="font-family:var(--sans);font-size:11px;color:var(--faint)">${cssvar(n)}</span>
        <span style="color:var(--dim);font-size:13px">${use}</span>
      </div>`).join('');
  wrap.querySelectorAll('.motion-demo').forEach((dot) => {
    dot.parentElement.addEventListener('mouseenter', () => { dot.style.transform = 'translateX(180px)'; });
    dot.parentElement.addEventListener('mouseleave', () => { dot.style.transform = 'none'; });
  });
  return wrap;
};

// ---- Surfaces & Elevation (L: cohesion tokens) --------------------------
export const Surfaces = () => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:32px;color:var(--ink);display:flex;flex-direction:column;gap:26px';
  const sec = (title) => { const h = document.createElement('h3');
    h.textContent = title; h.style.cssText = 'font-family:var(--serif);color:var(--ink);margin:0;font-weight:600'; return h; };

  // fills + interaction swatches
  const fills = document.createElement('div');
  fills.style.cssText = 'display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))';
  [['--fill-1', 'control fill'], ['--fill-2', 'inset fill'], ['--fill-hover', 'hover-lift'],
   ['--hover', 'hover overlay'], ['--active', 'active overlay']].forEach(([tok, use]) => {
    const c = document.createElement('div');
    c.innerHTML = `<div style="height:60px;border-radius:var(--r-2);border:1px solid var(--edge);background:var(${tok})"></div>
      <div style="font-family:var(--sans);font-size:11px;color:var(--ink);margin-top:9px">${tok}</div>
      <div style="font-family:var(--sans);font-size:10px;color:var(--faint)">${use} · ${cssvar(tok)}</div>`;
    fills.append(c);
  });

  // elevation cards
  const elev = document.createElement('div');
  elev.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;padding:8px 0 16px';
  ['--elev-1', '--elev-2', '--elev-3'].forEach((tok, i) => {
    const card = document.createElement('div');
    card.style.cssText = `width:150px;height:92px;border-radius:var(--r-2);border:1px solid var(--edge);
      background:var(--panel);box-shadow:var(${tok});display:flex;align-items:flex-end;padding:10px;
      font-family:var(--sans);font-size:11px;color:var(--dim)`;
    card.textContent = `${tok} · ${['low', 'mid', 'high'][i]}`;
    elev.append(card);
  });

  wrap.append(sec('Fills & interaction states'), fills, sec('Elevation'), elev);
  return wrap;
};
