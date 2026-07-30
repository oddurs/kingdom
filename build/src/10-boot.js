// ---------- welcome / onboarding ----------
const welcome=document.getElementById('welcome');
function showWelcome(){ setOverlay(welcome, true, 'show'); const b=document.getElementById('wtour'); if(b) b.focus(); }
function hideWelcome(){ setOverlay(welcome, false, 'show'); try{localStorage.setItem('biomi_seen','1');}catch(e){} }
document.getElementById('wexplore').onclick=()=>{ hideWelcome(); maybeEntrance(); };
document.getElementById('wtour').onclick=()=>{ hideWelcome(); startTour('ascent'); };
document.getElementById('wsurprise').onclick=()=>{ hideWelcome(); surprise(); };
function initWelcome(){ let seen; try{ seen=localStorage.getItem('biomi_seen'); }catch(e){ seen='1'; }
  if(!seen && !location.hash){ showWelcome(); return true; } return false; }

// ---------- secondary pages (About, Controls) — one modal shell, swapped body ----------
const modal=document.getElementById('modal'), mbody=document.getElementById('mbody');
let lastFocus=null;
function openModal(html){
  lastFocus=document.activeElement;
  mbody.innerHTML=html;
  setOverlay(modal, true, 'show');
  if(typeof closeMenu==='function') closeMenu();
  modal.scrollTop=0; document.getElementById('mclose').focus();
}
function closeModal(){ if(!modal.classList.contains('show')) return;
  setOverlay(modal, false, 'show');
  if(lastFocus && lastFocus.focus) lastFocus.focus(); lastFocus=null;
}
document.getElementById('mclose').onclick=closeModal;
modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
// keep Tab inside an open overlay (the rest of the page can't be inerted — the overlay lives inside it)
function trapTab(e, box){ if(e.key!=='Tab') return;
  const f=[...box.querySelectorAll('a[href],button:not([disabled]),input,[tabindex="0"]')].filter(x=>x.offsetParent);
  if(!f.length) return; const first=f[0], last=f[f.length-1];
  if(e.shiftKey){ if(document.activeElement===first || !box.contains(document.activeElement)){ e.preventDefault(); last.focus(); } }
  else if(document.activeElement===last){ e.preventDefault(); first.focus(); } }
modal.addEventListener('keydown', e=>trapTab(e, modal));
welcome.addEventListener('keydown', e=>trapTab(e, welcome));
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && modal.classList.contains('show')){ e.stopPropagation(); closeModal(); } });

