import { el } from './_util.js';

// `.tourcard` — the guided-tour step. `.show` reveals it; the dots track
// progress. Pinned static here.
export default {
  title: 'Components/Tour card',
  parameters: { layout: 'centered', backgrounds: { default: 'ground' } },
};

const dots = (n, at) =>
  Array.from({ length: n }, (_, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('');

export const Step = () => el(`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">${dots(6, 2)}</span>
      <span class="tstep">3 / 6</span>
    </div>
    <h3 class="tname">Asteraceae <em>daisy family</em></h3>
    <p class="ttext">Florets packed into composite heads that mimic single blooms — the largest eudicot family, some 32,000 species from sunflowers to lettuce.</p>
    <div class="tnav">
      <button class="ctl">&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>`);

export const FirstStep = () => el(`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">${dots(6, 0)}</span>
      <span class="tstep">1 / 6</span>
    </div>
    <h3 class="tname">One root <em>Plantae</em></h3>
    <p class="ttext">Every land plant traces back to a single common ancestor. From here the tree splits into mosses, ferns, conifers and the flowering plants.</p>
    <div class="tnav">
      <button class="ctl" disabled>&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>`);
