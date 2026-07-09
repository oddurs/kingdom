import{e as o}from"./_util-BTFOiCfg.js";const m={title:"Components/Search",parameters:{layout:"centered"}},s=()=>o(`<div class="search">
    <input id="q" type="search" placeholder="Find a family or plant&hellip;" autocomplete="off" spellcheck="false" aria-label="Search">
    <span class="hint">/</span>
  </div>`),a=()=>{const e=o(`<div class="search" style="min-width:360px">
    <input type="search" value="cact" aria-label="Search">
    <span class="hint">3</span>
    <div class="qresults" role="listbox">
      <button class="qrow active"><span class="qrk" style="color:var(--l-rosid)"></span><span class="qnm"><em>Cact</em>aceae</span><span class="qcm">Cacti</span><span class="qct">1,750</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-mono)"></span><span class="qnm"><em>Cact</em>oideae</span><span class="qcm"></span><span class="qct">1,400</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-basal)"></span><span class="qnm">Pereskia (near <em>Cact</em>i)</span><span class="qcm">leafy cactus</span><span class="qct">17</span></button>
    </div>
  </div>`);return e.querySelector(".qresults").hidden=!1,e};var n,l,c;s.parameters={...s.parameters,docs:{...(n=s.parameters)==null?void 0:n.docs,source:{originalSource:`() => el(\`<div class="search">
    <input id="q" type="search" placeholder="Find a family or plant&hellip;" autocomplete="off" spellcheck="false" aria-label="Search">
    <span class="hint">/</span>
  </div>\`)`,...(c=(l=s.parameters)==null?void 0:l.docs)==null?void 0:c.source}}};var t,r,p;a.parameters={...a.parameters,docs:{...(t=a.parameters)==null?void 0:t.docs,source:{originalSource:`() => {
  const wrap = el(\`<div class="search" style="min-width:360px">
    <input type="search" value="cact" aria-label="Search">
    <span class="hint">3</span>
    <div class="qresults" role="listbox">
      <button class="qrow active"><span class="qrk" style="color:var(--l-rosid)"></span><span class="qnm"><em>Cact</em>aceae</span><span class="qcm">Cacti</span><span class="qct">1,750</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-mono)"></span><span class="qnm"><em>Cact</em>oideae</span><span class="qcm"></span><span class="qct">1,400</span></button>
      <button class="qrow"><span class="qrk" style="color:var(--l-basal)"></span><span class="qnm">Pereskia (near <em>Cact</em>i)</span><span class="qcm">leafy cactus</span><span class="qct">17</span></button>
    </div>
  </div>\`);
  // .qresults is normally toggled by JS; reveal it for the workshop
  wrap.querySelector('.qresults').hidden = false;
  return wrap;
}`,...(p=(r=a.parameters)==null?void 0:r.docs)==null?void 0:p.source}}};const d=["Field","WithResults"];export{s as Field,a as WithResults,d as __namedExportsOrder,m as default};
