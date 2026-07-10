// ---------- storylines (curated overlays) ----------
const STORIES = {
  carnivores:{ label:'Carnivores', names:['Nepenthaceae','Sarraceniaceae','Droseraceae','Drosophyllaceae','Dioncophyllaceae','Lentibulariaceae','Cephalotaceae','Byblidaceae','Roridulaceae'] },
  crops:{ label:'Crops we eat', names:['Poaceae','Fabaceae','Solanaceae','Brassicaceae','Rosaceae','Cucurbitaceae','Rutaceae','Amaryllidaceae','Musaceae','Malvaceae','Arecaceae','Zingiberaceae','Vitaceae','Anacardiaceae','Apiaceae','Convolvulaceae','Polygonaceae'] },
  giants:{ label:'Biggest families', compute:'family' },
  biggen:{ label:'Biggest genera', compute:'genus' }
};
let activeStory=null;
function nodesOfRank(rank){ const a=[]; (function w(n){ if(n.rank===rank) a.push(n); (n.children||[]).forEach(w); })(ROOT); return a; }
function storyNodes(id){
  const st=STORIES[id];
  if(st.compute){ return nodesOfRank(st.compute).sort((a,b)=>b.agg-a.agg).slice(0,12); }
  const want=new Set(st.names), out=[];
  (function w(n){ if(want.has(n.name)) out.push(n); (n.children||[]).forEach(w); })(ROOT);
  return out;
}
function setStory(id){
  if(activeStory===id){ clearStory(); return; }
  if(tour) endTour();
  clearStory(false);
  resetFocus();                       // a storyline highlights across the whole tree
  activeStory=id;
  const ns=storyNodes(id);
  storySet=new Set(ns.map(x=>x._id));
  for(const n of ns){ let p=n.parent; while(p){ if((p.children||[]).length) p.open=true; p=p.parent; } }
  render(); relabelAll();
  stage.classList.add('storying');
  for(const n of ns){ const el=nodeEls.get(n._id); if(el) el.classList.add('hl'); }
  document.querySelectorAll('.schip').forEach(c=>c.classList.toggle('on', c.dataset.story===id));
  showStoryList(id, ns);
  fit(650);            // show the whole tree so the highlighted families read as a constellation
  updateHash();
}
function showStoryList(id, ns){
  const st=STORIES[id];
  const rows=ns.slice().sort((a,b)=>b.agg-a.agg);
  if(selected){ const pe=nodeEls.get(selected._id); if(pe) pe.classList.remove('selected'); selected=null; }
  document.getElementById('pdetail').hidden=true;
  const pl=document.getElementById('plist'); pl.hidden=false;
  const fern=cssVar('--l-fern'); panel.style.borderLeftColor=fern; panel.style.borderTopColor=fern;
  const unit = rows.every(n=>n.rank==='genus')?'genera':(rows.every(n=>n.rank==='family')?'families':'taxa');
  pl.innerHTML = `<div class="lhead">${st.label}</div><div class="lsub">${rows.length} ${unit} &middot; tap one to explore</div>`+
    rows.map(n=>`<div class="lrow" data-id="${n._id}" role="button" tabindex="0"><span class="ldot" style="color:${color(n)}"></span>`+
      `<span class="ltx"><span class="lname">${escp(n.name)}</span>${n.common?` <span class="lcom">${escp(n.common)}</span>`:''}</span>`+
      `<span class="lcount">~${n.agg.toLocaleString()}</span></div>`).join('');
  pl.querySelectorAll('.lrow').forEach(r=>{ const go=()=>{ const n=idMap.get(+r.dataset.id); if(n) select(n); };
    r.onclick=go; r.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } }; });
  panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
}
function clearStory(doHash){
  activeStory=null; storySet=null; stage.classList.remove('storying');
  document.querySelectorAll('.node.hl').forEach(e=>e.classList.remove('hl'));
  document.querySelectorAll('.schip.on').forEach(c=>c.classList.remove('on'));
  const pl=document.getElementById('plist');
  if(pl && !pl.hidden){ pl.hidden=true; document.getElementById('pdetail').hidden=false;
    if(!selected){ panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); } }
  if(doHash!==false) updateHash();
}
// ---------- deep-linking ----------
function shareHash(){                          // '#sel=…&hl=…' for the current state (shared by updateHash + Copy link)
  const p=[];
  if(selected) p.push('sel='+encodeURIComponent(selected.name));
  if(activeStory) p.push('hl='+activeStory);
  return p.length ? '#'+p.join('&') : '';
}
function updateHash(){
  const h=shareHash();
  history.replaceState(null,'', h || location.pathname+location.search);
}
function nodeByName(nm){ let f=null; (function w(n){ if(n.name===nm) f=n; (n.children||[]).forEach(w); })(ROOT); return f; }
function applyHash(){
  const h=location.hash.replace(/^#/,''); if(!h) return;
  const params=new URLSearchParams(h);
  const hl=params.get('hl'); if(hl && STORIES[hl]) setStory(hl);
  const sel=params.get('sel'); if(sel){ const n=nodeByName(sel); if(n) select(n); }
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.activeElement!==q){
  if(modal.classList.contains('show')) return;   // the modal owns Escape while open
  if(welcome.classList.contains('show')) hideWelcome();
  else if(tour) endTour(); else if(selected) closePanel(); else if(activeStory) clearStory(); } });

