import{e as y}from"./_util-BTFOiCfg.js";const A={title:"Components/Specimen panel",parameters:{layout:"centered"}},d=(a,r)=>{const s=y(`<aside class="panel" role="dialog" aria-label="Taxon detail">${r}</aside>`);return s.style.cssText+=`position:static;opacity:1;transform:none;max-height:none;width:330px;--lc:${a}`,s},u=({crumb:a,rank:r,name:s,common:b,blurb:h,examples:f,stats:g})=>`
  <button class="pclose" aria-label="Close">&times;</button>
  <nav class="pcrumb">${a.map((e,v)=>v===a.length-1?`<span style="color:var(--dim)">${e}</span>`:`<a>${e}</a>`).join(' <span class="sepc">&rsaquo;</span> ')}</nav>
  <span class="prank">${r}</span>
  <h2 class="pname">${s}</h2>
  <div class="pcommon">${b}</div>
  <p class="pblurb">${h}</p>
  <div class="pexlabel">Examples</div>
  <div class="pex">${f.map(e=>`<span class="exchip">${e}</span>`).join("")}</div>
  <div class="pstats">${g.map(e=>`<div class="pstat"><b>${e[0]}</b><span>${e[1]}</span></div>`).join("")}</div>
  <div class="pactions"><button class="ctl">Expand</button><button class="ctl">Focus subtree</button><button class="ctl">Copy link</button></div>
  <div class="preflabel">References</div>
  <div class="prefs"><a class="pref verified">POWO</a><a class="pref">GBIF</a><a class="pref">Wikipedia</a></div>`,t=()=>d("#e67e6b",u({crumb:["Plantae","Angiosperms","Caryophyllales","Cactaceae"],rank:"family",name:"Cactaceae",common:"Cacti",blurb:"Stem-succulents of the Americas with spines borne on areoles and water-storing tissue; ~1,750 species.",examples:["Opuntia (prickly pear)","Carnegiea (saguaro)","Mammillaria"],stats:[["~1,750","species"],["168","genera"],["8","rank depth"]]})),n=()=>d("#8f9be8",u({crumb:["Plantae","Asterids","Asterales","Asteraceae"],rank:"family",name:"Asteraceae",common:"Daisies — sunflower, lettuce, dandelion",blurb:"Florets packed into composite heads that mimic single blooms; the largest eudicot family, ~32,000 species.",examples:["Helianthus (sunflower)","Taraxacum (dandelion)","Aster"],stats:[["~35,479","species"],["1,730","genera"],["10","rank depth"]]}));var c,i,l;t.parameters={...t.parameters,docs:{...(c=t.parameters)==null?void 0:c.docs,source:{originalSource:`() => card('#e67e6b', body({
  crumb: ['Plantae', 'Angiosperms', 'Caryophyllales', 'Cactaceae'],
  rank: 'family',
  name: 'Cactaceae',
  common: 'Cacti',
  blurb: 'Stem-succulents of the Americas with spines borne on areoles and water-storing tissue; ~1,750 species.',
  examples: ['Opuntia (prickly pear)', 'Carnegiea (saguaro)', 'Mammillaria'],
  stats: [['~1,750', 'species'], ['168', 'genera'], ['8', 'rank depth']]
}))`,...(l=(i=t.parameters)==null?void 0:i.docs)==null?void 0:l.source}}};var o,p,m;n.parameters={...n.parameters,docs:{...(o=n.parameters)==null?void 0:o.docs,source:{originalSource:`() => card('#8f9be8', body({
  crumb: ['Plantae', 'Asterids', 'Asterales', 'Asteraceae'],
  rank: 'family',
  name: 'Asteraceae',
  common: 'Daisies — sunflower, lettuce, dandelion',
  blurb: 'Florets packed into composite heads that mimic single blooms; the largest eudicot family, ~32,000 species.',
  examples: ['Helianthus (sunflower)', 'Taraxacum (dandelion)', 'Aster'],
  stats: [['~35,479', 'species'], ['1,730', 'genera'], ['10', 'rank depth']]
}))`,...(m=(p=n.parameters)==null?void 0:p.docs)==null?void 0:m.source}}};const k=["Cactaceae","Asteraceae"];export{n as Asteraceae,t as Cactaceae,k as __namedExportsOrder,A as default};
