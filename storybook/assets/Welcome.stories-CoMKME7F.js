const c={title:"Components/Welcome",parameters:{layout:"centered",backgrounds:{default:"ground-2"}}},n=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="ygg-mark-sb" viewBox="0 0 40 40">
  <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".42">
    <path d="M20 20 20 7"/><path d="M20 20 30.2 11.9"/><path d="M20 20 32.7 22.9"/><path d="M20 20 25.6 31.7"/><path d="M20 20 14.4 31.7"/><path d="M20 20 7.3 22.9"/><path d="M20 20 9.8 11.9"/>
  </g>
  <g fill="currentColor" opacity=".82"><circle cx="20" cy="7" r="2.3"/><circle cx="30.2" cy="11.9" r="2.3"/><circle cx="32.7" cy="22.9" r="2.3"/><circle cx="25.6" cy="31.7" r="2.3"/><circle cx="14.4" cy="31.7" r="2.3"/><circle cx="7.3" cy="22.9" r="2.3"/><circle cx="9.8" cy="11.9" r="2.3"/></g>
  <circle cx="20" cy="20" r="8" fill="currentColor" opacity=".14"/><circle cx="20" cy="20" r="3.9" fill="currentColor"/>
</symbol></svg>`,e=()=>{const r=document.createElement("div");return r.innerHTML=n+`<div class="card" style="color:var(--l-fern)">
    <svg class="mark mark-lg"><use href="#ygg-mark-sb"/></svg>
    <h2 style="color:var(--ink)">Yggdrasil &middot; <em>a living tree</em></h2>
    <p class="lead">Every family of land plant, from mosses to orchids &mdash; sized by species richness, coloured by lineage. Roughly 390,000 species across 611 branches, from one root.</p>
    <ul>
      <li><b>Four views</b><span>Tree, Radial and Sunburst show how plants are related; Treemap sizes them by richness.</span></li>
      <li><b>Move</b><span>Drag to pan, scroll or pinch to zoom. Zoom in and deeper names appear.</span></li>
      <li><b>Dig in</b><span>Click any branch for its story; &ldquo;Focus subtree&rdquo; dives into a single clade.</span></li>
    </ul>
    <div class="wact">
      <button class="ctl primary">Take the tour &rsaquo;</button>
      <button class="ctl">Explore on my own</button>
    </div>
  </div>`,r.querySelector(".card").style.width="min(540px, 100%)",r};var s,a,o;e.parameters={...e.parameters,docs:{...(s=e.parameters)==null?void 0:s.docs,source:{originalSource:`() => {
  const wrap = document.createElement('div');
  wrap.innerHTML = MARK + \`<div class="card" style="color:var(--l-fern)">
    <svg class="mark mark-lg"><use href="#ygg-mark-sb"/></svg>
    <h2 style="color:var(--ink)">Yggdrasil &middot; <em>a living tree</em></h2>
    <p class="lead">Every family of land plant, from mosses to orchids &mdash; sized by species richness, coloured by lineage. Roughly 390,000 species across 611 branches, from one root.</p>
    <ul>
      <li><b>Four views</b><span>Tree, Radial and Sunburst show how plants are related; Treemap sizes them by richness.</span></li>
      <li><b>Move</b><span>Drag to pan, scroll or pinch to zoom. Zoom in and deeper names appear.</span></li>
      <li><b>Dig in</b><span>Click any branch for its story; &ldquo;Focus subtree&rdquo; dives into a single clade.</span></li>
    </ul>
    <div class="wact">
      <button class="ctl primary">Take the tour &rsaquo;</button>
      <button class="ctl">Explore on my own</button>
    </div>
  </div>\`;
  wrap.querySelector('.card').style.width = 'min(540px, 100%)';
  return wrap; // includes the (0×0) mark symbol defs the card's <use> references
}`,...(o=(a=e.parameters)==null?void 0:a.docs)==null?void 0:o.source}}};const l=["Card"];export{e as Card,l as __namedExportsOrder,c as default};
