// ---------- re-root / focus on subtree ----------
const focusbar=document.getElementById('focusbar');
function updateFocusBar(){
  if(renderRoot===ROOT){ focusbar.classList.remove('show'); focusbar.inert=true; return; }
  focusbar.classList.add('show'); focusbar.inert=false;
  focusbar.style.setProperty('--lc', color(renderRoot));   // lineage dot before the focused name
  document.getElementById('fbname').textContent=renderRoot.name;
  document.getElementById('fbup').style.display = (renderRoot.parent && renderRoot.parent!==ROOT) ? '' : 'none';
}
function reroot(n){
  if(!(n.children||[]).length || n===renderRoot) return;
  if(activeStory) clearStory(false);
  animateStructural(()=>{ renderRoot=n; n.open=true; }, {fit:true});
  updateFocusBar(); setKb(n,false);
}
function exitFocus(){ animateStructural(()=>{ renderRoot=ROOT; }, {fit:true}); updateFocusBar(); }
function focusUp(){ if(renderRoot!==ROOT && renderRoot.parent){ rerootTo(renderRoot.parent); } }
function rerootTo(n){ animateStructural(()=>{ renderRoot=n; }, {fit:true}); updateFocusBar(); }
document.getElementById('fbexit').onclick=exitFocus;
document.getElementById('fbup').onclick=focusUp;

// ---------- treemap (squarified, area = species richness) ----------
let tmBounds={w:1500,h:900};
let storySet=null;
const esc4=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function tmWorst(row, side, sum){ const mx=Math.max(...row), mn=Math.min(...row), s2=sum*sum, w2=side*side;
  return Math.max((w2*mx)/s2, s2/(w2*mn)); }
