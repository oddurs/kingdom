// Stories render the *real* shipping classes. This helper just turns an HTML
// string into a DOM node so a story can `return el(`<button class="ctl">…`)`.
export const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
};

// a padded row/stack wrapper for laying out several specimens in one story
export const row = (...nodes) => {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:center';
  nodes.forEach((n) => d.append(n));
  return d;
};
export const stack = (...nodes) => {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:flex-start';
  nodes.forEach((n) => d.append(n));
  return d;
};
