// ---------- layout (horizontal tidy tree / radial) ----------
const DX=212, DY=28, RING=140;
let mode='radial';   // radial fills the frame and reads as a living organism — the landing view
let timeMode=false, timeNow=0;   // geological-time scrubber (C4)
let _deferStale=null, _structFinish=null;   // structural-animation plumbing (D1)
let renderRoot=ROOT;                    // re-root / focus-on-subtree
let leafCursor=0, leafTotal=0;
let visibleNodes=[];
const RD=n=>n.depth-renderRoot.depth;   // depth relative to the focused root
function layout(){
  const nodes=[], links=[];
  if(mode==='radial'){
    // cluster layout: all frontier leaves on one outer ring (handles our very unbalanced depth)
    leafTotal=0; let maxD=1;
    (function c(n){ const k=n.open?(n.children||[]):[]; if(!k.length){ leafTotal++; if(RD(n)>maxD) maxD=RD(n); } else k.forEach(c); })(renderRoot);
    const OUTER=560, ringStep=OUTER/maxD;
    leafCursor=0;
    const span=Math.PI*2*0.94, start=-Math.PI/2 + Math.PI*2*0.03;
    (function walk(n){
      const kids = n.open ? (n.children||[]) : [];
      let rad;
      if(kids.length===0){ n.pa = start + (leafCursor+0.5)/leafTotal*span; leafCursor++; rad=OUTER; }
      else{ kids.forEach(walk); n.pa = (kids[0].pa + kids[kids.length-1].pa)/2; rad=RD(n)*ringStep; }
      n.x = rad*Math.cos(n.pa); n.y = rad*Math.sin(n.pa);
      nodes.push(n);
      for(const k of kids) links.push({s:n, t:k});
    })(renderRoot);
  } else {
    leafCursor=0;
    (function walk(n){
      n.x = RD(n)*DX;
      const kids = n.open ? (n.children||[]) : [];
      if(kids.length===0){ n.y = leafCursor*DY; leafCursor++; }
      else{ kids.forEach(walk); n.y = (kids[0].y + kids[kids.length-1].y)/2; }
      nodes.push(n);
      for(const k of kids) links.push({s:n, t:k});
    })(renderRoot);
  }
  return {nodes, links};
}

