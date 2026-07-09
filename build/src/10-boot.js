// ---------- welcome / onboarding ----------
const welcome=document.getElementById('welcome');
function showWelcome(){ welcome.classList.add('show'); }
function hideWelcome(){ welcome.classList.remove('show'); try{localStorage.setItem('biomi_seen','1');}catch(e){} }
document.getElementById('wexplore').onclick=()=>{ hideWelcome(); maybeEntrance(); };
document.getElementById('wtour').onclick=()=>{ hideWelcome(); startTour('ascent'); };
document.getElementById('btnHelp').onclick=showWelcome;
function initWelcome(){ let seen; try{ seen=localStorage.getItem('biomi_seen'); }catch(e){ seen='1'; }
  if(!seen && !location.hash){ showWelcome(); return true; } return false; }
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

// ---------- colour legend + highlight/tour menus + footer ----------
// The controls live in header popover menus (see #menu-colour / #menu-explore); this
// just populates the pre-placed #cmode / #lgswatches / #stories / #toursbar elements.
const order=['bryo','fern','gymno','basal','mono','rosid','asterid','eudicot'];
function legendSwatches(){
  if(colorMode==='age')
    return GEOP.map(p=>`<span class="lg"><span class="dot" style="color:${p[3]}"></span>${p[0]}</span>`).join('');
  if(colorMode==='region')
    return Object.keys(CONTINENT_COL).map(c=>`<span class="lg"><span class="dot" style="color:${CONTINENT_COL[c]}"></span>${CONTINENTS[c]}</span>`).join('');
  return order.map(id=>`<span class="lg"><span class="dot" style="color:${cssVar(LINEAGES[id].c)}"></span>${LINEAGES[id].label}</span>`).join('');
}
function buildColorUI(){
  document.getElementById('cmode').innerHTML='<span class="slabel">Colour</span>'
    + CMODES.map(([id,l])=>`<button class="schip${id===colorMode?' on':''}" data-cmode="${id}">${l}</button>`).join('');
  document.getElementById('lgswatches').innerHTML=legendSwatches();
}
buildColorUI();
document.getElementById('cmode').addEventListener('click', e=>{
  const b=e.target.closest('[data-cmode]'); if(!b) return;
  if(b.dataset.cmode===colorMode) return;
  colorMode=b.dataset.cmode; buildColorUI();
  render(); relabelAll();
  if(selected) select(selected,{center:false});
});
const storiesEl=document.getElementById('stories');
storiesEl.innerHTML = '<span class="slabel">Highlight</span>'
  + Object.entries(STORIES).map(([id,s])=>`<button class="schip" data-story="${id}">${s.label}</button>`).join('')
  + '<button class="schip clear" data-story="_clear">Clear</button>';
storiesEl.addEventListener('click', e=>{ const b=e.target.closest('.schip'); if(!b) return;
  if(b.dataset.story==='_clear'){ clearStory(); } else { setStory(b.dataset.story); } });
const toursbar=document.getElementById('toursbar');
toursbar.innerHTML = '<span class="slabel">Tours</span>'
  + Object.entries(TOURS).map(([id,t])=>`<button class="schip tour" data-tour="${id}">${t.label}</button>`).join('');
toursbar.addEventListener('click', e=>{ const b=e.target.closest('.schip'); if(b) startTour(b.dataset.tour); });

let totFam=0, totGen=0, totSpp=ROOT.agg;
(function w(n){ if(n.rank==='family') totFam++; else if(n.rank==='genus') totGen++; (n.children||[]).forEach(w); })(ROOT);
document.getElementById('footer').innerHTML =
  `<span><span class="k">families</span> <b>${totFam}</b></span>`+
  `<span><span class="k">genera</span> <b>${totGen.toLocaleString()}</b></span>`+
  `<span><span class="k">orders</span> <b>86</b></span>`+
  `<span><span class="k">species catalogued</span> <b>~${totSpp.toLocaleString()}</b></span>`+
  `<span class="k src">Sources: APG IV &middot; PPG I &middot; Kew WCVP &middot; GBIF</span>`;

// ---------- header popover menus (G2) ----------
let openMenu=null;
function closeMenu(){ if(!openMenu) return;
  const btn=document.querySelector(`[data-menu="${openMenu.dataset.for}"]`); if(btn) btn.setAttribute('aria-expanded','false');
  openMenu.hidden=true; openMenu.classList.remove('open'); openMenu=null; }
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
    if(e.target.closest('button') && !e.target.closest('[data-cmode]')) closeMenu();   // an action closes it; colour settings stay
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
  const serif=cssVar('--serif'), sans=cssVar('--sans'), mono=cssVar('--mono');
  const root=':root{'+['--ground','--ink','--dim','--faint','--line','--l-root'].map(v=>v+':'+cssVar(v)).join(';')+'}';
  return root+
    `.link{fill:none;stroke:var(--lc,var(--line));stroke-opacity:.34;stroke-width:1.4px}`+
    `.node circle.dot{fill:var(--ground);stroke:var(--lc,var(--l-root));stroke-width:1.8px}`+
    `.node.branch circle.dot{fill:var(--lc,var(--l-root))}.node.open circle.dot{fill:var(--ground)}`+
    `.node .halo{opacity:0}`+
    `.node text{font-family:${serif};font-size:12.5px;fill:var(--ink);paint-order:stroke;stroke:var(--ground);stroke-width:3px;stroke-linejoin:round;dominant-baseline:middle}`+
    `.node text tspan.common{font-family:${sans};font-size:10px;fill:var(--dim)}`+
    `.node .toggle{font-family:${mono};font-size:10px;fill:var(--ground);text-anchor:middle;dominant-baseline:central;font-weight:700}`+
    `.node.lodhide text{opacity:0}`+
    `text.tml{font-family:${sans};font-size:10px;fill:#0b1410;font-weight:600}`+
    `text.tmv{font-family:${mono};font-size:8.5px;fill:#0b141099}`+
    `text.tmh{font-family:${mono};font-size:9px;letter-spacing:.5px;text-transform:uppercase}`+
    `text.sbl{font-family:${sans};font-size:10px;fill:#0b1410;font-weight:600;dominant-baseline:middle}`+
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
      btnTime=document.getElementById('btnTime');
