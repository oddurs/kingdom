import { el } from './_util.js';

// `.focusbar` — shown (top-left, over the canvas) when the view is re-rooted
// into a single clade. Its left edge wears the fern accent.
export default {
  title: 'Components/Focus bar',
  parameters: { layout: 'centered', backgrounds: { default: 'ground' } },
};

export const Focused = () => el(`<div class="focusbar show" style="position:static;transform:none">
    <span class="flabel">Focused</span>
    <span class="fname">Asteraceae</span>
    <button class="ctl" title="Up one level">&#9650;</button>
    <button class="ctl">Show all</button>
  </div>`);
