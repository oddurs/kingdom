// ---------- layout (horizontal tidy tree / radial) ----------
const DX=212, DY=28, RING=140;
const ROW_PAD=7;   // breathing room between two adjacent node circles in tree view
const RADIAL_OUTER=560;   // radial layout radius — shared with the label-LOD gap estimate in 03-render
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
    const OUTER=RADIAL_OUTER, ringStep=OUTER/maxD;
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
    // Radius-aware row spacing. A fixed DY step assumes every row is the same
    // size, but radius() scales with richness up to 26px — so a collapsed node
    // carrying a huge clade (Spermatophytes holds every seed plant) needs ~34px
    // of clearance between centres and was getting 28, overlapping the row above.
    // Advance by whatever the two adjacent circles actually need, never less than
    // DY, so ordinary rows keep their existing rhythm and only the big ones push.
    leafCursor=0;
    let rowY=0, prevR=null;
    (function walk(n){
      n.x = RD(n)*DX;
      const kids = n.open ? (n.children||[]) : [];
      if(kids.length===0){
        const r=radius(n);
        if(prevR!==null) rowY += Math.max(DY, prevR + r + ROW_PAD);
        n.y = rowY; prevR = r;
        leafCursor++;
      }
      else{ kids.forEach(walk); n.y = (kids[0].y + kids[kids.length-1].y)/2; }
      nodes.push(n);
      for(const k of kids) links.push({s:n, t:k});
    })(renderRoot);
  }
  return {nodes, links};
}

