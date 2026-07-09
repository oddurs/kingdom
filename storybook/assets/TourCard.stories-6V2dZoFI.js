import{e as r}from"./_util-BTFOiCfg.js";const b={title:"Components/Tour card",parameters:{layout:"centered",backgrounds:{default:"ground"}}},i=(p,d)=>Array.from({length:p},(m,u)=>`<i class="${u===d?"on":""}"></i>`).join(""),s=()=>r(`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">${i(6,2)}</span>
      <span class="tstep">3 / 6</span>
    </div>
    <h3 class="tname">Asteraceae <em>daisy family</em></h3>
    <p class="ttext">Florets packed into composite heads that mimic single blooms — the largest eudicot family, some 32,000 species from sunflowers to lettuce.</p>
    <div class="tnav">
      <button class="ctl">&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>`),t=()=>r(`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">${i(6,0)}</span>
      <span class="tstep">1 / 6</span>
    </div>
    <h3 class="tname">One root <em>Plantae</em></h3>
    <p class="ttext">Every land plant traces back to a single common ancestor. From here the tree splits into mosses, ferns, conifers and the flowering plants.</p>
    <div class="tnav">
      <button class="ctl" disabled>&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>`);var a,o,e;s.parameters={...s.parameters,docs:{...(a=s.parameters)==null?void 0:a.docs,source:{originalSource:`() => el(\`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">\${dots(6, 2)}</span>
      <span class="tstep">3 / 6</span>
    </div>
    <h3 class="tname">Asteraceae <em>daisy family</em></h3>
    <p class="ttext">Florets packed into composite heads that mimic single blooms — the largest eudicot family, some 32,000 species from sunflowers to lettuce.</p>
    <div class="tnav">
      <button class="ctl">&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>\`)`,...(e=(o=s.parameters)==null?void 0:o.docs)==null?void 0:e.source}}};var n,l,c;t.parameters={...t.parameters,docs:{...(n=t.parameters)==null?void 0:n.docs,source:{originalSource:`() => el(\`<div class="tourcard show" role="dialog" style="position:static;transform:none;width:min(580px,calc(100% - 32px))">
    <div class="thead">
      <span class="ttitle">Guided tour</span>
      <span class="tourdots">\${dots(6, 0)}</span>
      <span class="tstep">1 / 6</span>
    </div>
    <h3 class="tname">One root <em>Plantae</em></h3>
    <p class="ttext">Every land plant traces back to a single common ancestor. From here the tree splits into mosses, ferns, conifers and the flowering plants.</p>
    <div class="tnav">
      <button class="ctl" disabled>&lsaquo; Back</button>
      <button class="ctl">Next &rsaquo;</button>
      <span class="sp"></span>
      <button class="ctl">Exit tour</button>
    </div>
  </div>\`)`,...(c=(l=t.parameters)==null?void 0:l.docs)==null?void 0:c.source}}};const v=["Step","FirstStep"];export{t as FirstStep,s as Step,v as __namedExportsOrder,b as default};