// the data lives beside the page on the published site, and in the repo locally
const DATA_BASE='https://raw.githubusercontent.com/oddurs/kingdom/main/data';
function aboutHTML(){
  const stat=(n,l)=>`<div class="pstat"><b>${n}</b><span>${l}</span></div>`;
  return `<h2>About Yggdrasil</h2>
    <p class="msub"><em>A living tree of the plant kingdom.</em></p>
    <p>I kept wanting to know where a plant I recognised sat among all the others &mdash; how a supermarket basil relates to an oak, and which of them has been here longer &mdash; and could never find out without reading three papers. So this is that answer, drawn.</p>
    <p>Every family of land plant, from mosses to orchids &mdash; each branch sized by how many species it holds and coloured by its lineage. One root divides into the great limbs of green life, from the earliest liverworts to the flowering plants that now dominate the land.</p>
    <div class="pstats" style="--lc:var(--accent)">
      ${stat('~'+totSppApprox,'species')}${stat(totFam.toLocaleString(),'families')}${stat(totGen.toLocaleString(),'genera')}
    </div>
    <div class="msec"><h3>The tree</h3>
      <p>The backbone follows current consensus classifications &mdash; <b>APG&nbsp;IV</b> for the flowering plants and <b>PPG&nbsp;I</b> for ferns and lycophytes. Ranks run from kingdom down through order and family, with accepted genera as the finest tier you can reach.</p></div>
    <div class="msec"><h3>The numbers</h3>
      <p>Species counts and native ranges come from Kew&rsquo;s <b>World Checklist of Vascular Plants</b>. Branch ages are read from a dated megatree of land plants, and each taxon links out to verified records where we hold them.</p>
      <p>Of the ~${totSppApprox} species here, <b>${totSourced}</b> are accepted names counted from WCVP. The remaining <b>~${totEstimated}</b> are estimates: 27 families that WCVP circumscribes differently, and every bryophyte class &mdash; WCVP covers vascular plants only, so the mosses, liverworts and hornworts carry round figures rather than counted ones. That is why the headline reads ~${totSppApprox} and not a six-digit number.</p>
      <p>Worth knowing: Kew&rsquo;s widely quoted ~390,000 refers to <em>vascular</em> plants. The ${totFam} families here sum to ${totVasc.toLocaleString()} vascular species; this tree reaches ~${totSppApprox} only by also counting the bryophytes, which Kew&rsquo;s figure excludes.</p></div>
    <div class="msec"><h3>Method</h3>
      <p><b>Ages.</b> Each lineage&rsquo;s age is computed, not looked up. We take the most recent common ancestor of a clade&rsquo;s tips in a dated megatree of 72,570 vascular-plant species (GBOTB.extended &mdash; Jin&nbsp;&amp;&nbsp;Qian 2022, building on Smith&nbsp;&amp;&nbsp;Brown 2018 and Zanne et&nbsp;al. 2014) and read its crown age. A small share of tips sit in the wrong clade in any megatree of that size, and one misplaced genus can age a family by tens of millions of years &mdash; so the outermost 0.5% are rejected before the MRCA is taken. That is why Asteraceae dates to ~45&nbsp;Ma here rather than a spurious 132. Lineages with a single descendant have no crown to date, so they carry a <em>stem</em> age instead; the panel says which you are looking at.</p>
      <p><b>Counts.</b> Species figures are <em>accepted</em> names from WCVP, not name records. That distinction matters: the GBIF backbone counts synonyms too and would inflate most families substantially, so those numbers are held separately and never displayed as richness.</p>
      <p><b>Ages are estimates, and they disagree.</b> Published divergence dates for the same clade routinely differ by tens of millions of years depending on calibration and method. Every age here is shown with a &ldquo;~&rdquo; for that reason, and should be read as one defensible estimate rather than a settled figure.</p>
      </div>
    <div class="msec"><h3>Known gaps</h3>
      <p>The things this tree does not do well, stated plainly:</p>
      <p>&bull; <b>${totEstFam} of ${totFam} families</b> carry estimated counts rather than WCVP tallies, because WCVP circumscribes them differently &mdash; it sinks Adoxaceae into Viburnaceae, and splits several fern families another way. Rather than force a bad match, those keep an approximate figure and are labelled as such.</p>
      <p>&bull; <b>Bryophytes are not covered by WCVP at all</b> &mdash; it is a checklist of vascular plants. The mosses, liverworts and hornworts here are resolved only to class, carry round estimated counts, and are absent from the dated megatree, so they have no ages.</p>
      <p>&bull; <b>${totUndatedFam} vascular families have no age</b>, having no sampled tips in the megatree.</p>
      <p>&bull; <b>The tree stops at genus.</b> You cannot reach an individual species; ${totGen.toLocaleString()} accepted genera are the finest tier.</p>
      </div>
    <div class="msec"><h3>Sources</h3>
      <div class="krow"><div class="kterm">Flowering plants</div><div class="kdesc">APG&nbsp;IV &mdash; <a class="ln" href="https://doi.org/10.1111/boj.12385" target="_blank" rel="noopener">Angiosperm Phylogeny Group, 2016</a></div></div>
      <div class="krow"><div class="kterm">Ferns &amp; lycophytes</div><div class="kdesc">PPG&nbsp;I &mdash; <a class="ln" href="https://doi.org/10.1111/jse.12229" target="_blank" rel="noopener">Pteridophyte Phylogeny Group, 2016</a></div></div>
      <div class="krow"><div class="kterm">Species &amp; range</div><div class="kdesc"><a class="ln" href="https://powo.science.kew.org/" target="_blank" rel="noopener">Kew WCVP / Plants of the World Online</a></div></div>
      <div class="krow"><div class="kterm">Identifiers</div><div class="kdesc"><a class="ln" href="https://www.gbif.org/" target="_blank" rel="noopener">GBIF</a> backbone</div></div>
    </div>
    <div class="msec"><h3>Take the data</h3>
      <p>All of it is <b>CC&nbsp;BY&nbsp;4.0</b> and downloadable &mdash; every count, age and distribution, with the per-field provenance that says which values are sourced and which are estimates.</p>
      <div class="krow"><div class="kterm">Taxonomy</div><div class="kdesc"><a class="ln" href="${DATA_BASE}/taxa.json" download>taxa.json</a> &mdash; 611 taxa, counts, ages, ranges</div></div>
      <div class="krow"><div class="kterm">Genera</div><div class="kdesc"><a class="ln" href="${DATA_BASE}/genera.json" download>genera.json</a> &mdash; ${totGen.toLocaleString()} accepted genera</div></div>
      <div class="krow"><div class="kterm">Terms</div><div class="kdesc"><a class="ln" href="https://github.com/oddurs/kingdom/blob/main/DATA-LICENSE" target="_blank" rel="noopener">DATA-LICENSE</a> &mdash; attribution, and every upstream source</div></div>
      </div>
    <div class="msec"><h3>Colophon</h3>
      <p>Built as a single self-contained page &mdash; no frameworks, no runtime dependencies, no tracking, no network calls. It renders ${totGen.toLocaleString()} genera from one HTML file and works offline. Names are set in Iowan&nbsp;Old&nbsp;Style, the interface in Hanken&nbsp;Grotesk. <a class="ln" href="https://github.com/oddurs/kingdom" target="_blank" rel="noopener">Source on GitHub</a> &mdash; the <a class="ln" href="https://github.com/oddurs/kingdom/blob/main/ARCHITECTURE.md" target="_blank" rel="noopener">architecture notes</a> explain how.</p></div>`;
}
function kbd(...keys){ return keys.map(k=>`<span class="kbd">${k}</span>`).join(' '); }
function controlsHTML(){
  const row=(t,d)=>`<div class="krow"><div class="kterm">${t}</div><div class="kdesc">${d}</div></div>`;
  return `<h2>Controls &amp; shortcuts</h2>
    <p class="msub">Move through the tree by mouse, touch, or keyboard.</p>
    <div class="msec"><h3>Navigate</h3>
      ${row('Pan','Drag anywhere on the canvas &mdash; or drag inside the overview minimap to leap.')}
      ${row('Zoom','Scroll or pinch, or use the '+kbd('+')+kbd('&minus;')+' pill. Zoom in and deeper names surface.')}
      ${row('Reframe','<b>Fit</b> reframes the whole tree in view.')}
    </div>
    <div class="msec"><h3>Explore</h3>
      ${row('Open a branch','Click it for a detail card &mdash; story, origin, range and links.')}
      ${row('Focus a clade','&ldquo;Focus subtree&rdquo; dives into one lineage; the focus bar takes you back up.')}
      ${row('Quick look','Hover a branch for a tooltip.')}
      ${row('Find','Type a family or plant into search; '+kbd('&uarr;')+kbd('&darr;')+' to pick, '+kbd('&crarr;')+' to jump.')}
      ${row('Surprise me','Fly to a remarkable corner of the tree &mdash; '+kbd('R')+', or Explore &rsaquo; Surprise me.')}
    </div>
    <div class="msec"><h3>Keyboard</h3>
      ${row(kbd('&uarr;')+kbd('&darr;'),'Previous / next branch')}
      ${row(kbd('&rarr;'),'Expand &mdash; go deeper')}
      ${row(kbd('&larr;'),'Collapse &mdash; go up a level')}
      ${row(kbd('Esc'),'Close panels, menus and pages')}
      ${row(kbd('&larr;')+kbd('&rarr;'),'Step through time (on the timeline)')}
    </div>
    <div class="msec"><h3>Views</h3>
      ${row('Four ways','<b>Tree</b>, <b>Radial</b> and <b>Sunburst</b> show kinship; <b>Treemap</b> sizes by richness. Switch anytime &mdash; they morph.')}
    </div>`;
}
document.getElementById('btnAbout').onclick=()=>openModal(aboutHTML());
document.getElementById('btnKeys').onclick=()=>openModal(controlsHTML());
// signature entrance: the tree grows out from its root once, when first revealed (D5)
let didEntrance=false;
function maybeEntrance(){ if(didEntrance) return; didEntrance=true; setTimeout(entranceGrow, 130); }
function entranceGrow(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches || (mode!=='tree'&&mode!=='radial') || selected) return;
  const saved=new Map(); eachNode(n=>{ if((n.children||[]).length) saved.set(n._id, n.open); });
  eachNode(n=>{ if((n.children||[]).length) n.open=false; });   // collapse to the root...
  render();
  animateStructural(()=>{ for(const [id,v] of saved) idMap.get(id).open=v; }, {fit:false, dur:820});  // ...then unfurl
}

