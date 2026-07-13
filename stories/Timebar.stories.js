import { el } from './_util.js';

// `.timebar` — the geological time scrubber. Bands are the periods; the curtain
// (`.tbfill`) hides time not yet reached, retracting rightward as it plays.
export default {
  title: 'Components/Timebar',
  parameters: { layout: 'centered', backgrounds: { default: 'ground' } },
};

// a handful of period bands, positioned by their share of 445 Ma (oldest → now)
const GEOP = [
  ['Silurian', 444, 419, '#4f8f79'], ['Devonian', 419, 359, '#3f7f88'],
  ['Carboniferous', 359, 299, '#566f9e'], ['Permian', 299, 252, '#8a6cae'],
  ['Triassic', 252, 201, '#a76aa0'], ['Jurassic', 201, 145, '#c17f68'],
  ['Cretaceous', 145, 66, '#8faa55'], ['Paleogene', 66, 23, '#d3a24a'],
  ['Neogene', 23, 2.6, '#dcc06a'], ['Quaternary', 2.6, 0, '#c9c9c9'],
];
const TMAX = 445;
const x = (v) => ((TMAX - v) / TMAX) * 100;

const bands = GEOP.map(([, a, b, c]) =>
  `<span class="bd" style="left:${x(a).toFixed(1)}%;width:${(x(b) - x(a)).toFixed(1)}%;background:${c}"></span>`).join('');

export const Playing = () => {
  // knob at ~139 Ma (angiosperm origin); curtain covers everything more recent
  const at = x(139);
  return el(`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <div class="tbhint">Drag back through <b>445 million years</b> — each lineage appears at its origin</div>
    <div class="tbrow">
      <button class="tbplay" aria-label="Play through time">&#9654;</button>
      <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="139">
        <div class="tbbands">${bands}</div>
        <div class="tbfill" style="width:${(100 - at).toFixed(1)}%"><span class="tbknob"></span></div>
      </div>
      <div class="tblabel">139 Ma <span class="per">· Cretaceous</span></div>
    </div>
  </div>`);
};

export const PresentDay = () => el(`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <div class="tbhint">Drag back through <b>445 million years</b> — each lineage appears at its origin</div>
    <div class="tbrow">
      <button class="tbplay" aria-label="Play through time">&#9654;</button>
      <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="0">
        <div class="tbbands">${bands}</div>
        <div class="tbfill" style="width:0"><span class="tbknob"></span></div>
      </div>
      <div class="tblabel">now <span class="per">· Quaternary</span></div>
    </div>
  </div>`);