// ---------- guided tours (stepped, narrated walkthroughs) ----------
const TOURS = {
  ascent:{ label:'The great ascent', steps:[
    {name:'Bryophytes', text:'It begins low and damp. Mosses, liverworts and hornworts are the first plants to leave the water — but not its embrace: they still need a film of moisture to reproduce, and never grow true roots or wood.'},
    {name:'Polypodiopsida', text:'Ferns invent plumbing. True vascular tissue carries water upward, so they can stand tall and green the forest floor and canopy — a full 200 million years before the first flower.'},
    {name:'Gymnosperms', text:'The seed changes everything. Conifers, cycads and ginkgo wrap the next generation in a portable, drought-proof package of naked seeds, and clothe the world through the age of dinosaurs.'},
    {name:'Angiosperms', text:'Then the flower — and an explosion. Enclosed seeds, fruit, and a bargain struck with pollinators launch the flowering plants to roughly 340,000 species, the overwhelming majority of plant life today.'},
    {name:'Orchidaceae', text:'Its most extravagant peak: the orchids. Around 28,000 species — the largest family of flowering plants — each a specialist in seduction, from bee-mimics to vanilla.'}
  ]},
  dinner:{ label:'Where dinner comes from', steps:[
    {name:'Poaceae', text:'Almost every calorie starts here. The grasses — wheat, rice, maize, barley, sugarcane — feed civilisation, quietly the most important plant family on Earth.'},
    {name:'Fabaceae', text:'The legumes fix their own nitrogen, so beans, peas, lentils and peanuts pack protein and enrich the soil they grow in. The world’s third-largest plant family.'},
    {name:'Solanaceae', text:'The nightshades gamble: many are toxic, yet this family gives us the potato, tomato, pepper, aubergine and tobacco — food and poison from the same branch.'},
    {name:'Brassicaceae', text:'One wild mustard, endlessly reshaped by breeders, became cabbage, kale, broccoli, cauliflower, sprouts and canola — a masterclass in what selection can do.'},
    {name:'Rosaceae', text:'Dessert grows on the rose family: apples, pears, cherries, plums, peaches, strawberries, raspberries and almonds all hang from its branches.'}
  ]},
  carn:{ label:'Plants that bite back', steps:[
    {name:'Droseraceae', text:'Where soil is too poor to feed them, some plants hunt. The sundews and the Venus flytrap glisten with glue and snap shut on insects to mine them for nitrogen.'},
    {name:'Nepenthaceae', text:'Tropical pitcher plants grow slippery jugs half-filled with digestive fluid — some large enough to drown a rodent — and simply wait.'},
    {name:'Sarraceniaceae', text:'North America’s pitcher plants evolved the same trap independently: tall tubes, nectar lures, downward hairs, and a pool of no return.'},
    {name:'Lentibulariaceae', text:'The bladderworts are the fastest predators in the kingdom — underwater traps that snap open in half a millisecond to suck in prey.'}
  ]}
};
const tourcard=document.getElementById('tourcard');
let tour=null, tourStep=0;
function startTour(id){
  const t=TOURS[id]; if(!t) return;
  if(activeStory) clearStory(false);
  resetFocus();
  if(mode!=='tree'){ mode='tree'; setModeButtons('tree'); render(); relabelAll(); }
  tour=t; tourStep=0;
  document.getElementById('ttitle').textContent=t.label;
  showTourStep();
}
function showTourStep(){
  const st=tour.steps[tourStep], n=nodeByName(st.name);
  document.getElementById('tname').innerHTML = st.name + (n&&n.common?` <em>${escp(n.common.split('—')[0].split('—')[0].trim())}</em>`:'');
  document.getElementById('ttext').textContent=st.text;
  document.getElementById('tstep').textContent=`${tourStep+1} / ${tour.steps.length}`;
  document.getElementById('tourdots').innerHTML=tour.steps.map((_,i)=>`<i class="${i===tourStep?'on':''}"></i>`).join('');
  document.getElementById('tprev').disabled=tourStep===0;
  document.getElementById('tnext').textContent = tourStep===tour.steps.length-1 ? 'Finish' : 'Next ›';
  tourcard.classList.add('show'); tourcard.inert=false;
  // on phones the panel becomes a bottom sheet that would stack under the tour card and
  // hide the highlighted node — keep the tour card as the single narrative surface there
  if(n) select(n, matchMedia('(max-width:680px)').matches ? {panel:false} : {});
}
function tourNext(){ if(!tour) return; if(tourStep<tour.steps.length-1){ tourStep++; showTourStep(); } else endTour(); }
function tourPrev(){ if(tour && tourStep>0){ tourStep--; showTourStep(); } }
function endTour(){ tour=null; tourcard.classList.remove('show'); tourcard.inert=true; }
document.getElementById('tnext').onclick=tourNext;
document.getElementById('tprev').onclick=tourPrev;
document.getElementById('texit').onclick=endTour;

