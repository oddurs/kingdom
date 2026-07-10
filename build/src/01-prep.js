// ---------- lineage assignment ----------
const LINEAGES = {
  bryo:{c:'--l-bryo', label:'Bryophytes'},
  fern:{c:'--l-fern', label:'Ferns & allies'},
  gymno:{c:'--l-gymno', label:'Gymnosperms'},
  basal:{c:'--l-basal', label:'Magnoliids & basal'},
  mono:{c:'--l-mono', label:'Monocots'},
  rosid:{c:'--l-rosid', label:'Rosids'},
  asterid:{c:'--l-asterid', label:'Asterids'},
  eudicot:{c:'--l-eudicot', label:'Other eudicots'},
  root:{c:'--l-root', label:'Trunk'}
};
const ANCHORS = {
  'Bryophytes':'bryo','Lycopodiopsida':'fern','Polypodiopsida':'fern','Gymnosperms':'gymno',
  'Basal angiosperms':'basal','Magnoliids':'basal','Chloranthales':'basal','Monocots':'mono',
  'Ceratophyllales':'eudicot','Eudicots':'eudicot','Superrosids':'rosid','Asterids':'asterid'
};

// ---------- preprocess ----------
let UID=0, MAXAGG=1;
function prep(n, depth, lineage, parent){
  if(n.n!==undefined){ n.name=n.n; n.rank='genus'; n.speciesCount=n.s; if(n.p!==undefined) n.ids={powo:n.p}; }  // rehydrate compact genus record (E5)
  n._id=UID++; n.depth=depth; n.parent=parent;
  n.lineage = ANCHORS[n.name] || lineage;
  const kids=n.children||[];
  // a family counts as one family and keeps its OWN distribution, even now that
  // it has genus children (genera carry no dist of their own).
  let famCount=(n.rank==='family')?1:0, genCount=(n.rank==='genus')?1:0, agg=0, distAgg={};
  if(n.dist) for(const c in n.dist) distAgg[c]=n.dist[c];
  if(kids.length===0) agg=n.speciesCount||1;
  for(const k of kids){ prep(k, depth+1, n.lineage, n); agg+=k.agg; genCount+=k.genCount;
    if(n.rank!=='family') famCount+=k.famCount;
    if(n.rank!=='family') for(const c in k.distAgg) distAgg[c]=(distAgg[c]||0)+k.distAgg[c]; }
  n.agg=agg; n.famCount=famCount; n.genCount=genCount; n.distAgg=distAgg;
  // effAge = when this lineage first appears on the timeline: its own crown age, or —
  // for undated clades — the oldest age among its descendants.
  let ea = (typeof n.ageMy==='number') ? n.ageMy : null;
  for(const k of kids){ if(k.effAge!=null && (ea==null || k.effAge>ea)) ea=k.effAge; }
  n.effAge=ea;
  // default open: internal nodes EXCEPT orders (hide families) and families (hide genera)
  n.open = kids.length>0 && n.rank!=='order' && n.rank!=='family';
  if(agg>MAXAGG) MAXAGG=agg;
  return n;
}
const ROOT = prep(DATA.tree, 0, 'root', null);
const K = 26/Math.sqrt(MAXAGG);
function radius(n){ return Math.min(26, 2.4 + K*Math.sqrt(n.agg)); }
// organic rendering: branch thickness and node luminance both scale with the richness a branch carries
const richness = n => Math.sqrt(n.agg)/Math.sqrt(MAXAGG);          // 0..1
const linkW = n => (0.6 + 5.2*richness(n)).toFixed(2)+'px';        // fine twig → thick trunk
const glowOf = n => (0.05 + 0.13*richness(n)).toFixed(3);          // faint tip → glowing clade
const haloR = n => (radius(n)*0.6 + 11).toFixed(1);                // soft surrounding cloud, not a tight rim
// Memoized: the theme is static (no runtime theming), so each token resolves once.
// color() calls this per node/link/minimap-dot/search-row — uncached it forced a
// style recalc on every call during full-mount renders.
const _cssVarCache = new Map();
const cssVar = v => { let c = _cssVarCache.get(v); if (c === undefined) { c = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); _cssVarCache.set(v, c); } return c; };
// ---------- colour modes (recolour the whole tree by a chosen dimension) ----------
let colorMode='lineage';
const CMODES=[['lineage','Lineage'],['age','Age'],['region','Region']];
const UNCOL='#3c4a43';   // muted "no data" grey-green
// per–botanical-continent hues (codes match CONTINENTS / dist)
const CONTINENT_COL={"1":"#6f9fd8","2":"#e0a34a","3":"#7bbf6a","4":"#3fae9a","5":"#e0776b",
  "6":"#cf88cf","7":"#8f9be8","8":"#d9c24e","9":"#b9c2bd"};
function centreOf(n){ const d=n.distAgg; if(!d) return null;
  let best=null,bv=-1; for(const c in d){ if(d[c]>bv){bv=d[c]; best=c;} } return best; }
// walk up until an ancestor actually has a distribution — genera carry an empty distAgg
function regionCentre(n){ let m=n,c=null; while(m && !(c=centreOf(m))) m=m.parent; return c; }
function color(n){
  if(colorMode==='age'){ const a=n.ageMy!=null?n.ageMy:n.effAge; return a==null ? UNCOL : periodOf(a)[3]; }
  if(colorMode==='region'){ const c=regionCentre(n); return c ? CONTINENT_COL[c] : UNCOL; }   // genera inherit the family's centre
  return cssVar(LINEAGES[n.lineage].c);
}

