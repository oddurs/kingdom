// ---------- detail panel ----------
const panel=document.getElementById('panel');
// screen-reader status: the SVG tree isn't traversable by AT, so we announce the
// focused / selected taxon (and view changes) through a polite live region.
function a11yLabel(n){ return n.name+', '+n.rank+', about '+n.agg.toLocaleString()+' species'; }
function announce(msg){ const s=document.getElementById('a11y-status'); if(s) s.textContent=msg; }
const escp=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let selected=null;
function ancestors(n){ const a=[]; let c=n; while(c){ a.unshift(c); c=c.parent; } return a; }
function revealNode(n){ let p=n.parent, need=false;
  while(p){ if((p.children||[]).length && !p.open){ need=true; break; } p=p.parent; }
  if(need) animateStructural(()=>{ let q=n.parent; while(q){ if((q.children||[]).length) q.open=true; q=q.parent; } });
}
// ---------- origin time-bar (geological periods, Ma) ----------
const GEOP=[['Silurian',444,419,'#4f8f79'],['Devonian',419,359,'#3f7f88'],
  ['Carboniferous',359,299,'#566f9e'],['Permian',299,252,'#8a6cae'],
  ['Triassic',252,201,'#a76aa0'],['Jurassic',201,145,'#c17f68'],
  ['Cretaceous',145,66,'#8faa55'],['Paleogene',66,23,'#d3a24a'],
  ['Neogene',23,2.6,'#dcc06a'],['Quaternary',2.6,0,'#c9c9c9']];
const TMAX=445;
function periodOf(a){ for(const p of GEOP) if(a<=p[1]&&a>p[2]) return p; return a>GEOP[0][1] ? GEOP[0] : GEOP[GEOP.length-1]; }
function originBar(node){
  // dated crown age when we have it; otherwise effAge — when this lineage first appears
  const a=node.ageMy!=null?node.ageMy:node.effAge; if(a==null) return '';
  const W=220,BH=13,Y=6, x=v=>(TMAX-v)/TMAX*W;
  const bands=GEOP.map(p=>{const x0=x(p[1]),x1=x(p[2]);
    return `<rect class="band" x="${x0.toFixed(1)}" y="${Y}" width="${(x1-x0).toFixed(1)}" height="${BH}" fill="${p[3]}" fill-opacity="0.5"><title>${p[0]} ${p[1]}–${p[2]} Ma</title></rect>`;}).join('');
  const mx=Math.max(0,Math.min(W,x(a))).toFixed(1), per=periodOf(a);   // clamp: some crown ages predate the 445 Ma axis
  const marker=`<path d="M${mx},${Y-3} l-3.5,-5 l7,0 z" fill="#fff"/><line x1="${mx}" y1="${Y-3}" x2="${mx}" y2="${Y+BH+1}" stroke="#fff" stroke-width="1"/>`;
  const shown=a<10?a:Math.round(a);
  return `<div class="pdistlabel"><span>Origin</span><span class="cod">~${shown} Ma · ${per[0]}</span></div>`+
    `<svg class="potl" viewBox="0 0 220 30" preserveAspectRatio="none" role="img" aria-label="Origin about ${Math.round(a)} million years ago, ${per[0]} period">${bands}${marker}`+
    `<text x="1" y="29" style="font-size:7px;fill:var(--faint)">445 Ma</text>`+
    `<text x="219" y="29" text-anchor="end" style="font-size:7px;fill:var(--faint)">now</text></svg>`;
}
// ---------- distribution map (real world, land grouped into WGSRPD continents) ----------
const CONTINENTS={"1":"Europe","2":"Africa","3":"Asia-Temperate","4":"Asia-Tropical",
  "5":"Australasia","6":"Pacific","7":"Northern America","8":"Southern America","9":"Antarctic"};
