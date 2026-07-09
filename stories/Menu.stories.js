import { el } from './_util.js';

// `.menu` — a header popover. In the app it is position:fixed and toggled
// under its button; here we pin it static so the surface is visible in isolation.
export default {
  title: 'Components/Menu',
  parameters: { layout: 'centered' },
};

const asStatic = (node) => {
  node.style.position = 'static';
  node.hidden = false;
  return node;
};

export const More = () =>
  asStatic(el(`<div class="menu" role="menu">
    <div class="menu-sec">
      <span class="menu-label">Depth</span>
      <span class="seg">
        <button class="ctl on">Orders</button>
        <button class="ctl">Expand all</button>
        <button class="ctl">Collapse</button>
      </span>
    </div>
    <div class="menu-sec">
      <button class="ctl wide">Export as PNG</button>
      <button class="ctl wide">About &amp; controls</button>
    </div>
  </div>`));

export const Colour = () =>
  asStatic(el(`<div class="menu" role="menu">
    <span class="stories">
      <span class="slabel">Colour by</span>
      <button class="schip on">Lineage</button>
      <button class="schip">Origin</button>
      <button class="schip">Range</button>
    </span>
    <div class="lgswatches">
      <span class="lg"><span class="dot" style="color:var(--l-fern)"></span>Ferns &amp; allies</span>
      <span class="lg"><span class="dot" style="color:var(--l-rosid)"></span>Rosids</span>
      <span class="lg"><span class="dot" style="color:var(--l-asterid)"></span>Asterids</span>
    </div>
  </div>`));