// ---------- superlatives, rank & neighbours (Sprint I) ----------
const _fams=[], _ords=[];
eachNode(n=>{ if(n.rank==='family') _fams.push(n); else if(n.rank==='order') _ords.push(n); });
const _regionCount=n=>{ const d=n.distAgg||{}; let k=0; for(const c in d) if(d[c]>0) k++; return k; };
const _mx=(a,f)=>a.reduce((x,y)=>f(y)>f(x)?y:x);
const badgeMap=new Map();
function _award(node,label){ if(!badgeMap.has(node._id)) badgeMap.set(node._id,[]); badgeMap.get(node._id).push(label); }
_award(_mx(_fams,n=>n.agg),'Largest plant family');
_award(_mx(_fams,n=>n.genCount),'Most genera of any family');
_award(_mx(_fams,_regionCount),'Most widespread family');
_award(_mx(_fams,n=>n.effAge||0),'Oldest surviving family');
_award(_mx(_ords,n=>n.agg),'Largest order');
_award(_mx(_ords,n=>n.famCount),'Most families of any order');
// records that jump you to the holder (Explore → Records)
const RECORDS_LIST=[
  ['Largest family', _mx(_fams,n=>n.agg)], ['Most widespread', _mx(_fams,_regionCount)],
  ['Oldest family', _mx(_fams,n=>n.effAge||0)], ['Most genera', _mx(_fams,n=>n.genCount)],
  ['Largest order', _mx(_ords,n=>n.agg)], ['Most families', _mx(_ords,n=>n.famCount)],
];
const _rankMap=new Map();
_fams.slice().sort((a,b)=>b.agg-a.agg).forEach((n,i)=>_rankMap.set(n._id,i+1));
_ords.slice().sort((a,b)=>b.agg-a.agg).forEach((n,i)=>_rankMap.set(n._id,i+1));
function ordinal(k){ const s=['th','st','nd','rd'], v=k%100; return k+(s[(v-20)%10]||s[v]||s[0]); }
function rankContext(n){ const r=_rankMap.get(n._id); if(!r) return '';
  if(n.rank==='family') return `${ordinal(r)}-largest of ${_fams.length} families`;
  if(n.rank==='order') return `${ordinal(r)}-largest of ${_ords.length} orders`; return ''; }
function siblingsOf(n){ return n.parent ? n.parent.children.filter(c=>c!==n && c.rank===n.rank).sort((a,b)=>b.agg-a.agg) : []; }

// ---------- Wonder: take me somewhere remarkable (Sprint P) ----------
// A newcomer faces 479 families and no idea where to look. "Surprise me" flies to a genuinely
// notable taxon — weighted toward record holders, story stars and big, storied families, never a
// random empty genus — and names why it's worth seeing. A transient toast carries that reason.
let _toastT=null;
function toast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=`<span class="spark" aria-hidden="true">&#10022;</span> ${escp(msg)}`;
  t.hidden=false; requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(_toastT); _toastT=setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>{ t.hidden=true; }, 320); }, 2800);
}
const _storyOf=new Map();                        // taxon name → the story it stars in
for(const s of Object.values(STORIES)) for(const nm of (s.names||[])) _storyOf.set(nm, s.label);
const wonderPool=[];
eachNode(n=>{
  let w=0;
  if(badgeMap.has(n._id)) w+=6;                  // a record holder — the headline sights
  if(_storyOf.has(n.name)) w+=4;                 // a star of a curated story (carnivores, crops…)
  if(n.blurb) w+=3;                              // has a written story to read
  if(n.examples && n.examples.length) w+=2;
  if(n.common) w+=1;
  if(n.rank==='family' && n.agg>=2000) w+=2;     // the big, familiar families
  if(w>0) wonderPool.push([n,w]);
});
const _wonderTotal=wonderPool.reduce((s,x)=>s+x[1],0);
let _lastWonder=null;
function wonderReason(n){
  const b=badgeMap.get(n._id); if(b && b.length) return b[0];
  if(_storyOf.has(n.name)) return _storyOf.get(n.name);
  const rc=rankContext(n); if(rc) return rc[0].toUpperCase()+rc.slice(1);
  if(n.rank==='family') return `A family of ~${n.agg.toLocaleString()} species`;
  return n.common || n.name;
}
function surprise(){
  if(!wonderPool.length) return;
  let pick=null;
  for(let tries=0; tries<8; tries++){
    let r=Math.random()*_wonderTotal, cand=null;
    for(const [n,w] of wonderPool){ r-=w; if(r<=0){ cand=n; break; } }
    pick=cand; if(pick && pick!==_lastWonder) break;   // don't land on the same taxon twice running
  }
  if(!pick) return;
  _lastWonder=pick;
  clearSearch();
  if(activeStory) clearStory(false);
  const go=()=>{ select(pick); toast(wonderReason(pick)); };
  if(renderRoot!==ROOT){ exitFocus(); setTimeout(go, 420); }   // come back up so any taxon is reachable
  else go();
}

// ---------- colour legend + highlight/tour menus + footer ----------
// The controls live in header popover menus (see #menu-colour / #menu-explore); this
// just populates the pre-placed #cmode / #lgswatches / #stories / #toursbar elements.
const order=['bryo','fern','gymno','basal','mono','rosid','asterid','eudicot'];
const LGTITLE={lineage:'Lineage', age:'Origin · period', region:'Native region'};
const NODATA_SW=`<span class="lg" data-sp="none"><span class="dot" style="color:${UNCOL}"></span>No data</span>`;
function legendSwatches(){
  if(colorMode==='age')
    return GEOP.map((p,i)=>`<span class="lg" data-sp="age:${i}"><span class="dot" style="color:${p[3]}"></span>${p[0]}</span>`).join('')+NODATA_SW;
  if(colorMode==='region')
    return Object.keys(CONTINENT_COL).map(c=>`<span class="lg" data-sp="reg:${c}"><span class="dot" style="color:${CONTINENT_COL[c]}"></span>${CONTINENTS[c]}</span>`).join('')+NODATA_SW;
  return order.map(id=>`<span class="lg" data-sp="lin:${id}"><span class="dot" style="color:${cssVar(LINEAGES[id].c)}"></span>${LINEAGES[id].label}</span>`).join('');
}
// colorMode's single owner: the legend and every mounted node and link have to
// move together. Three sites used to assign it and only rebuild the legend.
function setColorMode(c){ colorMode=c; buildColorUI(); repaintAll(); }
function buildColorUI(){
  // The switcher renders into every host that exists rather than one fixed id:
  // it lives in the legend (beside the key that explains what the colours mean)
  // and, because the legend is hidden on phones, in the overflow menu there too.
  const chips=CMODES.map(([id,l])=>
    `<button class="schip${id===colorMode?' on':''}" data-cmode="${id}" aria-pressed="${id===colorMode}">${l}</button>`).join('');
  document.querySelectorAll('[data-cmode-host]').forEach(h=>{ h.innerHTML=chips; });
  document.getElementById('lgtitle').textContent=LGTITLE[colorMode]||'Colour';
  document.getElementById('lgitems').innerHTML=legendSwatches();
}
// hovering a legend entry spotlights the matching taxa in the tree (reuses the .focusing/.lit dim)
function nodeMatchesSp(sp, n){
  if(sp==='none') return color(n)===UNCOL;
  const i=sp.indexOf(':'), k=sp.slice(0,i), v=sp.slice(i+1);
  if(k==='lin') return n.lineage===v;
  if(k==='age'){ const a=n.ageMy!=null?n.ageMy:n.effAge; return a!=null && periodOf(a)===GEOP[+v]; }
  if(k==='reg') return regionCentre(n)===v;
  return false; }