function distMap(node, lc){
  const d=node.distAgg||{}, codes=Object.keys(d);
  if(!codes.length) return '';
  const wm=DATA.worldmap; if(!wm) return '';
  const max=Math.max(...codes.map(c=>d[c]));
  const top=codes.slice().sort((a,b)=>d[b]-d[a])[0];
  let base='', lit='';
  for(const c in wm.regions){
    base+=`<path class="wmland" d="${wm.regions[c]}"/>`;      // faint silhouette of all land
    const v=d[c]||0;
    if(v){ const op=(0.30+0.70*(v/max)).toFixed(2);
      lit+=`<path class="reg on" d="${wm.regions[c]}" fill="${lc}" fill-opacity="${op}"><title>${CONTINENTS[c]}: ${v.toLocaleString()} native species</title></path>`;
    }
  }
  return `<div class="pdistlabel"><span>Native range</span><span class="cod">Centre of diversity · ${CONTINENTS[top]}</span></div>`+
    `<svg class="pdistmap" viewBox="${wm.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Native distribution across botanical continents; centre of diversity ${CONTINENTS[top]}">${base}${lit}</svg>`;
}
function select(n, opts){
  opts=opts||{};
  if(selected){ const pe=nodeEls.get(selected._id); if(pe) pe.classList.remove('selected'); }
  selected=n;
  if(opts.center!==false) revealNode(n);
  const el=nodeEls.get(n._id); if(el) el.classList.add('selected');
  if(opts.panel!==false){                     // tours on mobile highlight + centre without opening the panel
  document.getElementById('pdetail').hidden=false; document.getElementById('plist').hidden=true;
  const lc=color(n);
  panel.style.setProperty('--lc', lc);   // drives the lineage dot in the nameplate
  const chain=ancestors(n);
  document.getElementById('pcrumb').innerHTML = chain.map((c,i)=>
    i===chain.length-1 ? `<span style="color:var(--dim)">${escp(c.name)}</span>`
      : `<a data-id="${c._id}" role="link" tabindex="0">${escp(c.name)}</a>`).join(' <span class="sepc">›</span> ');
  const rk=document.getElementById('prank'); rk.textContent=n.rank;
  document.getElementById('pname').textContent=n.name;
  const cm=document.getElementById('pcommon'); cm.textContent=n.common||''; cm.style.display=n.common?'block':'none';
  const hasKids=(n.children||[]).length>0;
  const bl=document.getElementById('pblurb');
  let blurbText=n.blurb||'';
  if(!blurbText && hasKids){                    // higher clades often lack a curated blurb — synthesize one
    const spp='~'+n.agg.toLocaleString()+' species';
    blurbText = n.rank==='family'
      ? `A family of ${n.genCount.toLocaleString()} genera and ${spp}.`
      : `This ${n.rank} spans ${n.famCount} famil${n.famCount===1?'y':'ies'} and ${spp} — open it to explore.`;
  }
  bl.textContent=blurbText; bl.style.display=blurbText?'block':'none';
  let exHtml='';
  if(n.examples&&n.examples.length) exHtml=`<div class="pexlabel">Examples</div><div class="pex">${n.examples.map(x=>`<span class="exchip">${escp(x)}</span>`).join('')}</div>`;
  else if(hasKids){                              // no curated examples — surface the largest child groups
    const top=[...n.children].sort((a,b)=>(b.agg||0)-(a.agg||0)).slice(0,4);
    exHtml=`<div class="pexlabel">Largest groups</div><div class="pex">${top.map(c=>`<span class="exchip">${escp(c.name)}</span>`).join('')}</div>`;
  }
  document.getElementById('pexwrap').innerHTML=exHtml;
  document.getElementById('porigin').innerHTML = originBar(n);
  document.getElementById('pdist').innerHTML = distMap(n, lc);
  // a family shows how many genera it holds; higher clades show family count
  const midStat = n.rank==='family'
    ? `<div class="pstat"><b>${n.genCount.toLocaleString()}</b><span>gen${n.genCount===1?'us':'era'}</span></div>`
    : (hasKids?`<div class="pstat"><b>${n.famCount}</b><span>famil${n.famCount===1?'y':'ies'}</span></div>`:'');
  document.getElementById('pstats').innerHTML =
    `<div class="pstat"><b>~${n.agg.toLocaleString()}</b><span>species</span></div>`+
    midStat+
    `<div class="pstat"><b>${n.depth}</b><span>rank depth</span></div>`;
  // Sprint I — superlative badges + rank/neighbour context
  const badges=(typeof badgeMap!=='undefined' && badgeMap.get(n._id))||[];
  document.getElementById('pbadge').innerHTML=badges.map(b=>`<span class="pbadge">${escp(b)}</span>`).join('');
  const rc=(typeof rankContext==='function')?rankContext(n):'', sibs=(typeof siblingsOf==='function')?siblingsOf(n).slice(0,3):[];
  const ctx=[]; if(rc) ctx.push(rc); if(sibs.length) ctx.push('Alongside '+sibs.map(s=>escp(s.name)).join(' · '));
  document.getElementById('pctx').innerHTML=ctx.map(c=>`<div class="pctxline">${c}</div>`).join('');
  const act=document.getElementById('pactions'); act.innerHTML='';
  if(hasKids){ const b=document.createElement('button'); b.className='ctl';
    b.textContent=n.open?'Collapse':'Expand';
    b.onclick=()=>{ toggle(n); b.textContent=n.open?'Collapse':'Expand'; el&&el.classList.add('selected'); };
    act.appendChild(b); }
  if(hasKids && n!==ROOT && n!==renderRoot){ const fb=document.createElement('button'); fb.className='ctl';
    fb.textContent='Focus subtree'; fb.title='Zoom into just this clade';
    fb.onclick=()=>reroot(n); act.appendChild(fb); }
  const cp=document.createElement('button'); cp.className='ctl'; cp.textContent='Copy link';
  cp.onclick=()=>{ const url=location.origin+location.pathname+(shareHash()||'#sel='+encodeURIComponent(n.name));
    const done=ok=>{ cp.textContent=ok?'Copied ✓':'Press ⌘C'; setTimeout(()=>cp.textContent='Copy link',1400); };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(()=>done(true),()=>done(false));
    else done(false); };
  act.appendChild(cp);
  // external references — links resolve from the name; POWO/GBIF deep-link when we hold a verified id
  const q=encodeURIComponent(n.name), gid=n.ids&&n.ids.gbif, pid=n.ids&&n.ids.powo;
  const refs=[
    ['POWO', pid?('https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:'+pid):('https://powo.science.kew.org/results?q='+q), !!pid, pid?('verified POWO id '+pid):''],
    ['GBIF', gid?('https://www.gbif.org/species/'+gid):('https://www.gbif.org/species/search?q='+q), !!gid, gid?('verified GBIF id '+gid):''],
    ['Wikipedia','https://en.wikipedia.org/wiki/'+q, false, '']
  ];
  document.getElementById('prefs').innerHTML='<div class="preflabel">References</div><div class="prefs">'+
    refs.map(([t,u,v,ti])=>`<a class="pref${v?' verified':''}" href="${u}" target="_blank" rel="noopener"${ti?' title="'+ti+'"':''}>${t}</a>`).join('')+'</div>';
  panel.classList.add('open'); panel.setAttribute('aria-hidden','false'); panel.inert=false;
  }
  if(opts.center!==false){
    // treemap/sunburst draw the selection outline only at render time and have no
    // node layer to pan; repaint to show it. tree/radial centre the chosen node.
    if(mode==='treemap'||mode==='sunburst') render(); else focusNode(n);
  }
  announce('Selected '+a11yLabel(n));
  updateHash();
}
document.getElementById('pcrumb').addEventListener('click', e=>{ const a=e.target.closest('a');
  if(a){ const n=idMap.get(+a.dataset.id); if(n) select(n); } });
document.getElementById('pcrumb').addEventListener('keydown', e=>{ if(e.key!=='Enter'&&e.key!==' ') return;
  const a=e.target.closest('a'); if(a){ e.preventDefault(); const n=idMap.get(+a.dataset.id); if(n) select(n); } });
function closePanel(){ if(selected){ const pe=nodeEls.get(selected._id); if(pe) pe.classList.remove('selected'); }
  selected=null; panel.classList.remove('open'); panel.setAttribute('aria-hidden','true'); panel.inert=true; updateHash(); }
document.getElementById('pclose').onclick=closePanel;

