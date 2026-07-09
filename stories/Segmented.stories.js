import { el } from './_util.js';

// `.seg` — a cohesive group of mutually-exclusive controls (one `.on`).
export default {
  title: 'Components/Segmented',
  parameters: { layout: 'centered' },
};

export const Views = () =>
  el(`<span class="seg">
    <button class="ctl">Tree</button>
    <button class="ctl on">Radial</button>
    <button class="ctl">Sunburst</button>
    <button class="ctl">Treemap</button>
  </span>`);

export const Depth = () =>
  el(`<span class="seg">
    <button class="ctl on">Orders</button>
    <button class="ctl">Expand all</button>
    <button class="ctl">Collapse</button>
  </span>`);
