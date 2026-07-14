const l={title:"Design/Icons",parameters:{layout:"fullscreen",backgrounds:{default:"ground"}}},s=`<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="ic-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 8 10.5 12 6.5"/></symbol>
  <symbol id="ic-chevron-up" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 8 5.5 12 9.5"/></symbol>
  <symbol id="ic-close" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"/></symbol>
  <symbol id="ic-plus" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.6V12.4M3.6 8H12.4"/></symbol>
  <symbol id="ic-minus" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.6 8H12.4"/></symbol>
  <symbol id="ic-play" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.8 12.4 8 5.5 12.2Z"/></symbol>
</svg>`,a=["chevron","chevron-up","close","plus","minus","play"],e=()=>{const o=document.createElement("div");return o.style.cssText="padding:32px;color:var(--ink)",o.innerHTML=s+'<div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">'+a.map(r=>`
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 8px;
           border:1px solid var(--edge);border-radius:var(--r-2);background:var(--fill-1)">
        <svg style="width:22px;height:22px;color:var(--ink)"><use href="#ic-${r}"/></svg>
        <span style="font-family:var(--sans);font-size:11px;color:var(--faint)">ic-${r}</span>
      </div>`).join("")+`</div><p style="font-family:var(--sans);font-size:12.5px;color:var(--dim);max-width:60ch;margin-top:22px;line-height:1.6">
      Drawn in the brand mark's language — 1.6px round-cap strokes on a 16-grid, <code>currentColor</code> so they take the button's colour and hover states.</p>`,o};var n,t,i;e.parameters={...e.parameters,docs:{...(n=e.parameters)==null?void 0:n.docs,source:{originalSource:`() => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:32px;color:var(--ink)';
  wrap.innerHTML = SPRITE + \`<div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">\` + NAMES.map(n => \`
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 8px;
           border:1px solid var(--edge);border-radius:var(--r-2);background:var(--fill-1)">
        <svg style="width:22px;height:22px;color:var(--ink)"><use href="#ic-\${n}"/></svg>
        <span style="font-family:var(--sans);font-size:11px;color:var(--faint)">ic-\${n}</span>
      </div>\`).join('') + \`</div><p style="font-family:var(--sans);font-size:12.5px;color:var(--dim);max-width:60ch;margin-top:22px;line-height:1.6">
      Drawn in the brand mark's language — 1.6px round-cap strokes on a 16-grid, <code>currentColor</code> so they take the button's colour and hover states.</p>\`;
  return wrap;
}`,...(i=(t=e.parameters)==null?void 0:t.docs)==null?void 0:i.source}}};const d=["All"];export{e as All,d as __namedExportsOrder,l as default};
