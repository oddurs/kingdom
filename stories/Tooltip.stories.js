import { el } from './_util.js';

// `.tip` — the hover tooltip. Normally position:absolute & faded out; pinned
// static + `.show` here. Its left border wears the taxon's lineage colour.
export default {
  title: 'Components/Tooltip',
  parameters: { layout: 'centered' },
};

export const Family = () =>
  el(`<div class="tip show" style="position:static;--lc:var(--l-rosid);max-width:300px">
    <div class="rk">Family</div>
    <div class="nm">Cactaceae</div>
    <div class="cm">Cacti</div>
    <div class="bl">Stem-succulents of the Americas with spines borne on areoles and water-storing tissue.</div>
    <div class="ex"><i>e.g.</i>Opuntia &middot; Carnegiea &middot; Mammillaria</div>
    <div class="st"><span><b>~1,750</b> species</span></div>
  </div>`);

export const Clade = () =>
  el(`<div class="tip show" style="position:static;--lc:var(--l-asterid);max-width:300px">
    <div class="rk">Order &middot; click to expand</div>
    <div class="nm">Asterales</div>
    <div class="st"><span><b>~35,479</b> species</span><span><b>11</b> families</span></div>
  </div>`);
