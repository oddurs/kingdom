// ---------- render ----------
const svg=document.getElementById('svg');
const gLinks=document.getElementById('links');
const gNodes=document.getElementById('nodes');
const gTree=document.getElementById('treemap');
const gRipples=document.getElementById('ripples');
function ripple(n){ if((mode!=='tree'&&mode!=='radial') || !nodeEls.has(n._id) || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const g=document.createElementNS(NS,'g'); g.setAttribute('transform',`translate(${n.x},${n.y})`);
  const c=document.createElementNS(NS,'circle'); c.setAttribute('r',(radius(n)+5).toFixed(1)); c.setAttribute('class','selripple'); c.style.stroke=color(n);
  g.appendChild(c); gRipples.appendChild(g); setTimeout(()=>g.remove(),650); }
const NS='http://www.w3.org/2000/svg';
const nodeEls=new Map(), linkEls=new Map();

function linkPath(s,t){
  const x1=s.x, y1=s.y, x2=t.x, y2=t.y, mx=(x1+x2)/2;
  return `M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
function linkPathRadial(s,t){
  const r1=Math.hypot(s.x,s.y), r2=Math.hypot(t.x,t.y);
  const a1=Math.atan2(s.y,s.x), a2=Math.atan2(t.y,t.x), mr=(r1+r2)/2;
  return `M${s.x},${s.y}C${mr*Math.cos(a1)},${mr*Math.sin(a1)} ${mr*Math.cos(a2)},${mr*Math.sin(a2)} ${t.x},${t.y}`;
}
// ---------- virtualized render (E3): only on-screen nodes hold DOM ----------
// Steady-state (idle / pan / zoom) keeps a <g> only for nodes within the viewport (+margin), so
// the SVG element count — and the pan/zoom recomposite cost — is bounded by the screen, not the
// tree size. During a structural animation culling is suspended and the whole working set mounts
// (as before), then re-culls on finish. Node shells are pooled to avoid create/GC churn on pan.
const nodePool=[];
let lastLayout=null;                 // cached {nodes,links} so a pan can re-cull without re-laying out
let _structRunning=false;            // true mid structural animation → suspend culling
let _vw=1400, _vh=880;               // cached stage size (avoid getBoundingClientRect per pan frame)
let _cullX=1e9, _cullY=1e9, _cullK=0;  // T at the last cull — re-cull only after enough motion
function refreshStageSize(){ const r=stage.getBoundingClientRect(); if(r.width) _vw=r.width; if(r.height) _vh=r.height; }
const CULL_MIN=400, CULL_MARGIN=340; // small trees mount whole (cull overhead not worth it)
const BREATHE_MAX=240;               // above this many mounted nodes, pause the ambient scene breathe
function virtualOn(){ return (mode==='tree'||mode==='radial') && !_structRunning && lastLayout && lastLayout.nodes.length>=CULL_MIN; }
function inView(n){ const sx=n.x*T.k+T.x, sy=n.y*T.k+T.y;
  return sx>=-CULL_MARGIN && sx<=_vw+CULL_MARGIN && sy>=-CULL_MARGIN && sy<=_vh+CULL_MARGIN; }

function acquireShell(n){
  let el=nodePool.pop();
  if(!el){
    el=document.createElementNS(NS,'g');
    const halo=document.createElementNS(NS,'circle'); halo.setAttribute('class','halo');
    const dot=document.createElementNS(NS,'circle'); dot.setAttribute('class','dot');
    el.append(halo,dot); el.__halo=halo; el.__dot=dot;
    // listeners bound once; they act on whichever node the shell currently hosts
    el.addEventListener('click', e=>{ e.stopPropagation(); const m=el.__node; if(!m) return; ripple(m); toggle(m); select(m,{center:false}); });
    el.addEventListener('mouseenter', e=>{ const m=el.__node; if(m){ hoverOn(m); showTip(m,e); } });
    el.addEventListener('mousemove', e=> moveTip(e));
    el.addEventListener('mouseleave', ()=>{ hoverOff(); });   // hoverOff hides the tip after its debounce window
  }
  el.setAttribute('class','node');                 // reset any classes left by a prior occupant
  el.__node=n; el.__age=n.effAge; el.__born=false;
  el.style.opacity=''; el.style.pointerEvents='';
  el.style.setProperty('--lc', color(n)); el.style.setProperty('--glow', glowOf(n));
  el.__halo.setAttribute('r', haloR(n)); el.__dot.setAttribute('r', radius(n));
  return el;
}
function releaseShell(el){
  if(el.__lab){ el.__lab.remove(); el.__lab=null; }
  if(el.__tog){ el.__tog.remove(); el.__tog=null; }
  el.__node=null; el.remove();
  if(nodePool.length<600) nodePool.push(el);
}
function ensureNode(n, repos){
  let el=nodeEls.get(n._id), fresh=false;
  if(!el){ el=acquireShell(n); nodeEls.set(n._id, el); gNodes.appendChild(el); fresh=true;
    if(n===selected) el.classList.add('selected');            // restore transient state on (re)mount
    if(n===kb) el.classList.add('kbfocus');
    if(activeStory && storySet && storySet.has(n._id)) el.classList.add('hl'); }
  if(fresh || repos){
    const hasKids=(n.children||[]).length>0;
    el.classList.toggle('branch', hasKids && !n.open);
    el.classList.toggle('open', hasKids && n.open);
    updateToggle(el, n, hasKids);                              // "+" glyph only on collapsed branches
    el.setAttribute('transform',`translate(${n.x},${n.y})`);
  }
}
function ensureLink(l, repos){
  const id=l.s._id+'-'+l.t._id;
  let el=linkEls.get(id), fresh=false;
  if(!el){ el=document.createElementNS(NS,'path'); el.setAttribute('class','link');
    el.style.setProperty('--lc', color(l.t)); el.style.setProperty('--lw', linkW(l.t));
    el.__age=l.t.effAge; gLinks.appendChild(el); linkEls.set(id,el); fresh=true; }
  if(fresh || repos) el.setAttribute('d', mode==='radial' ? linkPathRadial(l.s,l.t) : linkPath(l.s,l.t));
}
// mount the on-screen set (or everything, when culling is off). repos=true refreshes positions &
// classes of already-mounted elements — needed after a layout change, skipped on a pure pan.
function applyMount(repos){
  if(!lastLayout) return;
  const {nodes, links}=lastLayout, cull=virtualOn();
  const keep=new Set();
  for(const n of nodes){ if(!cull || inView(n)){ keep.add(n._id); ensureNode(n, repos); } }
  for(const [id,el] of [...nodeEls]){ if(!keep.has(id)){ nodeEls.delete(id);
    if(_deferStale){ _deferStale.nodes.push([id,el]); } else releaseShell(el); } }
  const keepL=new Set();
  for(const l of links){ if(keep.has(l.s._id) || keep.has(l.t._id)){ keepL.add(l.s._id+'-'+l.t._id); ensureLink(l, repos); } }
  for(const [id,el] of [...linkEls]){ if(!keepL.has(id)){ linkEls.delete(id);
    if(_deferStale){ _deferStale.links.push([id,el]); } else el.remove(); } }
  _cullX=T.x; _cullY=T.y; _cullK=T.k;
  stage.classList.toggle('busy', keep.size>BREATHE_MAX);   // pause the scene breathe when heavy
  labelLOD();
  if(timeMode) applyTime();          // keep newly-mounted nodes consistent with the time curtain
}
function render(){
  if(mode==='treemap' || mode==='sunburst'){
    gLinks.style.display='none'; gNodes.style.display='none'; gTree.style.display='';
    minimap.classList.add('hide');
    if(mode==='treemap') renderTreemap(); else renderSunburst();
    return;
  }
  gLinks.style.display=''; gNodes.style.display=''; gTree.style.display='none';
  const {nodes, links}=layout();
  visibleNodes = nodes.slice().sort((a,b)=> mode==='radial' ? (a.pa-b.pa) : (a.y-b.y));
  lastLayout={nodes, links};
  applyMount(true);
  renderMinimap();
}

// ---------- semantic zoom: hide crowded leaf labels, reveal on zoom ----------
let lastLODk=-1;
function labelLOD(){
  if(mode!=='tree' && mode!=='radial') return;
  const k=T.k;
  const span=Math.PI*2*0.94;
  for(const n of visibleNodes){
    const el=nodeEls.get(n._id); if(!el) continue;
    const isLeaf=!(n.open && (n.children||[]).length);
    let show=true;
    if(isLeaf){                                   // the numerous frontier labels are what crowd
      const gap = mode==='radial' ? (span/Math.max(leafTotal,1))*RADIAL_OUTER*k : DY*k;
      show = gap>=12 || n.agg>4000;               // always keep the big families legible
    }
    if(n===selected || n===kb || el.classList.contains('hl')) show=true;   // never cull a focused / highlighted label
    setLabel(el, n, show);
  }
  lastLODk=k;
}
// ---------- lazy per-node text: build the label / toggle glyph only when needed (E2 DOM diet) ----------
function updateToggle(el, n, hasKids){
  if(hasKids && !n.open){                                  // collapsed branch → "+" affordance
    // drawn as a cross (not a text glyph) so it stays perfectly centred regardless of font metrics
    if(!el.__tog){ el.__tog=document.createElementNS(NS,'path'); el.__tog.setAttribute('class','toggle'); el.appendChild(el.__tog); }
    // scale the arms to the dot so the "+" never crowds the edge on small nodes (leaves ~45% clear)
    const s=Math.max(1.8, Math.min(3, radius(n)*0.44)).toFixed(1);
    el.__tog.setAttribute('d',`M-${s} 0H${s}M0 -${s}V${s}`);
  } else if(el.__tog){ el.__tog.remove(); el.__tog=null; }
}
function setLabel(el, n, show){
  // radial interior clades stay unlabelled; everything else gets a label only when LOD permits
  const wants = show && (mode==='tree' || !(n.open && (n.children||[]).length));
  if(wants){
    if(!el.__lab){ el.__lab=document.createElementNS(NS,'text'); el.appendChild(el.__lab); }
    labelNode(el, n);
  } else if(el.__lab){ el.__lab.remove(); el.__lab=null; }
}

