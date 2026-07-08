// ---------- minimap ----------
const minimap=document.getElementById('minimap');
const mmroot=document.getElementById('mmroot'), mmcontent=document.getElementById('mmcontent'), mmvp=document.getElementById('mmvp');
let mmScale=1, mmBB=null;
function renderMinimap(){
  if((mode!=='tree'&&mode!=='radial') || !visibleNodes.length){ minimap.classList.add('hide'); return; }
  minimap.classList.remove('hide');
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const n of visibleNodes){ if(n.x<x0)x0=n.x; if(n.x>x1)x1=n.x; if(n.y<y0)y0=n.y; if(n.y>y1)y1=n.y; }
  const pad=34; x0-=pad; y0-=pad; x1+=pad; y1+=pad;
  const w=Math.max(x1-x0,1), h=Math.max(y1-y0,1);
  const mw=190, mh=132, s=Math.min(mw/w, mh/h);
  mmScale=s; mmBB={x0,y0,w,h};
  const ox=(mw-w*s)/2, oy=(mh-h*s)/2;
  mmroot.setAttribute('transform',`translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-x0).toFixed(1)},${(-y0).toFixed(1)})`);
  const vis=new Set(visibleNodes.map(n=>n._id));
  let lines='', dots='';
  for(const n of visibleNodes){
    if(n.parent && vis.has(n.parent._id))
      lines+=`<line x1="${n.parent.x.toFixed(0)}" y1="${n.parent.y.toFixed(0)}" x2="${n.x.toFixed(0)}" y2="${n.y.toFixed(0)}"/>`;
    const rr=Math.max(1/mmScale*1.1, radius(n)*0.2);
    dots+=`<circle cx="${n.x.toFixed(0)}" cy="${n.y.toFixed(0)}" r="${rr.toFixed(1)}" fill="${color(n)}" fill-opacity="0.95"/>`;
  }
  mmcontent.innerHTML=lines+dots;
  updateMinimapVP();
}
function updateMinimapVP(){
  if((mode!=='tree'&&mode!=='radial') || !mmBB) return;
  // use the cached stage size (E4): avoids a forced reflow on every pan frame
  mmvp.setAttribute('x', (-T.x/T.k).toFixed(1)); mmvp.setAttribute('y', (-T.y/T.k).toFixed(1));
  mmvp.setAttribute('width', (_vw/T.k).toFixed(1)); mmvp.setAttribute('height', (_vh/T.k).toFixed(1));
}
let mmDrag=false;
function mmPan(e){
  if(!mmBB) return;
  const r=minimap.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width*190, py=(e.clientY-r.top)/r.height*132;
  const ox=(190-mmBB.w*mmScale)/2, oy=(132-mmBB.h*mmScale)/2;
  const cx=(px-ox)/mmScale + mmBB.x0, cy=(py-oy)/mmScale + mmBB.y0;
  const rs=stage.getBoundingClientRect();
  T.x=rs.width/2 - cx*T.k; T.y=rs.height/2 - cy*T.k; applyT();
}
minimap.addEventListener('pointerdown', e=>{ e.stopPropagation(); mmDrag=true; minimap.setPointerCapture(e.pointerId); mmPan(e); });
minimap.addEventListener('pointermove', e=>{ if(mmDrag){ e.stopPropagation(); mmPan(e); } });
minimap.addEventListener('pointerup', ()=>{ mmDrag=false; });
minimap.addEventListener('pointercancel', ()=>{ mmDrag=false; });

