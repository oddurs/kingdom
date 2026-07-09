import { el, row, stack } from './_util.js';

// `button.ctl` — the base control. Variants come from added classes, so the
// markup below is exactly what shell.html ships.
export default {
  title: 'Components/Button',
  parameters: { layout: 'centered' },
};

export const Default = () => el(`<button class="ctl">Fit</button>`);

export const Selected = () => el(`<button class="ctl on">Radial</button>`);

export const Menu = () =>
  el(`<button class="ctl menu-btn" aria-haspopup="true" aria-expanded="false">Colour<span class="caret">&#9662;</span></button>`);

export const Icon = () =>
  el(`<button class="ctl menu-btn iconbtn" aria-label="More options">&hellip;</button>`);

export const Wide = () =>
  el(`<button class="ctl wide" style="width:220px">Export as PNG</button>`);

export const Primary = () =>
  el(`<button class="ctl primary">Take the tour &rsaquo;</button>`);

// The full set, for scanning states side by side.
export const AllVariants = () =>
  stack(
    row(
      el(`<button class="ctl">Default</button>`),
      el(`<button class="ctl on">Selected</button>`),
      el(`<button class="ctl menu-btn">Menu<span class="caret">&#9662;</span></button>`),
      el(`<button class="ctl menu-btn iconbtn" aria-label="More">&hellip;</button>`),
      el(`<button class="ctl primary">Primary</button>`),
    ),
    row(el(`<button class="ctl wide" style="width:260px">Wide (menu row)</button>`)),
  );