const TFADE=14;   // Ma over which a lineage blooms in after its origin
function ageOpacity(a, T){ if(a==null) return 1; if(T>a) return 0; return Math.min(1,(a-T)/TFADE); }
function applyTime(){
  const pulse = playing || tbDrag;   // only mark births while advancing time, not on the initial paint
  for(const [nid,el] of nodeEls){ const o=ageOpacity(el.__age,timeNow), born=o>0.5;
    if(pulse && born && !el.__born && el.__age!=null){ const n=idMap.get(nid); if(n && radius(n)>6) ripple(n); }
    el.__born=born; el.style.opacity=o; el.style.pointerEvents=o<0.5?'none':''; }
  for(const el of linkEls.values()){ el.style.opacity=ageOpacity(el.__age,timeNow); }
}
function buildBands(){
  tbbands.innerHTML = GEOP.map(p=>{
    const left=(TMAX-p[1])/TMAX*100, w=(p[1]-p[2])/TMAX*100;
    return `<div class="bd" style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%;background:${p[3]}" title="${p[0]} ${p[1]}–${p[2]} Ma"></div>`;
  }).join('');
}
function setTime(t){
  timeNow=Math.max(0,Math.min(TMAX,t));
  tbfill.style.width=(timeNow/TMAX*100).toFixed(2)+'%';   // curtain covers the not-yet-reached future
  const per=periodOf(timeNow);
  tblabel.innerHTML=`${Math.round(timeNow)} Ma <span class="per">· ${per[0]}</span>`;
  tbtrack.setAttribute('aria-valuenow', Math.round(timeNow));
  if(timeMode) applyTime();
}
function trackTime(clientX){ const r=tbtrack.getBoundingClientRect();
  return TMAX*(1-Math.max(0,Math.min(1,(clientX-r.left)/r.width))); }
let tbDrag=false;
tbtrack.addEventListener('pointerdown', e=>{ e.stopPropagation(); pausePlay(); tbDrag=true;
  tbtrack.setPointerCapture(e.pointerId); setTime(trackTime(e.clientX)); });
tbtrack.addEventListener('pointermove', e=>{ if(tbDrag){ e.stopPropagation(); setTime(trackTime(e.clientX)); } });
tbtrack.addEventListener('pointerup', ()=>{ tbDrag=false; });
tbtrack.addEventListener('keydown', e=>{ const step=e.shiftKey?50:10;
  if(e.key==='ArrowLeft'){ e.preventDefault(); setTime(timeNow+step); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); setTime(timeNow-step); } });
let playing=false, playRAF=0;
function play(){
  if(playing){ pausePlay(); return; }
  if(timeNow<=0.5) setTime(TMAX);          // at "now" already → restart from the origin
  playing=true; tbplay.innerHTML='&#10074;&#10074;';
  const from=timeNow, dur=Math.max(2500, from/TMAX*15000), t0=performance.now();
  (function step(now){ if(!playing) return; const e=Math.min(1,(now-t0)/dur);
    setTime(from*(1-e)); if(e<1) playRAF=requestAnimationFrame(step); else pausePlay(); })(t0);
}
function pausePlay(){ playing=false; cancelAnimationFrame(playRAF); tbplay.innerHTML='&#9654;'; }
tbplay.onclick=play;
function enterTime(){
  timeMode=true; btnTime.classList.add('on'); btnTime.setAttribute('aria-pressed','true');
  timebar.hidden=false; buildBands();
  if(mode==='treemap'||mode==='sunburst') switchMode('radial');
  setTime(0);   // begin at the present — the full tree — then scrub/play back into deep time
}
function exitTime(){
  timeMode=false; btnTime.classList.remove('on'); btnTime.setAttribute('aria-pressed','false');
  timebar.hidden=true; pausePlay();
  for(const el of nodeEls.values()){ el.style.opacity=''; el.style.pointerEvents=''; }
  for(const el of linkEls.values()) el.style.opacity='';
}
btnTime.onclick=()=> timeMode?exitTime():enterTime();

// ---------- buttons + boot ----------
document.getElementById('btnOrders').onclick=toOrders;
document.getElementById('btnExpand').onclick=expandAll;
document.getElementById('btnCollapse').onclick=collapseTop;
document.getElementById('btnFit').onclick=()=>fit(500);
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
if(perfOn) togglePerf(true);

refreshStageSize();
render(); applyT(); fit(0);
applyHash();
const _welcomed = initWelcome();
if(!location.hash && !_welcomed) maybeEntrance();   // returning visitor: grow right away
window.addEventListener('resize', ()=>{ refreshStageSize(); if(!selected && !activeStory) fit(0); else applyMount(false); });
