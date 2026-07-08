// ---------- pan / zoom ----------
const vp=document.getElementById('viewport');
let T={x:60,y:0,k:1};
function applyT(){ vp.setAttribute('transform',`translate(${T.x},${T.y}) scale(${T.k})`);
  updateMinimapVP();
  if(virtualOn()){                                         // re-cull, but only after the viewport has
    if(Math.abs(T.x-_cullX)+Math.abs(T.y-_cullY) > CULL_MARGIN*0.4 || Math.abs(T.k-_cullK) > 0.008)
      applyMount(false);                                   // moved enough — the margin covers the gap between culls
  } else if(Math.abs(T.k-lastLODk)>0.002) labelLOD(); }
function fit(dur){
  if(mode==='sunburst'){
    const r=stage.getBoundingClientRect();
    const k=Math.min(r.width, r.height)/(2*sunR+120)*0.98;
    animateT({k, x:r.width/2, y:r.height/2}, dur||0);
    return;
  }
  if(mode==='treemap'){
    const r=stage.getBoundingClientRect();
    const k=Math.min(r.width/(tmBounds.w+40), r.height/(tmBounds.h+40))*0.98;
    animateT({k, x:(r.width - tmBounds.w*k)/2, y:(r.height - tmBounds.h*k)/2}, dur||0);
    return;
  }
  const {nodes}=layout();
  animateT(computeFitT(nodes, mode), dur||0);
}
function computeFitT(nodes, forMode){
  const pl = forMode==='radial'?95:40, pr = forMode==='radial'?95:180, pv = forMode==='radial'?95:20;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const n of nodes){ x0=Math.min(x0,n.x-pl); x1=Math.max(x1,n.x+pr); y0=Math.min(y0,n.y-pv); y1=Math.max(y1,n.y+pv); }
  const r=stage.getBoundingClientRect();
  const k=Math.min(r.width/(x1-x0), r.height/(y1-y0), 1.1)*0.96;
  return {x:(r.width-(x1-x0)*k)/2 - x0*k, y:(r.height-(y1-y0)*k)/2 - y0*k, k};
}
function animateT(target,dur){
  if(!dur || matchMedia('(prefers-reduced-motion:reduce)').matches){ T=target; applyT(); return; }
  const s={...T}, t0=performance.now();
  (function step(now){ let p=Math.min(1,(now-t0)/dur); const e=1-Math.pow(1-p,3);
    T={x:s.x+(target.x-s.x)*e, y:s.y+(target.y-s.y)*e, k:s.k+(target.k-s.k)*e}; applyT();
    if(p<1) requestAnimationFrame(step); })(t0);
}
// pan (1 pointer) + pinch-zoom (2 pointers)
const pointers=new Map(); let pan=null, pinch=null, panDragged=false, glideRAF=0;
// overlay UI floating over the stage — clicks here must NOT be hijacked for panning
const OVERLAY_SEL='.panel,.zoomctl,.minimap,.focusbar,.tourcard,.welcome,.timebar';
function stopGlide(){ cancelAnimationFrame(glideRAF); glideRAF=0; }
stage.addEventListener('pointerdown', e=>{
  if(e.target.closest(OVERLAY_SEL)) return;   // let the overlay's own buttons receive the click
  stopGlide();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){ startPinch(); pan=null; stage.classList.remove('grabbing'); stage.setPointerCapture(e.pointerId); }
  else if(!e.target.closest('.node')){ pan={x:e.clientX,y:e.clientY,tx:T.x,ty:T.y,vx:0,vy:0,lx:e.clientX,ly:e.clientY,lt:performance.now()}; panDragged=false; stage.classList.add('grabbing'); stage.setPointerCapture(e.pointerId); }
  // clicking a node: do NOT capture the pointer — let the node receive its own click (toggle + select)
});
stage.addEventListener('pointermove', e=>{
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch && pointers.size>=2){ doPinch(); return; }
  if(pan){ if(Math.abs(e.clientX-pan.x)+Math.abs(e.clientY-pan.y)>4) panDragged=true;
    const now=performance.now(), dt=Math.max(1,now-pan.lt);   // track velocity for flick-to-glide
    pan.vx=0.75*pan.vx+0.25*(e.clientX-pan.lx)/dt; pan.vy=0.75*pan.vy+0.25*(e.clientY-pan.ly)/dt;
    pan.lx=e.clientX; pan.ly=e.clientY; pan.lt=now;
    T.x=pan.tx+(e.clientX-pan.x); T.y=pan.ty+(e.clientY-pan.y); applyT(); }
});
// click on empty background closes the panel (but not right after a drag)
stage.addEventListener('click', e=>{
  if(e.target.closest('.node')||e.target.closest(OVERLAY_SEL)) return;
  if(!panDragged) closePanel();
});
function endPtr(e){ pointers.delete(e.pointerId); if(pointers.size<2) pinch=null;
  if(pointers.size===0){
    if(pan && panDragged && !matchMedia('(prefers-reduced-motion:reduce)').matches){
      const cap=2.6, sp=Math.hypot(pan.vx,pan.vy);                // flick → glide with friction
      let vx=pan.vx, vy=pan.vy;
      if(sp>cap){ vx*=cap/sp; vy*=cap/sp; }
      if(Math.hypot(vx,vy)>0.14){ let last=performance.now();
        (function glide(now){ const dt=Math.min(40,now-last); last=now;
          const f=Math.pow(0.86, dt/16); vx*=f; vy*=f; T.x+=vx*dt; T.y+=vy*dt; applyT();
          if(Math.hypot(vx,vy)>0.02){ glideRAF=requestAnimationFrame(glide); } else glideRAF=0;
        })(last); }
    }
    pan=null; stage.classList.remove('grabbing'); } }