function squarifyRect(items, x, y, w, h){
  const out=[]; let rx=x, ry=y, rw=w, rh=h, arr=items.slice();
  while(arr.length){
    const side=Math.min(rw,rh); let row=[], rowSum=0, i=0, prev=Infinity;
    while(i<arr.length){ const a=arr[i].area;
      const wst=tmWorst(row.concat(a), side, rowSum+a);
      if(row.length===0 || wst<=prev){ row.push(a); rowSum+=a; prev=wst; i++; } else break; }
    const rowItems=arr.slice(0,i); arr=arr.slice(i); const thick=rowSum/side || 0;
    if(rw>=rh){ let cy=ry; for(const it of rowItems){ const ih=thick?it.area/thick:0; out.push({node:it.node,x:rx,y:cy,w:thick,h:ih}); cy+=ih; } rx+=thick; rw-=thick; }
    else { let cx=rx; for(const it of rowItems){ const iw=thick?it.area/thick:0; out.push({node:it.node,x:cx,y:ry,w:iw,h:thick}); cx+=iw; } ry+=thick; rh-=thick; }
  }
  return out;
}
function buildTreemap(node, x, y, w, h, cells, depth){
  const kids = node.open ? (node.children||[]) : [];
  if(!kids.length || w<3 || h<3){ cells.push({node,x,y,w,h,leaf:true}); return; }
  const hdr = (depth>=1 && depth<=2 && h>30 && w>64) ? 15 : 0;
  cells.push({node,x,y,w,h,header:hdr,leaf:false,depth});
  const ix=x+1.5, iy=y+hdr+1.5, iw=w-3, ih=h-hdr-3;
  if(iw<3 || ih<3) return;
  const items=kids.map(k=>({node:k, value:Math.max(k.agg,1)}));
  const tot=items.reduce((s,it)=>s+it.value,0), scale=(iw*ih)/tot;
  const scaled=items.map(it=>({node:it.node, area:it.value*scale})).sort((a,b)=>b.area-a.area);
  for(const r of squarifyRect(scaled, ix, iy, iw, ih)) buildTreemap(r.node, r.x, r.y, r.w, r.h, cells, depth+1);
}
function renderTreemap(){
  const r=stage.getBoundingClientRect();
  const TW=1500, TH=Math.max(650, Math.round(TW*((r.height||900)/(r.width||1500))));
  tmBounds={w:TW,h:TH};
  const cells=[]; buildTreemap(renderRoot, 0,0, TW, TH, cells, 0);
  let html='';
  for(const c of cells){
    const n=c.node, lc=color(n);
    if(c.leaf){
      const dim = storySet && !storySet.has(n._id);
      const maxc=Math.floor((c.w-7)/6.1);
      const label=(c.w>44 && c.h>15 && maxc>2) ? esc4(n.name.length>maxc? n.name.slice(0,maxc-1)+'…':n.name) : '';
      const showCount = label && c.w>76 && c.h>32;
      html+=`<g class="tmcell" data-id="${n._id}"><rect x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}" rx="2" fill="${lc}" fill-opacity="${dim?0.1:0.85}" stroke="#0d1512" stroke-width="1"></rect>`+
        (label?`<text class="tml" x="${(c.x+5).toFixed(1)}" y="${(c.y+13).toFixed(1)}">${label}</text>`:'')+
        (showCount?`<text class="tmv" x="${(c.x+5).toFixed(1)}" y="${(c.y+25).toFixed(1)}">~${n.agg.toLocaleString()} spp</text>`:'')+`</g>`;
    } else if(c.header){
      html+=`<g class="tmgroup"><rect x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}" rx="3" fill="none" stroke="${lc}" stroke-opacity="0.5" stroke-width="1.2"></rect>`+
        `<text class="tmh" x="${(c.x+5).toFixed(1)}" y="${(c.y+11).toFixed(1)}" fill="${lc}">${esc4(n.name)}</text></g>`;
    }
  }
  gTree.innerHTML=html;
  if(selected){ const rc=gTree.querySelector('[data-id="'+selected._id+'"] rect'); if(rc){ rc.setAttribute('stroke','#fff'); rc.setAttribute('stroke-width','2'); } }
}
gTree.addEventListener('click', e=>{ const g=e.target.closest('[data-id]'); if(!g) return;
  const n=idMap.get(+g.dataset.id); if(!n) return;
  select(n,{center:false});
  // drill: a clade with children re-roots so its own children (down to genera) fill the frame
  if((n.children||[]).length && n!==renderRoot) reroot(n); else render();
});
gTree.addEventListener('mousemove', e=>{ const g=e.target.closest('[data-id]');
  if(!g){ hideTip(); return; } const n=idMap.get(+g.dataset.id); if(n){ showTip(n,e); moveTip(e); } });
gTree.addEventListener('mouseleave', ()=> hideTip());