function legendSpotlight(sp){
  if(!sp){ stage.classList.remove('focusing'); document.querySelectorAll('#nodes .node.lit').forEach(e=>e.classList.remove('lit')); return; }
  stage.classList.add('focusing');
  for(const [id,el] of nodeEls){ const n=idMap.get(id); if(n) el.classList.toggle('lit', nodeMatchesSp(sp,n)); }
}
buildColorUI();
// delegated at the document, since the switcher now has more than one host and
// buildColorUI() replaces their contents on every change
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-cmode]'); if(!b) return;
  if(b.dataset.cmode===colorMode) return;
  setColorMode(b.dataset.cmode);
  render(); relabelAll();
  if(selected) select(selected,{center:false});
  updateHash();
});
const lgitemsEl=document.getElementById('lgitems');
lgitemsEl.addEventListener('mouseover', e=>{ const lg=e.target.closest('.lg'); if(lg&&lg.dataset.sp){
  lgitemsEl.querySelectorAll('.lg.on').forEach(x=>x.classList.remove('on')); lg.classList.add('on'); legendSpotlight(lg.dataset.sp); } });
lgitemsEl.addEventListener('mouseleave', ()=>{ lgitemsEl.querySelectorAll('.lg.on').forEach(x=>x.classList.remove('on')); legendSpotlight(null); });
const storiesEl=document.getElementById('stories');
storiesEl.innerHTML = '<span class="slabel">Highlight</span>'
  + Object.entries(STORIES).map(([id,s])=>`<button class="schip" data-story="${id}">${s.label}</button>`).join('')
  + '<button class="schip clear" data-story="_clear">Clear</button>';
storiesEl.addEventListener('click', e=>{ const b=e.target.closest('.schip'); if(!b) return;
  if(b.dataset.story==='_clear'){ clearStory(); } else { setStory(b.dataset.story); } });
// Records: jump straight to each superlative holder (Sprint I)
const recordsbar=document.getElementById('recordsbar');
recordsbar.innerHTML = '<span class="slabel">Records</span>'
  + RECORDS_LIST.map(([label,node],i)=>`<button class="schip" data-rec="${i}" title="${node.name}">${label}</button>`).join('');
recordsbar.addEventListener('click', e=>{ const b=e.target.closest('.schip'); if(!b) return; const rec=RECORDS_LIST[+b.dataset.rec]; if(rec) select(rec[1]); });
const toursbar=document.getElementById('toursbar');
toursbar.innerHTML = '<span class="slabel">Tours</span>'
  + Object.entries(TOURS).map(([id,t])=>`<button class="schip tour" data-tour="${id}">${t.label}</button>`).join('');
toursbar.addEventListener('click', e=>{ const b=e.target.closest('.schip'); if(b) startTour(b.dataset.tour); });
document.getElementById('btnSurprise').onclick=surprise;

// ---------- filter: query the tree by facets (Sprint K) ----------
const filter={rich:null, lineage:null, region:null, age:null};
const F_RICH=[['Any',null],['>100',100],['>1,000',1000],['>5,000',5000]];
const F_AGE=[['Any',null],['Ancient · >100 Ma','ancient'],['Recent · <66 Ma','recent']];
const _fchips=(items,facet,cur)=>items.map(([label,val])=>
  `<button class="schip${val===cur?' on':''}" data-facet="${facet}" data-val="${val===null?'':val}">${label}</button>`).join('');
function buildFilterUI(){
  document.getElementById('f-rich').innerHTML=_fchips(F_RICH,'rich',filter.rich);
  document.getElementById('f-lin').innerHTML=_fchips([['Any',null]].concat(order.map(id=>[LINEAGES[id].label,id])),'lineage',filter.lineage);
  document.getElementById('f-reg').innerHTML=_fchips([['Any',null]].concat(Object.keys(CONTINENT_COL).map(c=>[CONTINENTS[c],c])),'region',filter.region);
  document.getElementById('f-age').innerHTML=_fchips(F_AGE,'age',filter.age);
}
buildFilterUI();
function filterMatches(){
  const out=[];
  eachNode(n=>{ if(n.rank!=='family') return;
    if(filter.rich && n.agg<filter.rich) return;
    if(filter.lineage && n.lineage!==filter.lineage) return;
    if(filter.region && !(n.distAgg && n.distAgg[filter.region]>0)) return;
    if(filter.age){ const a=n.ageMy!=null?n.ageMy:n.effAge;
      if(filter.age==='ancient' && !(a!=null && a>=100)) return;
      if(filter.age==='recent' && !(a!=null && a<66)) return; }
    out.push(n); });
  return out;
}
function applyFilter(){
  const active=filter.rich||filter.lineage||filter.region||filter.age;
  const fc=document.getElementById('fcount');
  if(!active){ if(activeStory==='_filter') clearStory(); fc.textContent='Set a facet to light up the matches'; return; }
  const ns=filterMatches();
  fc.textContent = ns.length ? (ns.length+' famil'+(ns.length===1?'y':'ies')+' match') : 'No families match';
  if(ns.length) highlightSet(ns, 'Filtered families', '_filter', false); else clearStory(false);
}
function clearFilter(){ filter.rich=filter.lineage=filter.region=filter.age=null; buildFilterUI();
  if(activeStory==='_filter') clearStory(); document.getElementById('fcount').textContent='Set a facet to light up the matches'; updateHash(); }
['f-rich','f-lin','f-reg','f-age'].forEach(gid=>document.getElementById(gid).addEventListener('click', e=>{
  const b=e.target.closest('[data-facet]'); if(!b) return; const facet=b.dataset.facet, raw=b.dataset.val;
  filter[facet] = raw==='' ? null : (facet==='rich' ? +raw : raw);
  buildFilterUI(); applyFilter(); updateHash(); }));
document.getElementById('fclear').onclick=clearFilter;

let totFam=0, totGen=0, totVasc=0, totEstFam=0, totUndatedFam=0, totSpp=ROOT.agg;
(function w(n){ if(n.rank==='family'){ totFam++; totVasc+=n.speciesCount||0;
    if(n.est) totEstFam++; if(n.ageMy==null) totUndatedFam++; }
  else if(n.rank==='genus') totGen++; (n.children||[]).forEach(w); })(ROOT);