stage.addEventListener('pointerup', endPtr);
stage.addEventListener('pointercancel', endPtr);
function two(){ return [...pointers.values()].slice(0,2); }
function startPinch(){ const [a,b]=two(); const r=stage.getBoundingClientRect();
  pinch={d:Math.hypot(a.x-b.x,a.y-b.y), mx:(a.x+b.x)/2-r.left, my:(a.y+b.y)/2-r.top, k:T.k, tx:T.x, ty:T.y}; }
function doPinch(){ const [a,b]=two(); const r=stage.getBoundingClientRect();
  const d=Math.hypot(a.x-b.x,a.y-b.y); const mx=(a.x+b.x)/2-r.left, my=(a.y+b.y)/2-r.top;
  const k=Math.max(0.12,Math.min(3.2, pinch.k*d/pinch.d));
  T.k=k; T.x=mx-(pinch.mx-pinch.tx)*(k/pinch.k); T.y=my-(pinch.my-pinch.ty)*(k/pinch.k); applyT(); }

// keyboard navigation (arrows traverse, Enter/Space toggle)
let kb=null;
stage.setAttribute('tabindex','0');
stage.setAttribute('role','tree');
stage.setAttribute('aria-label','Plant kingdom taxonomy tree');
function setKb(n, doPan){
  if(kb){ const pe=nodeEls.get(kb._id); if(pe) pe.classList.remove('kbfocus'); }
  kb=n; if(!n) return;
  const el=nodeEls.get(n._id); if(el) el.classList.add('kbfocus');
  if(doPan!==false) focusNode(n);
}
stage.addEventListener('focus', ()=>{ if(!kb) setKb(ROOT,false); });
stage.addEventListener('keydown', e=>{
  if(document.activeElement===q || !kb) return;
  const vis=visibleNodes, i=vis.indexOf(kb), hasKids=(kb.children||[]).length>0;
  switch(e.key){
    case 'ArrowDown': if(i<vis.length-1){ setKb(vis[i+1]); } e.preventDefault(); break;
    case 'ArrowUp': if(i>0){ setKb(vis[i-1]); } e.preventDefault(); break;
    case 'ArrowRight': if(hasKids && !kb.open){ toggle(kb); setKb(kb,false); } else if(hasKids){ setKb(kb.children[0]); } e.preventDefault(); break;
    case 'ArrowLeft': if(hasKids && kb.open){ toggle(kb); setKb(kb,false); } else if(kb.parent){ setKb(kb.parent); } e.preventDefault(); break;
    case 'Enter': case ' ': if(hasKids){ toggle(kb); setKb(kb,false); } e.preventDefault(); break;
  }
});
// wheel zoom around cursor
stage.addEventListener('wheel', e=>{ e.preventDefault();
  const r=stage.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
  const f=Math.exp(-e.deltaY*0.0016); const k=Math.max(0.12,Math.min(3.2,T.k*f));
  T.x=mx-(mx-T.x)*(k/T.k); T.y=my-(my-T.y)*(k/T.k); T.k=k; applyT();
},{passive:false});
document.getElementById('zin').onclick=()=>zoomBtn(1.3);
document.getElementById('zout').onclick=()=>zoomBtn(1/1.3);
function zoomBtn(f){ const r=stage.getBoundingClientRect(),mx=r.width/2,my=r.height/2;
  const k=Math.max(0.12,Math.min(3.2,T.k*f)); T.x=mx-(mx-T.x)*(k/T.k); T.y=my-(my-T.y)*(k/T.k); T.k=k; applyT(); }

