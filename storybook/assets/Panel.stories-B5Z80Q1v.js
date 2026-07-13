import{e as $}from"./_util-BTFOiCfg.js";const C={title:"Components/Specimen panel",parameters:{layout:"centered"}},b=(e,i)=>{const s=$(`<aside class="panel" role="dialog" aria-label="Taxon detail">${i}</aside>`);return s.style.cssText+=`position:static;opacity:1;transform:none;max-height:none;width:330px;--lc:${e}`,s},f=({crumb:e,rank:i,name:s,common:g,blurb:y,examples:h,stats:v,badges:l=[],ctx:r=[]})=>`
  <button class="pclose" aria-label="Close">&times;</button>
  <nav class="pcrumb">${e.map((a,x)=>x===e.length-1?`<span style="color:var(--dim)">${a}</span>`:`<a>${a}</a>`).join(' <span class="sepc">&rsaquo;</span> ')}</nav>
  <span class="prank">${i}</span>
  <h2 class="pname">${s}</h2>
  <div class="pcommon">${g}</div>
  ${l.length?`<div id="pbadge">${l.map(a=>`<span class="pbadge">${a}</span>`).join("")}</div>`:""}
  <p class="pblurb">${y}</p>
  <div class="pexlabel">Examples</div>
  <div class="pex">${h.map(a=>`<span class="exchip">${a}</span>`).join("")}</div>
  <div class="pstats">${v.map(a=>`<div class="pstat"><b>${a[0]}</b><span>${a[1]}</span></div>`).join("")}</div>
  ${r.length?`<div class="pctx">${r.map(a=>`<div>${a}</div>`).join("")}</div>`:""}
  <div class="pactions"><button class="ctl">Expand</button><button class="ctl">Focus subtree</button><button class="ctl">Copy link</button></div>
  <div class="preflabel">References</div>
  <div class="prefs"><a class="pref verified">POWO</a><a class="pref">GBIF</a><a class="pref">Wikipedia</a></div>`,t=()=>b("#e67e6b",f({crumb:["Plantae","Angiosperms","Caryophyllales","Cactaceae"],rank:"family",name:"Cactaceae",common:"Cacti",blurb:"Stem-succulents of the Americas with spines borne on areoles and water-storing tissue; ~1,750 species.",examples:["Opuntia (prickly pear)","Carnegiea (saguaro)","Mammillaria"],stats:[["~1,750","species"],["168","genera"],["8","rank depth"]]})),n=()=>b("#8f9be8",f({crumb:["Plantae","Asterids","Asterales","Asteraceae"],rank:"family",name:"Asteraceae",common:"Daisies — sunflower, lettuce, dandelion",blurb:"Florets packed into composite heads that mimic single blooms; the largest eudicot family, ~32,000 species.",examples:["Helianthus (sunflower)","Taraxacum (dandelion)","Aster"],stats:[["~35,479","species"],["1,730","genera"],["10","rank depth"]],badges:["Largest plant family","Most genera of any family"],ctx:["1st-largest of 479 families","Alongside Campanulaceae · Goodeniaceae · Stylidiaceae"]}));var c,o,p;t.parameters={...t.parameters,docs:{...(c=t.parameters)==null?void 0:c.docs,source:{originalSource:`() => card('#e67e6b', body({
  crumb: ['Plantae', 'Angiosperms', 'Caryophyllales', 'Cactaceae'],
  rank: 'family',
  name: 'Cactaceae',
  common: 'Cacti',
  blurb: 'Stem-succulents of the Americas with spines borne on areoles and water-storing tissue; ~1,750 species.',
  examples: ['Opuntia (prickly pear)', 'Carnegiea (saguaro)', 'Mammillaria'],
  stats: [['~1,750', 'species'], ['168', 'genera'], ['8', 'rank depth']]
}))`,...(p=(o=t.parameters)==null?void 0:o.docs)==null?void 0:p.source}}};var m,d,u;n.parameters={...n.parameters,docs:{...(m=n.parameters)==null?void 0:m.docs,source:{originalSource:`() => card('#8f9be8', body({
  crumb: ['Plantae', 'Asterids', 'Asterales', 'Asteraceae'],
  rank: 'family',
  name: 'Asteraceae',
  common: 'Daisies — sunflower, lettuce, dandelion',
  blurb: 'Florets packed into composite heads that mimic single blooms; the largest eudicot family, ~32,000 species.',
  examples: ['Helianthus (sunflower)', 'Taraxacum (dandelion)', 'Aster'],
  stats: [['~35,479', 'species'], ['1,730', 'genera'], ['10', 'rank depth']],
  badges: ['Largest plant family', 'Most genera of any family'],
  ctx: ['1st-largest of 479 families', 'Alongside Campanulaceae · Goodeniaceae · Stylidiaceae']
}))`,...(u=(d=n.parameters)==null?void 0:d.docs)==null?void 0:u.source}}};const k=["Cactaceae","Asteraceae"];export{n as Asteraceae,t as Cactaceae,k as __namedExportsOrder,C as default};