// 6.2% of the total is round estimates — the 27 families WCVP circumscribes
// differently, plus every bryophyte class (Bryopsida alone is a flat 11,000, 2.8%
// of the headline). Printing 389,873 claims a precision the data doesn't have, so
// the headline carries two significant figures and the split is stated beside it.
const TOTALS = DATA.totals || {sourced:totSpp, estimated:0};
const totSppApprox = (Math.round(totSpp/10000)*10000).toLocaleString();
const totSourced = TOTALS.sourced.toLocaleString();
const totEstimated = (Math.round(TOTALS.estimated/1000)*1000).toLocaleString();
const provenanceNote = `~${totSppApprox} species — ${totSourced} accepted names from Kew WCVP, `+
  `~${totEstimated} estimated (27 families WCVP circumscribes differently, and the bryophyte `+
  `classes, which WCVP does not cover)`;
// The family and order counts double as the crawl path to the static taxon pages
// (build/pages.py). Without a visible link from here those 567 documents are
// orphans reachable only via the sitemap, which is the weakest signal there is —
// and a reader who wants a plain page to read or link deserves the door too.
document.getElementById('footer').innerHTML =
  `<span><a class="fx" href="/families/"><span class="k">families</span> <b>${totFam}</b></a></span>`+
  `<span><span class="k">genera</span> <b>${totGen.toLocaleString()}</b></span>`+
  `<span><a class="fx" href="/orders/"><span class="k">orders</span> <b>86</b></a></span>`+
  `<span title="${provenanceNote}"><span class="k">species catalogued</span> <b>~${totSppApprox}</b></span>`+
  // About was the least discoverable surface in the app — behind an unlabelled
// ellipsis — while being the one that has to carry the project's credibility.
// The footer already names the sources; now it lets you ask about them.
`<button class="k src fx" id="btnSourcesAbout" title="About Yggdrasil, the data &amp; sources">Sources: APG IV &middot; PPG I &middot; Kew WCVP &middot; GBIF</button>`;
document.getElementById('footer').addEventListener('click', e=>{ if(e.target.closest('#btnSourcesAbout')) openModal(aboutHTML()); });

// ---------- the first five seconds ----------
// The welcome used to open by explaining the interface. Someone arriving cold
// does not yet care how the controls work; they care whether there is anything
// here worth knowing. So it opens with a fact instead — derived from the data,
// so it cannot drift away from what the tree actually shows.
(function openWithAFact(){
  const lead=document.querySelector('.welcome .lead'); if(!lead) return;
  let oldest=null, biggest=null;
  eachNode(n=>{
    if(n.rank!=='family') return;
    if(n.ageMy!=null && (!oldest || n.ageMy>oldest.ageMy)) oldest=n;
    if(n.speciesCount && (!biggest || n.speciesCount>biggest.speciesCount)) biggest=n;
  });
  if(!oldest||!biggest) return;
  const share=Math.round(totVasc/biggest.speciesCount);
  lead.innerHTML =
    `<b>${escp(oldest.name)}</b> — the ginkgos — have stood for about `+
    `<b>${Math.round(oldest.ageMy)} million years</b>, and one species is all that is left of them. `+
    `<b>${escp(biggest.name)}</b> holds ${biggest.speciesCount.toLocaleString()} — roughly one plant in ${share}. `+
    `Both are on this tree, with every other family of land plant.`;
})();

// ---------- header popover menus (G2) ----------
let openMenu=null;
function closeMenu(){ if(!openMenu) return;
  const btn=document.querySelector(`[data-menu="${openMenu.dataset.for}"]`); if(btn) btn.setAttribute('aria-expanded','false');
  // hand focus back to the trigger — dropping it to <body> sends a keyboard
  // user to the top of the document, but only steal it if it was ours to begin with
  const back=btn && openMenu.contains(document.activeElement);
  openMenu.hidden=true; openMenu.classList.remove('open'); openMenu=null;
  if(back) btn.focus(); }
function toggleMenu(name){
  const m=document.getElementById('menu-'+name), btn=document.querySelector(`[data-menu="${name}"]`);
  if(!m||!btn) return;
  if(openMenu===m){ closeMenu(); return; }
  closeMenu();
  m.dataset.for=name; m.hidden=false; m.classList.add('open');
  const r=btn.getBoundingClientRect(), mw=m.getBoundingClientRect().width;   // now measurable
  m.style.top=(r.bottom+8)+'px';
  m.style.left=Math.max(12, Math.min(r.right-mw, innerWidth-mw-12))+'px';    // right-align to the button, clamp on-screen
  btn.setAttribute('aria-expanded','true'); openMenu=m;
}
document.addEventListener('click', e=>{
  const trig=e.target.closest('[data-menu]');
  if(trig){ e.stopPropagation(); toggleMenu(trig.dataset.menu); return; }
  if(!openMenu) return;
  if(e.target.closest('.menu')){                       // a click inside the open menu
    if(e.target.closest('button') && !e.target.closest('[data-cmode],[data-facet],#btnShare')) closeMenu();   // an action closes it; colour, filter & the share confirmation stay
    return;
  }
  closeMenu();                                          // click outside closes
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && openMenu){ closeMenu(); } });
window.addEventListener('resize', ()=>{ if(openMenu) closeMenu(); });

