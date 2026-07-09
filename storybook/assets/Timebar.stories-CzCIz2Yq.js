import{e as b}from"./_util-BTFOiCfg.js";const w={title:"Components/Timebar",parameters:{layout:"centered",backgrounds:{default:"ground"}}},m=[["Silurian",444,419,"#4f8f79"],["Devonian",419,359,"#3f7f88"],["Carboniferous",359,299,"#566f9e"],["Permian",299,252,"#8a6cae"],["Triassic",252,201,"#a76aa0"],["Jurassic",201,145,"#c17f68"],["Cretaceous",145,66,"#8faa55"],["Paleogene",66,23,"#d3a24a"],["Neogene",23,2.6,"#dcc06a"],["Quaternary",2.6,0,"#c9c9c9"]],e=445,i=a=>(e-a)/e*100,v=m.map(([,a,p,u])=>`<span class="bd" style="left:${i(a).toFixed(1)}%;width:${(i(p)-i(a)).toFixed(1)}%;background:${u}"></span>`).join(""),s=()=>{const a=i(139);return b(`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <button class="tbplay" aria-label="Play through time">&#9654;</button>
    <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="139">
      <div class="tbbands">${v}</div>
      <div class="tbfill" style="width:${(100-a).toFixed(1)}%"><span class="tbknob"></span></div>
    </div>
    <div class="tblabel">139 Ma <span class="per">· Cretaceous</span></div>
  </div>`)},t=()=>b(`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <button class="tbplay" aria-label="Play through time">&#9654;</button>
    <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="0">
      <div class="tbbands">${v}</div>
      <div class="tbfill" style="width:0"><span class="tbknob"></span></div>
    </div>
    <div class="tblabel">now <span class="per">· Quaternary</span></div>
  </div>`);var n,l,r;s.parameters={...s.parameters,docs:{...(n=s.parameters)==null?void 0:n.docs,source:{originalSource:`() => {
  // knob at ~139 Ma (angiosperm origin); curtain covers everything more recent
  const at = x(139);
  return el(\`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <button class="tbplay" aria-label="Play through time">&#9654;</button>
    <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="139">
      <div class="tbbands">\${bands}</div>
      <div class="tbfill" style="width:\${(100 - at).toFixed(1)}%"><span class="tbknob"></span></div>
    </div>
    <div class="tblabel">139 Ma <span class="per">· Cretaceous</span></div>
  </div>\`);
}`,...(r=(l=s.parameters)==null?void 0:l.docs)==null?void 0:r.source}}};var o,c,d;t.parameters={...t.parameters,docs:{...(o=t.parameters)==null?void 0:o.docs,source:{originalSource:`() => el(\`<div class="timebar" style="position:static;width:min(680px,90vw)">
    <button class="tbplay" aria-label="Play through time">&#9654;</button>
    <div class="tbtrack" role="slider" aria-valuemin="0" aria-valuemax="445" aria-valuenow="0">
      <div class="tbbands">\${bands}</div>
      <div class="tbfill" style="width:0"><span class="tbknob"></span></div>
    </div>
    <div class="tblabel">now <span class="per">· Quaternary</span></div>
  </div>\`)`,...(d=(c=t.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};const h=["Playing","PresentDay"];export{s as Playing,t as PresentDay,h as __namedExportsOrder,w as default};
