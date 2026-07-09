import { el } from './_util.js';

// `.minimap` — the overview inset (bottom-left). In the app its content is
// generated from the live layout; here we draw a representative radial sketch
// plus the viewport rect (`.mvp`).
export default {
  title: 'Components/Minimap',
  parameters: { layout: 'centered', backgrounds: { default: 'ground' } },
};

// a little radial spray of branch lines from a centre, for illustration
const lines = () => {
  const cx = 95, cy = 66;
  let out = '';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r1 = 10 + (i % 3) * 4, r2 = 40 + (i % 5) * 8;
    out += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"/>`;
  }
  return out;
};

export const Overview = () => el(`<div class="minimap" style="position:static">
    <svg viewBox="0 0 190 132" preserveAspectRatio="none">
      <g>${lines()}<rect class="mvp" x="70" y="44" width="66" height="46"></rect></g>
    </svg>
    <span class="mmlabel">Overview</span>
  </div>`);