// ---------- PNG / poster export ----------
function contentBBox(){
  try{
    if(mode==='treemap'||mode==='sunburst') return gTree.getBBox();
    const a=gLinks.getBBox(), b=gNodes.getBBox();
    const x0=Math.min(a.x,b.x), y0=Math.min(a.y,b.y);
    return {x:x0, y:y0, width:Math.max(a.x+a.width,b.x+b.width)-x0, height:Math.max(a.y+a.height,b.y+b.height)-y0};
  }catch(e){ return {x:0,y:0,width:1500,height:900}; }
}
function exportStyle(){
  const serif=cssVar('--serif'), sans=cssVar('--sans');
  const root=':root{'+['--ground','--ink','--dim','--faint','--line','--l-root'].map(v=>v+':'+cssVar(v)).join(';')+'}';
  return root+
    `.link{fill:none;stroke:var(--lc,var(--line));stroke-opacity:.34;stroke-width:1.4px}`+
    `.node circle.dot{fill:var(--ground);stroke:var(--lc,var(--l-root));stroke-width:1.8px}`+
    `.node.branch circle.dot{fill:var(--lc,var(--l-root))}.node.open circle.dot{fill:var(--ground)}`+
    `.node .halo{opacity:0}`+
    `.node text{font-family:${serif};font-size:12.5px;fill:var(--ink);paint-order:stroke;stroke:var(--ground);stroke-width:3px;stroke-linejoin:round;dominant-baseline:middle}`+
    `.node text tspan.common{font-family:${sans};font-size:10px;fill:var(--dim)}`+
    `.node .toggle{fill:none;stroke:var(--ground);stroke-width:1.6px;stroke-linecap:round}`+
    `.node.lodhide text{opacity:0}`+
    `text.tml{font-family:${sans};font-size:10px;fill:#0e1013;font-weight:600}`+
    `text.tmv{font-family:${sans};font-size:8.5px;fill:#0e101399}`+
    `text.tmh{font-family:${sans};font-size:9px;letter-spacing:.5px;text-transform:uppercase}`+
    `text.sbl{font-family:${sans};font-size:10px;fill:#0e1013;font-weight:600;dominant-baseline:middle}`+
    `text.sbc{font-family:${serif};fill:${cssVar('--ink')};text-anchor:middle;dominant-baseline:middle}`;
}
function buildExportSVG(){
  const bb=contentBBox(), pad=32;
  const x=bb.x-pad, y=bb.y-pad, w=Math.max(bb.width+pad*2,10), h=Math.max(bb.height+pad*2,10);
  const clone=svg.cloneNode(true);
  const cv=clone.querySelector('#viewport');
  cv.setAttribute('transform','translate(0,0) scale(1)');
  cv.style.opacity='1';                       // never capture a mid-entrance-fade opacity
  clone.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  clone.setAttribute('width', Math.round(w)); clone.setAttribute('height', Math.round(h));
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const st=document.createElementNS(NS,'style'); st.textContent=exportStyle();
  const bg=document.createElementNS(NS,'rect');
  bg.setAttribute('x',x.toFixed(1)); bg.setAttribute('y',y.toFixed(1));
  bg.setAttribute('width',w.toFixed(1)); bg.setAttribute('height',h.toFixed(1)); bg.setAttribute('fill',cssVar('--ground'));
  const cvp=clone.querySelector('#viewport'); cvp.parentNode.insertBefore(bg, cvp);
  clone.insertBefore(st, clone.firstChild);
  return {str:new XMLSerializer().serializeToString(clone), w, h};
}
function exportPNG(){
  const {str,w,h}=buildExportSVG();
  const url=URL.createObjectURL(new Blob([str],{type:'image/svg+xml;charset=utf-8'}));
  const img=new Image();
  const btn=document.getElementById('btnExport'); const label=btn.textContent;
  btn.textContent='Rendering…';
  img.onload=()=>{
    const scale=2, cv=document.createElement('canvas'); cv.width=Math.round(w*scale); cv.height=Math.round(h*scale);
    const ctx=cv.getContext('2d'); ctx.scale(scale,scale); ctx.drawImage(img,0,0); URL.revokeObjectURL(url);
    cv.toBlob(b=>{ const a=document.createElement('a'); a.download='plant-kingdom-'+mode+'.png';
      a.href=URL.createObjectURL(b); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      btn.textContent='Saved ✓'; setTimeout(()=>btn.textContent=label,1400); },'image/png');
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); btn.textContent='Export failed'; setTimeout(()=>btn.textContent=label,1400); };
  img.src=url;
}
document.getElementById('btnExport').onclick=exportPNG;

// ---------- time scrubber: grow the tree through geological time ----------
const timebar=document.getElementById('timebar'), tbtrack=document.getElementById('tbtrack'),
      tbfill=document.getElementById('tbfill'), tbbands=document.getElementById('tbbands'),
      tblabel=document.getElementById('tblabel'), tbplay=document.getElementById('tbplay'),
      tbhint=document.querySelector('.tbhint'),
      btnTime=document.getElementById('btnTime');
const TFADE=14;   // Ma over which a lineage blooms in after its origin
function ageOpacity(a, T){ if(a==null) return 1; if(T>a) return 0; return Math.min(1,(a-T)/TFADE); }
// ---------- the frame follows the living tree ----------
// Time was implemented as opacity alone: nodes faded but kept their present-day
// positions, so running the clock backwards dissolved a photograph and left the
// negative space behind. At 340 Ma that was 19 of 132 nodes in one corner of an
// otherwise empty canvas. The viewport now eases toward a fit on the lineages
// that have actually originated, so the tree grows into the frame.
const TIME_EASE=0.075;        // per-frame approach; low enough to drift, not snap
let timeFitRAF=0, timeHandOff=false, timeLastPeriod=null;
// What the frame follows: lineages we can actually place in time. Undated nodes
// stay on screen (they are marked as undated, not hidden) but must NOT drive the
// fit — every one of the 14k genera is undated, so counting them would make the
// "living tree" the whole tree and the frame would never close in.
// The timeline asks "when does this lineage first appear", and only effAge answers
// it consistently: it is the max over the subtree, so a parent never appears later
// than its earliest child. `ageMy ?? effAge` is a different question — "what is this
// taxon's own dated age" — which the panel asks, and labels with its provenance
// (crown / stem / oldest dated descendant). Mixing them is what broke this: the
// render stamped __age = effAge while the readout used ageMy, so at 100 Ma Lamiales
// (crown 71.0, effAge 135.8) was drawn at full opacity and excluded from the count
// describing the same screen. Twelve taxa diverge, all of them headline clades.
function livingNodes(){
  const out=[];
  for(const n of visibleNodes) if(n.effAge!=null && timeNow<=n.effAge) out.push(n);
  return out;
}
function timeFrameStep(){
  timeFitRAF=0;
  if(!timeMode || timeHandOff) return;
  // Before ~391 Ma nothing DATED has originated — the oldest crown age in the
  // tree is the vascular plants — so the only things on screen are the undated
  // bryophytes. Frame those rather than freezing on the last fit; it is still
  // honest, since we are framing what is actually visible.
  let alive=livingNodes();
  if(alive.length<2) alive=visibleNodes.filter(n=>n.effAge==null);
  if(alive.length<2) return;
  const tgt=computeFitT(alive, mode);
  // settle rather than jitter: stop once the remaining move is sub-pixel
  if(Math.abs(tgt.x-T.x)+Math.abs(tgt.y-T.y)+Math.abs(tgt.k-T.k)*1200 < 0.7) return;
  T.x+=(tgt.x-T.x)*TIME_EASE; T.y+=(tgt.y-T.y)*TIME_EASE; T.k+=(tgt.k-T.k)*TIME_EASE;
  applyT();
  timeFitRAF=requestAnimationFrame(timeFrameStep);
}
function nudgeTimeFrame(){
  // This owns timeLastPeriod. setTime() used to assign it before calling here,
  // which made the "has the period changed?" test below always false — so the
  // reduced-motion reframe never fired at all.
  const per=periodOf(timeNow)[0];
  const crossed = per!==timeLastPeriod;
  timeLastPeriod=per;
  if(!timeMode || timeHandOff) return;
  // under reduced motion the frame must not drift continuously — reframe once,
  // instantly, when the clock crosses into a new geological period
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){
    if(crossed){ const alive=livingNodes(); if(alive.length>=2){ T=computeFitT(alive, mode); applyT(); } }
    return;
  }
  if(!timeFitRAF) timeFitRAF=requestAnimationFrame(timeFrameStep);
}
// Never fight the hand on the canvas: a pan or a zoom hands the frame to the
// user, and the clock takes it back only once it reaches a new period.
function releaseTimeFrame(){ if(timeMode) timeHandOff=true; }
stage.addEventListener('pointerdown', releaseTimeFrame, true);
stage.addEventListener('wheel', releaseTimeFrame, {capture:true, passive:true});

