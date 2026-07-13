import { el } from './_util.js';

// `.legendbar` — the persistent colour key on the canvas. It reflects the active
// colour mode and, in the app, hovering an entry spotlights those taxa in the tree.
export default {
  title: 'Components/Legend',
  parameters: { layout: 'centered', backgrounds: { default: 'ground' } },
};

const swatch = (color, label, on = false) =>
  `<span class="lg${on ? ' on' : ''}"><span class="dot" style="color:${color}"></span>${label}</span>`;

const legend = (title, items) =>
  el(`<div class="legendbar" style="position:static">
    <div class="lgtitle">${title}</div>
    <div class="lgitems">${items}</div>
  </div>`);

// live token values for the lineage hues
const hue = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export const Lineage = () =>
  legend('Lineage', [
    [hue('--l-bryo'), 'Bryophytes'], [hue('--l-fern'), 'Ferns & allies'],
    [hue('--l-gymno'), 'Gymnosperms'], [hue('--l-basal'), 'Magnoliids & basal'],
    [hue('--l-mono'), 'Monocots'], [hue('--l-rosid'), 'Rosids', true],
    [hue('--l-asterid'), 'Asterids'], [hue('--l-eudicot'), 'Other eudicots'],
  ].map(([c, l, on]) => swatch(c, l, on)).join(''));

export const NativeRegion = () =>
  legend('Native region', [
    ['#6f9fd8', 'Europe'], ['#e0a34a', 'Africa'], ['#7bbf6a', 'Asia-Temperate'],
    ['#3fae9a', 'Asia-Tropical'], ['#e0776b', 'Australasia'], ['#cf88cf', 'Pacific'],
    ['#8f9be8', 'Northern America'], ['#d9c24e', 'Southern America'], ['#b9c2bd', 'Antarctic'],
    ['#3c4a43', 'No data'],
  ].map(([c, l]) => swatch(c, l)).join(''));
