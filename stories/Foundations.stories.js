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
  <div style="font-family:var(--mono);font-size:11px;color:var(--ink);margin-top:9px">${name}</div>
  <div style="font-family:var(--mono);font-size:10px;color:var(--faint)">${val}</div>`;

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
  const roles = [
    ['--serif', 'Serif — display & taxon names', 'Angiosperms · Caryophyllales'],
    ['--sans', 'Sans — UI & body', 'Stem-succulents of the Americas'],
    ['--mono', 'Mono — data, labels & counts', '~389,873 species · 611 branches'],
  ];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:22px;padding:32px';
  roles.forEach(([tok, role, sample]) => {
    const b = document.createElement('div');
    b.innerHTML = `
      <div style="font-family:var(--mono);font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint)">${role}</div>
      <div style="font-family:var(${tok});font-size:26px;color:var(--ink);margin-top:6px">${sample}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px">var(${tok}) → ${cssvar(tok)}</div>`;
    wrap.append(b);
  });
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
        <code style="font-family:var(--mono);font-size:12px;color:var(--ink)">var(${n})</code>
        <span style="font-family:var(--mono);font-size:11px;color:var(--faint)">${cssvar(n)}</span>
        <span style="color:var(--dim);font-size:13px">${use}</span>
      </div>`).join('');
  wrap.querySelectorAll('.motion-demo').forEach((dot) => {
    dot.parentElement.addEventListener('mouseenter', () => { dot.style.transform = 'translateX(180px)'; });
    dot.parentElement.addEventListener('mouseleave', () => { dot.style.transform = 'none'; });
  });
  return wrap;
};