function applyTime(){
  const pulse = playing || tbDrag;
  const deepTime = timeNow>0.5;   // same 'at now' threshold play() uses   // only mark births while advancing time, not on the initial paint
  for(const [nid,el] of nodeEls){ const o=ageOpacity(el.__age,timeNow), born=o>0.5;
    // A null age is not an age. These lineages are visible at every instant only
    // because ageOpacity returns 1 for null — the clock cannot say when they
    // began, so they are drawn as undated rather than silently dated.
    // Only while the clock is actually in deep time. The dashes answer "we cannot
    // say when this began" — a question the timeline stops asking at the present,
    // where every lineage exists and nothing is uncertain. Marking them at 0 Ma
    // made 17 nodes read as broken in the view that is simply today.
    el.classList.toggle('undated', deepTime && el.__age==null && el.__node && el.__node.rank!=='genus');
    if(pulse && born && !el.__born && el.__age!=null){ const n=idMap.get(nid); if(n) ripple(n); }
    el.__born=born; el.style.opacity=o; el.style.pointerEvents=o<0.5?'none':''; }
  for(const el of linkEls.values()){ el.style.opacity=ageOpacity(el.__age,timeNow); }
  updateTimeReadout();
}

// ---------- what is true at this instant ----------
// Counts LINEAGES ORIGINATED, never species. A family's species count is its
// count today; we have no idea what it was in the Carboniferous, and quoting one
// would fabricate exactly what Sprint V spent its time removing. Nothing in this
// data goes extinct either, so the copy says "originated", not "alive".
function timeReadout(){
  let originated=0, undated=0, newest=null, newestGap=1e9;
  for(const n of visibleNodes){
    const rankCounts = n.rank!=='genus';   // genera would swamp the count
    const a = n.effAge;                    // the drawing's age — see livingNodes()
    if(a==null){ if(rankCounts) undated++; continue; }
    if(timeNow<=a){
      if(rankCounts) originated++;
      const gap=a-timeNow;                       // most recently originated lineage
      if(gap>=0 && gap<newestGap && n.rank!=='genus'){ newestGap=gap; newest=n; }
    }
  }
  return {originated, undated, newest, newestGap};
}
// The footer went on describing the present day over a canvas in the Carboniferous.
// It follows the clock now — in lineages, never species: a family's species count
// is its count TODAY, and quoting one for 340 Ma would be invention.
const footerEl=document.getElementById('footer');
let footerPresent=null;
function updateTimeFooter(){
  if(!timeMode){ if(footerPresent!=null){ footerEl.innerHTML=footerPresent; footerPresent=null; } return; }
  if(footerPresent==null) footerPresent=footerEl.innerHTML;
  const r=timeReadout(), per=periodOf(timeNow);
  footerEl.innerHTML =
    `<span><span class="k">at</span> <b>${Math.round(timeNow)} Ma</b></span>`+
    `<span><span class="k">period</span> <b>${escp(per[0])}</b></span>`+
    `<span><span class="k">lineages originated</span> <b>${r.originated}</b></span>`+
    (r.undated?`<span><span class="k">undated</span> <b>${r.undated}</b></span>`:'')+
    `<span class="k src">counts are lineages, not species — species totals are present-day</span>`;
}

function updateTimeReadout(){
  const r=timeReadout(), per=periodOf(timeNow);
  const era = timeNow>252 ? 'Palaeozoic' : timeNow>66 ? 'Mesozoic' : 'Cenozoic';
  const bits=[`<b>${per[0]}</b> <span class="tbera">${era}</span>`,
              `${r.originated} lineage${r.originated===1?'':'s'} originated`];
  if(r.newest && r.newestGap<25) bits.push(`newest: <b>${escp(r.newest.name)}</b>`);
  if(r.undated) bits.push(`<span class="tbund">${r.undated} undated</span>`);
  tbhint.innerHTML=bits.join(' <span class="tbsep">·</span> ');
  updateTimeFooter();
}
// The periods ARE the story and they were anonymous colour smears. Name them in
// place where the band is wide enough, abbreviate where it isn't (the Quaternary
// is 0.6% of the axis), and rule the three eras across the top so the shape of
// deep time reads without knowing a single period name.
const ERAS=[['Palaeozoic',TMAX,252],['Mesozoic',252,66],['Cenozoic',66,0]];
function buildBands(){
  tbbands.innerHTML = GEOP.map(p=>{
    const left=(TMAX-p[1])/TMAX*100, w=(p[1]-p[2])/TMAX*100;
    const label = w>7 ? p[0] : (w>3.2 ? p[0].slice(0,4) : '');
    return `<div class="bd" data-per="${escp(p[0])}" style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%;background:${p[3]}" title="${escp(p[0])} ${p[1]}–${p[2]} Ma">`
      + (label?`<span>${escp(label)}</span>`:'') + `</div>`;
  }).join('');
  const eras=ERAS.map(([n,a,b])=>{
    const left=(TMAX-a)/TMAX*100;
    return `<i style="left:${left.toFixed(2)}%">${n}</i>`;
  }).join('');
  let rule=tbtrack.querySelector('.tberas');
  if(!rule){ rule=document.createElement('div'); rule.className='tberas'; tbtrack.appendChild(rule); }
  rule.innerHTML=eras;
  markCurrentBand();
}
function markCurrentBand(){
  const now=periodOf(timeNow)[0];
  tbbands.querySelectorAll('.bd').forEach(b=>b.classList.toggle('now', b.dataset.per===now));
}
function setTime(t){
  timeNow=Math.max(0,Math.min(TMAX,t));
  tbfill.style.width=(timeNow/TMAX*100).toFixed(2)+'%';   // curtain covers the not-yet-reached future
  const per=periodOf(timeNow);
  if(tbbands.children.length) markCurrentBand();
  tblabel.innerHTML=`${Math.round(timeNow)} Ma <span class="per">· ${per[0]}</span>`;
  tbtrack.setAttribute('aria-valuenow', Math.round(timeNow));
  tbtrack.setAttribute('aria-valuetext', timeNow<1 ? 'Present day' : Math.round(timeNow)+' million years ago, '+per[0]);
  if(timeMode){
    // crossing into a new period is where the clock reclaims a frame the user took
    if(timeHandOff && per[0]!==timeLastPeriod) timeHandOff=false;
    applyTime();
    nudgeTimeFrame();          // owns timeLastPeriod — see the note there
  }
}
function trackTime(clientX){ const r=tbtrack.getBoundingClientRect();
  return TMAX*(1-Math.max(0,Math.min(1,(clientX-r.left)/r.width))); }
