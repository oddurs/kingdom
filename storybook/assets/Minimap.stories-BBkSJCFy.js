import{e as p}from"./_util-BTFOiCfg.js";const x={title:"Components/Minimap",parameters:{layout:"centered",backgrounds:{default:"ground"}}},l=()=>{let i="";for(let e=0;e<22;e++){const s=e/22*Math.PI*2,a=10+e%3*4,o=40+e%5*8;i+=`<line x1="${(95+Math.cos(s)*a).toFixed(1)}" y1="${(66+Math.sin(s)*a).toFixed(1)}" x2="${(95+Math.cos(s)*o).toFixed(1)}" y2="${(66+Math.sin(s)*o).toFixed(1)}"/>`}return i},t=()=>p(`<div class="minimap" style="position:static">
    <svg viewBox="0 0 190 132" preserveAspectRatio="none">
      <g>${l()}<rect class="mvp" x="70" y="44" width="66" height="46"></rect></g>
    </svg>
    <span class="mmlabel">Overview</span>
  </div>`);var r,n,c;t.parameters={...t.parameters,docs:{...(r=t.parameters)==null?void 0:r.docs,source:{originalSource:`() => el(\`<div class="minimap" style="position:static">
    <svg viewBox="0 0 190 132" preserveAspectRatio="none">
      <g>\${lines()}<rect class="mvp" x="70" y="44" width="66" height="46"></rect></g>
    </svg>
    <span class="mmlabel">Overview</span>
  </div>\`)`,...(c=(n=t.parameters)==null?void 0:n.docs)==null?void 0:c.source}}};const g=["Overview"];export{t as Overview,g as __namedExportsOrder,x as default};
