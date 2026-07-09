import { el } from './_util.js';

// `.modal` / `.sheet` — the shell for secondary pages (About, Controls).
// The app fills `.mbody` via openModal(); these stories show representative
// content. Rendered as the sheet on the ground (the overlay just dims behind).
export default {
  title: 'Components/Modal',
  parameters: { layout: 'centered', backgrounds: { default: 'ground-2' } },
};

const sheet = (body) => {
  const n = el(`<div class="sheet" style="margin:0">
    <button class="mclose" aria-label="Close">&times;</button>
    <div class="mbody">${body}</div>
  </div>`);
  n.style.width = 'min(600px, 92vw)';
  return n;
};

export const About = () =>
  sheet(`<h2>About Yggdrasil</h2>
    <p class="msub"><em>A living tree of the plant kingdom.</em></p>
    <p>Every family of land plant, from mosses to orchids — each branch sized by how many species it holds and coloured by its lineage.</p>
    <div class="pstats" style="--lc:var(--l-fern)">
      <div class="pstat"><b>~389,873</b><span>species</span></div>
      <div class="pstat"><b>479</b><span>families</span></div>
      <div class="pstat"><b>14,129</b><span>genera</span></div>
    </div>
    <div class="msec"><h3>Sources</h3>
      <div class="krow"><div class="kterm">Flowering plants</div><div class="kdesc">APG IV — <a class="ln">Angiosperm Phylogeny Group, 2016</a></div></div>
      <div class="krow"><div class="kterm">Species &amp; range</div><div class="kdesc"><a class="ln">Kew WCVP / Plants of the World Online</a></div></div>
    </div>`);

export const Controls = () => {
  const kbd = (...k) => k.map((x) => `<span class="kbd">${x}</span>`).join(' ');
  return sheet(`<h2>Controls &amp; shortcuts</h2>
    <p class="msub">Move through the tree by mouse, touch, or keyboard.</p>
    <div class="msec"><h3>Navigate</h3>
      <div class="krow"><div class="kterm">Pan</div><div class="kdesc">Drag anywhere on the canvas.</div></div>
      <div class="krow"><div class="kterm">Zoom</div><div class="kdesc">Scroll or pinch, or use the ${kbd('+', '&minus;')} pill.</div></div>
    </div>
    <div class="msec"><h3>Keyboard</h3>
      <div class="krow"><div class="kterm">${kbd('&uarr;', '&darr;')}</div><div class="kdesc">Previous / next branch</div></div>
      <div class="krow"><div class="kterm">${kbd('&rarr;')}</div><div class="kdesc">Expand — go deeper</div></div>
      <div class="krow"><div class="kterm">${kbd('Esc')}</div><div class="kdesc">Close panels, menus and pages</div></div>
    </div>`);
};