// ---------- search palette ----------
// Typing populates a ranked results dropdown; the tree only navigates when you pick a
// result. (Auto-expanding the tree per keystroke would render tens of thousands of genera.)
const q=document.getElementById('q'), qhint=document.getElementById('qhint'), qres=document.getElementById('qresults');
const esch=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const RESULT_CAP=12;
let hitList=[], activeIdx=-1, qtimer=null;
function mark(name, s){                       // bold the matched substring
  const i=name.toLowerCase().indexOf(s);
  return i<0 ? esch(name)
    : esch(name.slice(0,i))+'<em>'+esch(name.slice(i,i+s.length))+'</em>'+esch(name.slice(i+s.length));
}
q.addEventListener('input', ()=>{ clearTimeout(qtimer); qtimer=setTimeout(runSearch,120); });
q.addEventListener('focus', ()=>{ if(q.value.trim().length>=2) runSearch(); });
function runSearch(){
  const s=q.value.trim().toLowerCase();
  if(s.length<2){ qhint.textContent=''; closeResults(); return; }
  const hits=[];
  (function w(n){
    const nm=n.name.toLowerCase(), cm=n.common?n.common.toLowerCase():'';
    if(nm.includes(s)||cm.includes(s)) hits.push([nm.startsWith(s)?0:(cm.startsWith(s)?1:2), n]);   // prefix first
    (n.children||[]).forEach(w);
  })(ROOT);
  hits.sort((a,b)=>a[0]-b[0]||a[1].name.length-b[1].name.length);
  const total=hits.length;
  hitList=hits.slice(0,RESULT_CAP).map(h=>h[1]);
  qhint.textContent = total ? total+(total>RESULT_CAP?'+':'') : '';
  let rows='';
  if(!hitList.length){
    rows=`<div class="qfoot"><span>No match for &ldquo;${esch(q.value.trim())}&rdquo;</span><button data-act="surprise">Surprise me</button></div>`;
  }else{
    hitList.forEach((n,i)=>{ rows+=`<button class="qrow" role="option" data-i="${i}">`+
      `<span class="qrk" style="color:${color(n)}"></span>`+
      `<span class="qnm">${mark(n.name,s)}</span>`+
      (n.common?`<span class="qcm">${esch(n.common)}</span>`:'')+
      `<span class="qct">~${n.agg.toLocaleString()}</span></button>`; });
    const more = total>RESULT_CAP ? `${total-RESULT_CAP} more · keep typing` : `${total} match${total===1?'':'es'}`;
    rows+=`<div class="qfoot"><span>${more}</span><button data-act="surprise">Surprise me</button></div>`;
  }
  qres.innerHTML=rows; activeIdx=-1; openResults();
}
function openResults(){ qres.hidden=false; q.setAttribute('aria-expanded','true'); }
function closeResults(){ qres.hidden=true; q.setAttribute('aria-expanded','false'); activeIdx=-1; }
function setActive(i){
  const rows=qres.querySelectorAll('.qrow'); if(!rows.length) return;
  activeIdx=(i+rows.length)%rows.length;
  rows.forEach((r,j)=>r.classList.toggle('active', j===activeIdx));
  rows[activeIdx].scrollIntoView({block:'nearest'});
}
function navTo(n){ closeResults(); if(renderRoot!==ROOT){ renderRoot=ROOT; updateFocusBar(); } select(n); focusNode(n); q.blur(); }
qres.addEventListener('mousedown', e=>{        // mousedown fires before the input's blur
  const row=e.target.closest('.qrow'), act=e.target.closest('[data-act]');
  if(row){ e.preventDefault(); navTo(hitList[+row.dataset.i]); }
  else if(act){ e.preventDefault(); surprise(); }
});
q.addEventListener('keydown', e=>{
  if(e.key==='Escape'){ if(!qres.hidden) closeResults(); else { q.value=''; qhint.textContent=''; } q.blur(); return; }
  if(qres.hidden) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); setActive(activeIdx+1); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(activeIdx-1); }
  else if(e.key==='Enter'){ e.preventDefault(); if(hitList.length) navTo(hitList[activeIdx<0?0:activeIdx]); }
});
q.addEventListener('blur', ()=>{ setTimeout(closeResults, 120); });
// surprise me — a notable family at random, so it always lands somewhere worth seeing
function surprise(){
  const fams=nodesOfRank('family').filter(n=>n.agg>250);
  q.value=''; qhint.textContent=''; navTo(fams[Math.floor(Math.random()*fams.length)]);
}
function focusNode(n){
  const r=stage.getBoundingClientRect(); const k=Math.max(T.k,0.75);
  animateT({k, x:r.width*0.42 - n.x*k, y:r.height/2 - n.y*k}, 550);
}

