// ---------- interaction ----------
function toggle(n){ if((n.children||[]).length) animateStructural(()=>{ n.open=!n.open; }); }

function relabelAll(){ for(const [id,el] of nodeEls){ const n=idMap.get(id); if(n) labelNode(el,n); } }
const idMap=new Map(); (function idx(n){ idMap.set(n._id,n); (n.children||[]).forEach(idx); })(ROOT);

function eachNode(fn){ (function w(n){ fn(n); (n.children||[]).forEach(w); })(ROOT); }
function resetFocus(){ if(renderRoot!==ROOT){ renderRoot=ROOT; updateFocusBar(); } }
function toOrders(){ animateStructural(()=>{ renderRoot=ROOT; eachNode(n=>{ n.open=(n.children||[]).length>0 && n.rank!=='order'; }); }, {fit:true}); updateFocusBar(); setActive('btnOrders'); }
// stop at families — opening all 14k genera at once would hang the browser; a family reveals its genera on click
function expandAll(){ animateStructural(()=>{ renderRoot=ROOT; eachNode(n=>{ n.open=(n.children||[]).length>0 && n.rank!=='family'; }); }, {fit:true}); updateFocusBar(); setActive('btnExpand'); }
function collapseTop(){ animateStructural(()=>{ renderRoot=ROOT; eachNode(n=>{ n.open=(n.children||[]).length>0 && n.depth<2; }); }, {fit:true}); updateFocusBar(); setActive('btnCollapse'); }
function setActive(id){ ['btnOrders','btnExpand','btnCollapse'].forEach(b=>document.getElementById(b).classList.toggle('on', b===id)); }
function setModeButtons(m){
  document.getElementById('btnTree').classList.toggle('on', m==='tree');
  document.getElementById('btnRadial').classList.toggle('on', m==='radial');
  document.getElementById('btnSun').classList.toggle('on', m==='sunburst');
  document.getElementById('btnTreemap').classList.toggle('on', m==='treemap');
}
let morphing=false;
function switchMode(m){
  if(mode===m || morphing) return;
  if(timeMode && (m==='treemap'||m==='sunburst')) exitTime();   // time filter only applies to the node views
  hideTip();
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const nodeLink = x => x==='tree' || x==='radial';
  if(!reduce && nodeLink(mode) && nodeLink(m)) morphNodeLink(m);
  else crossfade(m, reduce);
}
// tree <-> radial: interpolate every node from its old position to its new one
function morphNodeLink(m){
  const startT={...T};
  const start=new Map(); for(const n of visibleNodes) start.set(n._id,{x:n.x,y:n.y});
  mode=m;
  const {nodes,links}=layout();                 // writes target n.x,n.y
  const end=new Map(); for(const n of nodes) end.set(n._id,{x:n.x,y:n.y});
  const endT=computeFitT(nodes, m);
  setModeButtons(m); stage.classList.add('morphing'); morphing=true;
  const t0=performance.now(), dur=720;
  (function step(now){
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    T={x:startT.x+(endT.x-startT.x)*e, y:startT.y+(endT.y-startT.y)*e, k:startT.k+(endT.k-startT.k)*e};
    vp.setAttribute('transform',`translate(${T.x},${T.y}) scale(${T.k})`);
    for(const n of nodes){ const s=start.get(n._id), en=end.get(n._id); if(!s||!en) continue;
      const el=nodeEls.get(n._id); if(el) el.setAttribute('transform',`translate(${s.x+(en.x-s.x)*e},${s.y+(en.y-s.y)*e})`); }
    for(const l of links){ const ss=start.get(l.s._id),se=end.get(l.s._id),ts=start.get(l.t._id),te=end.get(l.t._id);
      if(!ss||!se||!ts||!te) continue;
      const sx=ss.x+(se.x-ss.x)*e, sy=ss.y+(se.y-ss.y)*e, tx=ts.x+(te.x-ts.x)*e, ty=ts.y+(te.y-ts.y)*e, mx=(sx+tx)/2;
      const le=linkEls.get(l.s._id+'-'+l.t._id); if(le) le.setAttribute('d',`M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`); }
    if(p<1) requestAnimationFrame(step);
    else { morphing=false; stage.classList.remove('morphing'); render(); relabelAll(); labelLOD(); }
  })(t0);
}
// anything involving the treemap: a soft crossfade (different representation, can't tween positions)
function crossfade(m, reduce){
  if(reduce){ mode=m; setModeButtons(m); render(); if(m!=='treemap') relabelAll(); fit(0); return; }
  morphing=true; vp.style.transition='opacity .2s'; vp.style.opacity='0';
  setTimeout(()=>{
    mode=m; setModeButtons(m); render(); if(m!=='treemap') relabelAll(); fit(0);
    vp.style.opacity='1';
    setTimeout(()=>{ vp.style.transition=''; morphing=false; }, 230);
  }, 210);
}

