import { el } from './_util.js';

// `.zoomctl` — one cohesive vertical pill: seamless buttons + a hairline divider.
// Pinned static here (it floats absolute over the canvas in the app).
export default {
  title: 'Components/Zoom control',
  parameters: { layout: 'centered' },
};

export const Default = () =>
  el(`<div class="zoomctl" style="position:static">
    <button class="ctl" aria-label="Zoom in">+</button>
    <button class="ctl" aria-label="Zoom out">&minus;</button>
  </div>`);
