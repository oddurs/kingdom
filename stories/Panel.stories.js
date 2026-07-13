import { el } from './_util.js';

// `.panel` — the detail **specimen card**. The app sets `--lc` to the taxon's
// lineage colour, which drives the nameplate wash and the stat-strip tint.
// Pinned static + `.open` here so the surface shows in isolation.
export default {
  title: 'Components/Specimen panel',
  parameters: { layout: 'centered' },
};

const card = (lc, inner) => {
  const n = el(`<aside class="panel" role="dialog" aria-label="Taxon detail">${inner}</aside>`);
  // --lc drives the lineage dot in the nameplate; the card itself stays neutral
  n.style.cssText += `position:static;opacity:1;transform:none;max-height:none;width:330px;--lc:${lc}`;
  return n;
};

const body = ({ crumb, rank, name, common, blurb, examples, stats, badges = [], ctx = [] }) => `
  <button class="pclose" aria-label="Close">&times;</button>
  <nav class="pcrumb">${crumb.map((c, i) => i === crumb.length - 1
    ? `<span style="color:var(--dim)">${c}</span>`
    : `<a>${c}</a>`).join(' <span class="sepc">&rsaquo;</span> ')}</nav>
  <span class="prank">${rank}</span>
  <h2 class="pname">${name}</h2>
  <div class="pcommon">${common}</div>
  ${badges.length ? `<div id="pbadge">${badges.map((b) => `<span class="pbadge">${b}</span>`).join('')}</div>` : ''}
  <p class="pblurb">${blurb}</p>
  <div class="pexlabel">Examples</div>
  <div class="pex">${examples.map((x) => `<span class="exchip">${x}</span>`).join('')}</div>
  <div class="pstats">${stats.map((s) => `<div class="pstat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div>
  ${ctx.length ? `<div class="pctx">${ctx.map((c) => `<div>${c}</div>`).join('')}</div>` : ''}
  <div class="pactions"><button class="ctl">Expand</button><button class="ctl">Focus subtree</button><button class="ctl">Copy link</button></div>
  <div class="preflabel">References</div>
  <div class="prefs"><a class="pref verified">POWO</a><a class="pref">GBIF</a><a class="pref">Wikipedia</a></div>`;

export const Cactaceae = () =>
  card('#e67e6b', body({
    crumb: ['Plantae', 'Angiosperms', 'Caryophyllales', 'Cactaceae'],
    rank: 'family', name: 'Cactaceae', common: 'Cacti',
    blurb: 'Stem-succulents of the Americas with spines borne on areoles and water-storing tissue; ~1,750 species.',
    examples: ['Opuntia (prickly pear)', 'Carnegiea (saguaro)', 'Mammillaria'],
    stats: [['~1,750', 'species'], ['168', 'genera'], ['8', 'rank depth']],
  }));

export const Asteraceae = () =>
  card('#8f9be8', body({
    crumb: ['Plantae', 'Asterids', 'Asterales', 'Asteraceae'],
    rank: 'family', name: 'Asteraceae', common: 'Daisies — sunflower, lettuce, dandelion',
    blurb: 'Florets packed into composite heads that mimic single blooms; the largest eudicot family, ~32,000 species.',
    examples: ['Helianthus (sunflower)', 'Taraxacum (dandelion)', 'Aster'],
    stats: [['~35,479', 'species'], ['1,730', 'genera'], ['10', 'rank depth']],
    badges: ['Largest plant family', 'Most genera of any family'],
    ctx: ['1st-largest of 479 families', 'Alongside Campanulaceae · Goodeniaceae · Stylidiaceae'],
  }));