// ---------- sunburst (angle = species richness, radius = depth) ----------
let sunR=0;
function arcPath(a0,a1,r0,r1){
  const c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1), large=(a1-a0)>Math.PI?1:0;
  const P=(r,c,s)=>`${(r*c).toFixed(1)},${(r*s).toFixed(1)}`;
  if(r0<=0.6) return `M0,0 L${P(r1,c0,s0)} A${r1.toFixed(1)},${r1.toFixed(1)} 0 ${large} 1 ${P(r1,c1,s1)} Z`;
  return `M${P(r0,c0,s0)} L${P(r1,c0,s0)} A${r1.toFixed(1)},${r1.toFixed(1)} 0 ${large} 1 ${P(r1,c1,s1)} `+
         `L${P(r0,c1,s1)} A${r0.toFixed(1)},${r0.toFixed(1)} 0 ${large} 0 ${P(r0,c0,s0)} Z`;
}
function renderSunburst(){
  let maxD=1;
  (function d(n,dep){ if(dep>maxD)maxD=dep; if(n.open) for(const k of (n.children||[])) d(k,dep+1); })(renderRoot,0);
  const ringR=Math.min(120, 520/maxD); sunR=maxD*ringR;
  const segs=[];
  (function walk(n,a0,a1,dep){
    segs.push({node:n,a0,a1,r0:dep*ringR,r1:(dep+1)*ringR,dep});
    const kids=n.open?(n.children||[]):[]; if(!kids.length) return;
    const tot=kids.reduce((s,k)=>s+Math.max(k.agg,1),0); let a=a0;
    for(const k of kids){ const na=a+(a1-a0)*Math.max(k.agg,1)/tot; walk(k,a,na,dep+1); a=na; }
  })(renderRoot,-Math.PI/2,-Math.PI/2+Math.PI*2,0);
  let paths='',labels='';
  for(const s of segs){ const n=s.node, lc=color(n), isLeaf=!(n.open&&(n.children||[]).length);
    const dim = storySet && isLeaf && !storySet.has(n._id);
    const op = dim?0.07:Math.max(0.4, 0.92-s.dep*0.07);
    const sel = selected===n ? ' stroke="#fff" stroke-width="2"' : ' stroke="#0d1512" stroke-width="1"';
    paths+=`<path class="sbcell" data-id="${n._id}" d="${arcPath(s.a0,s.a1,s.r0,s.r1)}" fill="${lc}" fill-opacity="${op.toFixed(2)}"${sel}></path>`;
    const mid=(s.a0+s.a1)/2, rr=(s.r0+s.r1)/2, arc=(s.a1-s.a0)*rr;
    if(s.dep>0 && (s.a1-s.a0)<Math.PI*1.1 && arc>30 && (s.r1-s.r0)>13){
      let deg=mid*180/Math.PI; const flip=deg>90||deg<-90;
      const lx=rr*Math.cos(mid), ly=rr*Math.sin(mid), maxc=Math.floor(arc/6.2);
      const nm=n.name.length>maxc? n.name.slice(0,maxc-1)+'…':n.name;
      labels+=`<text class="sbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${(flip?deg+180:deg).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${esc4(nm)}</text>`;
    }
  }
  const csz=Math.min(ringR*0.5,26);
  const center=`<text class="sbc" style="font-size:${Math.max(11,csz*0.6).toFixed(0)}px" y="-4">${esc4(renderRoot===ROOT?'Plantae':renderRoot.name)}</text>`+
    `<text class="sbc" style="font-size:9px;fill:var(--faint)" y="10">~${renderRoot.agg.toLocaleString()} spp</text>`;
  gTree.innerHTML=paths+labels+center;
}

function labelNode(el, n){
  const txt=el.__lab; if(!txt) return;
  while(txt.firstChild) txt.removeChild(txt.firstChild);
  const hasKids=(n.children||[]).length>0;
  const r=radius(n);
  const visLeaf = !(n.open && (n.children||[]).length);   // frontier node (nothing expanded below)

  if(mode==='radial'){
    txt.removeAttribute('y');
    if(!visLeaf){ txt.removeAttribute('transform'); return; }   // interior clades stay unlabelled (kept clean)
    let deg=n.pa*180/Math.PI;
    const flip = deg>90 || deg<-90;
    txt.setAttribute('transform', `rotate(${flip?deg+180:deg})`);
    txt.setAttribute('text-anchor', flip?'end':'start');
    const t1=document.createElementNS(NS,'tspan'); t1.textContent=n.name;
    t1.setAttribute('x', flip? -(r+6) : (r+6)); t1.setAttribute('dy','0.32em');
    txt.appendChild(t1);
    return;
  }

  // tree mode
  txt.removeAttribute('transform');
  const left = hasKids && n.open;                 // expanded internal -> label on left
  txt.setAttribute('text-anchor', left?'end':'start');
  txt.setAttribute('x', left? -(r+7) : (r+7));
  const isLeaf=!hasKids;
  const t1=document.createElementNS(NS,'tspan'); t1.textContent=n.name; txt.appendChild(t1);
  if(isLeaf){
    txt.setAttribute('y',0);
    t1.setAttribute('x', r+7); t1.setAttribute('dy', n.common?'-0.38em':'0');
    if(n.common){ const c=document.createElementNS(NS,'tspan'); c.setAttribute('class','common');
      c.setAttribute('x', r+7); c.setAttribute('dy','1.2em'); c.textContent=n.common; txt.appendChild(c); }
  }
}