let tbDrag=false;
tbtrack.addEventListener('pointerdown', e=>{ e.stopPropagation(); pausePlay(); tbDrag=true;
  tbtrack.setPointerCapture(e.pointerId); setTime(trackTime(e.clientX)); });
tbtrack.addEventListener('pointermove', e=>{ if(tbDrag){ e.stopPropagation(); setTime(trackTime(e.clientX)); } });
tbtrack.addEventListener('pointerup', ()=>{ tbDrag=false; replaceHash(); });   // reflect the settled time in the URL
tbtrack.addEventListener('keydown', e=>{ const step=e.shiftKey?50:10;
  if(e.key==='ArrowLeft'){ e.preventDefault(); setTime(timeNow+step); replaceHash(); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); setTime(timeNow-step); replaceHash(); } });
let playing=false, playRAF=0;
function play(){
  if(playing){ pausePlay(); return; }
  if(timeNow<=0.5) setTime(TMAX);          // at "now" already → restart from the origin
  playing=true; tbplay.innerHTML='&#10074;&#10074;';
  const from=timeNow, dur=Math.max(2500, from/TMAX*15000), t0=performance.now();
  (function step(now){ if(!playing) return; const e=Math.min(1,(now-t0)/dur);
    setTime(from*(1-e)); if(e<1) playRAF=requestAnimationFrame(step); else pausePlay(); })(t0);
}
function pausePlay(){ playing=false; cancelAnimationFrame(playRAF); tbplay.innerHTML='&#9654;'; replaceHash(); }
tbplay.onclick=play;
function enterTime(){
  timeMode=true; btnTime.classList.add('on'); btnTime.setAttribute('aria-pressed','true');
  timebar.hidden=false; buildBands();
  if(mode==='treemap'||mode==='sunburst') switchMode('radial');
  timeHandOff=false; timeLastPeriod=null;
  setTime(0);   // begin at the present — the full tree — then scrub/play back into deep time
  updateHash();
}
function exitTime(){
  timeMode=false; btnTime.classList.remove('on'); btnTime.setAttribute('aria-pressed','false');
  timebar.hidden=true; pausePlay();
  updateTimeFooter();   // restore the present-day footer
  if(timeFitRAF){ cancelAnimationFrame(timeFitRAF); timeFitRAF=0; }
  timeHandOff=false;
  for(const el of nodeEls.values()){ el.style.opacity=''; el.style.pointerEvents=''; el.classList.remove('undated'); }
  for(const el of linkEls.values()) el.style.opacity='';
}
btnTime.onclick=()=> timeMode?exitTime():enterTime();

// ---------- buttons + boot ----------
document.getElementById('btnOrders').onclick=toOrders;
document.getElementById('btnExpand').onclick=expandAll;
document.getElementById('btnCollapse').onclick=collapseTop;
document.getElementById('btnFit').onclick=()=>fit(500);
{ const btnShare=document.getElementById('btnShare');   // copy a link to the current view (works from file:// too)
  btnShare.onclick=()=>{ const url=location.href.split('#')[0]+shareHash();
    const done=ok=>{ btnShare.textContent=ok?'Link copied ✓':'Press ⌘C to copy'; setTimeout(()=>btnShare.textContent='Share this view',1500); };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(()=>done(true),()=>done(false));
    else done(false); }; }
document.getElementById('btnTree').onclick=()=>switchMode('tree');
document.getElementById('btnRadial').onclick=()=>switchMode('radial');
document.getElementById('btnSun').onclick=()=>switchMode('sunburst');
document.getElementById('btnTreemap').onclick=()=>switchMode('treemap');

// ---------- dev perf HUD (E1) — off by default; `?perf` in the URL or the ` key toggles it ----------
const perfhud=document.getElementById('perfhud');
let perfOn=/[?#][^]*perf/.test(location.href), lastRenderMs=0, _pFrames=0, _pFps=0, _pFt=0, _pT0=0, _pLast=0, _pSample=0, _pEls=0;
{ const _render=render; render=function(){ const t=performance.now(); _render(); lastRenderMs=performance.now()-t; }; }
function drawPerf(){
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576)+'M' : '—';
  const cls = _pFps>=55?'':(_pFps>=30?'warn':'bad');
  perfhud.innerHTML =
    `fps <b class="${cls}">${_pFps||'–'}</b> · <b>${_pFt.toFixed(1)}</b>ms\n`+
    `render <b>${lastRenderMs.toFixed(1)}</b>ms\n`+
    `els <b>${_pEls.toLocaleString()}</b> · vis <b>${(visibleNodes||[]).length}</b>\n`+
    `heap ${heap}`;
}
function perfLoop(now){
  if(!perfOn) return;
  if(!_pT0){ _pT0=now; _pLast=now; }
  const dt=now-_pLast; _pLast=now; _pFrames++;
  _pFt = _pFt ? _pFt*0.9+dt*0.1 : dt;
  if(now-_pT0>=500){ _pFps=Math.round(_pFrames*1000/(now-_pT0)); _pFrames=0; _pT0=now; }
  if(now-_pSample>600){ _pSample=now; _pEls=svg.getElementsByTagName('*').length; drawPerf(); }
  requestAnimationFrame(perfLoop);
}
function togglePerf(on){ perfOn = on!==undefined?on:!perfOn; perfhud.hidden=!perfOn; perfhud.setAttribute('aria-hidden', String(!perfOn));
  if(perfOn){ _pT0=0; _pFrames=0; _pSample=0; requestAnimationFrame(perfLoop); } }
document.addEventListener('keydown', e=>{ if(e.key==='`' && document.activeElement!==q){ e.preventDefault(); togglePerf(); } });
document.addEventListener('keydown', e=>{                 // R → surprise me (not while typing or on a modal)
  if((e.key==='r'||e.key==='R') && !e.metaKey && !e.ctrlKey && !e.altKey){
    const el=document.activeElement, tag=el&&el.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||(el&&el.isContentEditable)) return;
    if(modal.classList.contains('show')||welcome.classList.contains('show')) return;
    e.preventDefault(); surprise();
  }
});
if(perfOn) togglePerf(true);

refreshStageSize();
render(); applyT(); fit(0);
applyHash();
const _welcomed = initWelcome();
if(!location.hash && !_welcomed) maybeEntrance();   // returning visitor: grow right away
window.addEventListener('resize', ()=>{ refreshStageSize(); if(!selected && !activeStory) fit(0); else applyMount(false); });
