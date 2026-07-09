import { el } from './_util.js';

// `.search` — the find field, with the mono keyboard hint tucked at the right.
export default {
  title: 'Components/Search',
  parameters: { layout: 'centered' },
};

export const Field = () =>
  el(`<div class="search">
    <input id="q" type="search" placeholder="Find a family or plant&hellip;" autocomplete="off" spellcheck="false" aria-label="Search">
    <span class="hint">/</span>
  </div>`);

export const WithResults = () => {
  const wrap = el(`<div class="search" style="min-width:360px">
    <input type="search" value="cact" aria-label="Search">
    <span class="hint">3</span>
    <div class="qresults" role="listbox">
      <button class="qrow active"><span class="qrk" style="color:var(--l-rosid)"></span><span class="qnm"><em>Cact</em>aceae</span><span class="qcm">Cacti</span><span class="qct">1,750</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-mono)"></span><span class="qnm"><em>Cact</em>oideae</span><span class="qcm"></span><span class="qct">1,400</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-basal)"></span><span class="qnm">Pereskia (near <em>Cact</em>i)</span><span class="qcm">leafy cactus</span><span class="qct">17</span></button>
    </div>
  </div>`);
  // .qresults is normally toggled by JS; reveal it for the workshop
  wrap.querySelector('.qresults').hidden = false;
  return wrap;
};