// ---------- structural animation: grow / collapse / reflow (D1) ----------
// Generalises the view-morph to changes that add or remove nodes: surviving nodes tween to
// their new positions, new nodes grow out from their parent, removed nodes recede into it.
function animateStructural(mutate, opts={}){
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(glideRAF){ cancelAnimationFrame(glideRAF); glideRAF=0; }  // don't fight momentum with a fit
  if(_structFinish) _structFinish();                       // settle any in-flight animation first
  if(mode!=='tree' && mode!=='radial'){ mutate(); render(); relabelAll(); if(opts.fit) fit(reduce?0:600); return; }

  const startPos=new Map(); for(const n of visibleNodes) startPos.set(n._id,{x:n.x,y:n.y});
  mutate();
  const {nodes,links}=layout();
  const endPos=new Map(); for(const n of nodes) endPos.set(n._id,{x:n.x,y:n.y});
  if(reduce){ render(); relabelAll(); if(opts.fit) fit(0); return; }

  // very large deltas (e.g. Expand all → ~470 families) read as chaos if every node sprouts
  // individually; ease the viewport instead and let the structure resolve in place.
  let delta=0; for(const id of endPos.keys()) if(!startPos.has(id)) delta++;
  for(const id of startPos.keys()) if(!endPos.has(id)) delta++;
  if(delta>200){ render(); relabelAll(); fit(opts.fit?640:0); return; }

  const startT={...T}, endT = opts.fit ? computeFitT(nodes,mode) : {...T};
  const lerp=(a,b,e)=>a+(b-a)*e;
  const anchor=(n,map)=>{ let p=n.parent; while(p){ if(map.has(p._id)) return map.get(p._id); p=p.parent; } return map.get(n._id)||{x:n.x,y:n.y}; };
  const linkD=(sx,sy,tx,ty)=>{ if(mode==='radial'){ const r1=Math.hypot(sx,sy),r2=Math.hypot(tx,ty),a1=Math.atan2(sy,sx),a2=Math.atan2(ty,tx),mr=(r1+r2)/2;
      return `M${sx},${sy}C${mr*Math.cos(a1)},${mr*Math.sin(a1)} ${mr*Math.cos(a2)},${mr*Math.sin(a2)} ${tx},${ty}`; }
    const mx=(sx+tx)/2; return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`; };

  const park={nodes:[],links:[]};
  _structRunning=true;                                     // suspend culling: mount the whole working set
  _deferStale=park; render(); _deferStale=null;            // build new DOM; hand exiting els to us
  const entering=new Set(); for(const n of nodes) if(!startPos.has(n._id)) entering.add(n._id);
  const posOf=(n,e)=>{ const en=endPos.get(n._id); const s = entering.has(n._id) ? anchor(n,startPos) : (startPos.get(n._id)||en);
    return {x:lerp(s.x,en.x,e), y:lerp(s.y,en.y,e)}; };

  // stagger: entering nodes ripple out from their anchor, one wave per depth level
  const enterDepth=new Map(); let maxD=1;
  for(const nid of entering){ let d=0,q=idMap.get(nid); while(q && !startPos.has(q._id)){ d++; q=q.parent; } enterDepth.set(nid,d); if(d>maxD) maxD=d; }
  const enterOrd=new Map(); let ord=0; for(const n of nodes) if(entering.has(n._id)) enterOrd.set(n._id, ord++);
  const STEP=54;   // per depth-level wave + a gentle sibling cascade so even one-level expands ripple
  const stag=nid=>Math.min((enterDepth.get(nid)||1)-1,6)*STEP + Math.min((enterOrd.get(nid)||0)*9, 260);
  let maxStag=0; for(const nid of entering){ const s=stag(nid); if(s>maxStag) maxStag=s; }
  const dur=opts.dur||480, total=dur+maxStag;
  let nowElapsed=0;
  const enterP=nid=>Math.max(0,Math.min(1,(nowElapsed-stag(nid))/dur));   // per-node local progress
  const eOut=p=>1-Math.pow(1-p,3);
  const eBack=p=>{ const c1=1.15, c3=c1+1; return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2); };  // gentle overshoot

  stage.classList.add('animating');
  const t0=performance.now(); let done=false;
  function finish(){ if(done) return; done=true; _structFinish=null; _structRunning=false;   // resume culling
    for(const [,el] of park.nodes) el.remove();
    for(const [,el] of park.links) el.remove();
    if(opts.fit) T=endT;
    for(const n of nodes){ const el=nodeEls.get(n._id); if(el) el.style.opacity=''; }
    for(const l of links){ const le=linkEls.get(l.s._id+'-'+l.t._id); if(le) le.style.opacity=''; }
    render(); relabelAll(); applyT(); labelLOD(); stage.classList.remove('animating');
  }
  _structFinish=finish;
  (function step(now){ if(done) return;
    nowElapsed=now-t0;
    const pAll=Math.min(1,nowElapsed/total), eAll=eOut(pAll);   // viewport + surviving nodes glide over the whole span
    if(opts.fit){ T={x:lerp(startT.x,endT.x,eAll),y:lerp(startT.y,endT.y,eAll),k:lerp(startT.k,endT.k,eAll)};
      vp.setAttribute('transform',`translate(${T.x},${T.y}) scale(${T.k})`); }
    for(const n of nodes){ const el=nodeEls.get(n._id); if(!el) continue;
      if(entering.has(n._id)){ const np=enterP(n._id), q=posOf(n,eOut(np)), sc=0.2+0.8*eBack(np);
        el.setAttribute('transform',`translate(${q.x},${q.y}) scale(${sc.toFixed(3)})`); el.style.opacity=Math.min(1,np*1.8).toFixed(3); }
      else { const q=posOf(n,eAll); el.setAttribute('transform',`translate(${q.x},${q.y})`); } }
    for(const l of links){ const le=linkEls.get(l.s._id+'-'+l.t._id); if(!le) continue;
      const es = entering.has(l.s._id)?eOut(enterP(l.s._id)):eAll, et = entering.has(l.t._id)?eOut(enterP(l.t._id)):eAll;
      const sp=posOf(l.s,es), tp=posOf(l.t,et); le.setAttribute('d', linkD(sp.x,sp.y,tp.x,tp.y));
      if(entering.has(l.t._id)) le.style.opacity=Math.min(1,enterP(l.t._id)*1.8).toFixed(3); }
    for(const [id,el] of park.nodes){ const n=idMap.get(id); const s=startPos.get(id)||{x:0,y:0}, a=n?anchor(n,endPos):s;
      el.setAttribute('transform',`translate(${lerp(s.x,a.x,eAll)},${lerp(s.y,a.y,eAll)}) scale(${(1-0.75*eAll).toFixed(3)})`); el.style.opacity=(1-eAll).toFixed(3); }
    for(const [id,el] of park.links){ const b=id.split('-'), sN=idMap.get(+b[0]), tN=idMap.get(+b[1]);
      const ss=startPos.get(+b[0])||(sN?anchor(sN,endPos):{x:0,y:0}), ts=startPos.get(+b[1])||ss;
      const aS=endPos.has(+b[0])?endPos.get(+b[0]):(sN?anchor(sN,endPos):ss), aT=tN?anchor(tN,endPos):aS;
      el.setAttribute('d', linkD(lerp(ss.x,aS.x,eAll),lerp(ss.y,aS.y,eAll),lerp(ts.x,aT.x,eAll),lerp(ts.y,aT.y,eAll))); el.style.opacity=(1-eAll).toFixed(3); }
    if(nowElapsed<total) requestAnimationFrame(step); else finish();
  })(t0);
}

// hover lineage-to-root — debounced so sweeping node→node stays calmly focused
// instead of flashing the whole scene dim↔full across every gap between nodes
const stage=document.getElementById('stage');
let hoverClear=null;
function clearLit(){ document.querySelectorAll('.node.lit,.link.lit').forEach(e=>e.classList.remove('lit')); }
function hoverOn(n){
  if(hoverClear){ clearTimeout(hoverClear); hoverClear=null; }
  clearLit();                          // swap the lit lineage without releasing the focus dim
  stage.classList.add('focusing');
  let cur=n;
  while(cur){ const el=nodeEls.get(cur._id); if(el) el.classList.add('lit');
    if(cur.parent){ const lid=cur.parent._id+'-'+cur._id; const le=linkEls.get(lid); if(le) le.classList.add('lit'); }
    cur=cur.parent; }
}
function hoverOff(){
  if(hoverClear) clearTimeout(hoverClear);
  // hold the focus briefly: a re-enter within the window cancels this, so no flicker between nodes
  hoverClear=setTimeout(()=>{ stage.classList.remove('focusing'); clearLit(); hideTip(); hoverClear=null; }, 140);
}

// tooltip
const tip=document.getElementById('tip');
function showTip(n,e){
  const hasKids=(n.children||[]).length>0;
  tip.style.setProperty('border-left-color', color(n));
  const rank=n.rank.charAt(0).toUpperCase()+n.rank.slice(1);
  let stat = hasKids
    ? `<b>~${n.agg.toLocaleString()}</b> <span>species</span>&nbsp;&nbsp;<b>${n.famCount}</b> <span>famil${n.famCount===1?'y':'ies'}</span>`
    : `<b>~${n.agg.toLocaleString()}</b> <span>species</span>`;
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const blurb = n.blurb ? `<div class="bl">${esc(n.blurb)}</div>` : '';
  const ex = (n.examples&&n.examples.length) ? `<div class="ex"><i>e.g.</i>${n.examples.map(esc).join(' &middot; ')}</div>` : '';
  tip.innerHTML = `<div class="rk">${rank}${hasKids&&!n.open?' &middot; click to expand':''}</div>`+
    `<div class="nm">${esc(n.name)}</div>`+
    (n.common?`<div class="cm">${esc(n.common)}</div>`:'')+
    blurb + ex +
    `<div class="st">${stat}</div>`;
  tip.classList.add('show'); moveTip(e);
}
function moveTip(e){
  const r=stage.getBoundingClientRect();
  const w=tip.offsetWidth||300, h=tip.offsetHeight||140;
  let x=e.clientX-r.left+16, y=e.clientY-r.top+16;
  if(x+w+12>r.width) x=e.clientX-r.left-w-16;
  if(y+h+12>r.height) y=e.clientY-r.top-h-16;
  if(x<6) x=6; if(y<6) y=6;
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function hideTip(){ tip.classList.remove('show'); }

