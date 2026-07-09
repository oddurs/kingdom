import { el, stack, row } from './_util.js';

// The three chip families: story toggles (`.schip`), reference links (`.pref`,
// `.pref.verified`) and example tags (`.exchip`).
export default {
  title: 'Components/Chips',
  parameters: { layout: 'centered' },
};

const labelled = (text, node) => {
  const wrap = document.createElement('div');
  const l = document.createElement('div');
  l.textContent = text;
  l.style.cssText = 'font-family:var(--mono);font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--faint);margin-bottom:8px';
  wrap.append(l, node);
  return wrap;
};

export const StoryChips = () =>
  labelled('Story toggles — .schip', row(
    el(`<button class="schip on">Carnivores</button>`),
    el(`<button class="schip">Crops</button>`),
    el(`<button class="schip">Biggest families</button>`),
  ));

export const References = () =>
  labelled('References — .pref', row(
    el(`<a class="pref verified" href="#" onclick="return false">POWO</a>`),
    el(`<a class="pref" href="#" onclick="return false">GBIF</a>`),
    el(`<a class="pref" href="#" onclick="return false">Wikipedia</a>`),
  ));

export const Examples = () =>
  labelled('Examples — .exchip', row(
    el(`<span class="exchip">Opuntia (prickly pear)</span>`),
    el(`<span class="exchip">Carnegiea (saguaro)</span>`),
    el(`<span class="exchip">Mammillaria</span>`),
  ));

export const All = () => stack(StoryChips(), References(), Examples());
