const S={title:"Design/Foundations",parameters:{layout:"fullscreen",backgrounds:{default:"ground"}}},v=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(),H=(n=150)=>{const a=document.createElement("div");return a.style.cssText=`display:grid;gap:14px;padding:32px;grid-template-columns:repeat(auto-fill,minmax(${n}px,1fr))`,a},M=(n,a)=>`
  <div style="font-family:var(--sans);font-size:11px;color:var(--ink);margin-top:9px">${n}</div>
  <div style="font-family:var(--sans);font-size:10px;color:var(--faint);font-variant-numeric:tabular-nums">${a}</div>`,i=()=>{const n=["--ground","--ground-2","--panel","--edge","--line","--ink","--dim","--faint"],a=["--l-bryo","--l-fern","--l-gymno","--l-basal","--l-mono","--l-rosid","--l-asterid","--l-eudicot","--l-root"],e=document.createElement("div"),r=(t,p)=>{const s=document.createElement("h3");s.textContent=t,s.style.cssText="font-family:var(--serif);color:var(--ink);margin:8px 32px 0;font-weight:600";const o=H();p.forEach(m=>{const f=v(m),u=document.createElement("div");u.innerHTML=`
        <div style="height:64px;border-radius:var(--r-2);border:1px solid var(--edge);background:${f}"></div>
        ${M(m,f)}`,o.append(u)}),e.append(s,o)};return r("Surfaces & ink",n),r("Lineage hues",a),e},l=()=>{const n=[["--serif","Display / names","Angiosperms · Caryophyllales","38px"],["--sans","Text / UI","Stem-succulents of the Americas","26px"]],a=document.createElement("div");a.style.cssText="display:flex;flex-direction:column;gap:26px;padding:32px",n.forEach(([r,t,p,s])=>{const o=document.createElement("div");o.innerHTML=`
      <div style="font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">${t}</div>
      <div style="font-family:var(${r});font-size:${s};color:var(--ink);margin-top:8px;letter-spacing:var(--track-display)">${p}</div>
      <div style="font-family:var(--sans);font-size:10px;color:var(--faint);margin-top:6px">var(${r})</div>`,a.append(o)});const e=document.createElement("div");return e.style.cssText="border-top:1px solid var(--line);padding-top:22px;display:flex;gap:56px;flex-wrap:wrap",e.innerHTML=`
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Label — sans, uppercase, tracked</div>
      <div style="font-family:var(--sans);font-size:9.5px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--dim);margin-top:8px">Examples · Native range · References</div>
    </div>
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Data — sans, tabular figures</div>
      <div style="font-family:var(--sans);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink);margin-top:6px">389,873 · 14,129 · 611</div>
    </div>`,a.append(e),a},c=()=>{const n=H(170);return[["--r-1","controls"],["--r-2","containers"],["--r-3","large surfaces"],["--r-pill","pills"]].forEach(([a,e])=>{const r=v(a),t=document.createElement("div");t.innerHTML=`
      <div style="height:76px;border-radius:var(${a});border:1px solid var(--faint);background:var(--ground-2)"></div>
      ${M(`${a} · ${e}`,r)}`,n.append(t)}),n},d=()=>{const n=document.createElement("div");n.style.cssText="padding:32px;font-family:var(--sans);color:var(--ink)";const a=[["--dur-1","quick — hovers, taps, focus"],["--dur-2","considered — panels, reflows, grows"],["--ease-out","entrances & most transitions"],["--ease-settle","things that come to rest (springy settle)"]];return n.innerHTML='<p style="color:var(--dim);max-width:52ch;margin:0 0 20px">One shared motion language. Hover a dot to feel each easing / duration pair.</p>'+a.map(([e,r])=>`
      <div style="display:flex;align-items:center;gap:16px;margin:10px 0">
        <div class="motion-demo" style="width:26px;height:26px;border-radius:var(--r-pill);background:var(--l-fern);
             transition:transform ${e.startsWith("--dur")?`var(${e}) var(--ease-out)`:`var(--dur-2) var(${e})`}"></div>
        <code style="font-family:var(--sans);font-size:12px;color:var(--ink)">var(${e})</code>
        <span style="font-family:var(--sans);font-size:11px;color:var(--faint)">${v(e)}</span>
        <span style="color:var(--dim);font-size:13px">${r}</span>
      </div>`).join(""),n.querySelectorAll(".motion-demo").forEach(e=>{e.parentElement.addEventListener("mouseenter",()=>{e.style.transform="translateX(180px)"}),e.parentElement.addEventListener("mouseleave",()=>{e.style.transform="none"})}),n};var g,x,y;i.parameters={...i.parameters,docs:{...(g=i.parameters)==null?void 0:g.docs,source:{originalSource:`() => {
  const surfaces = ['--ground', '--ground-2', '--panel', '--edge', '--line', '--ink', '--dim', '--faint'];
  const hues = ['--l-bryo', '--l-fern', '--l-gymno', '--l-basal', '--l-mono', '--l-rosid', '--l-asterid', '--l-eudicot', '--l-root'];
  const wrap = document.createElement('div');
  const section = (title, names) => {
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.cssText = 'font-family:var(--serif);color:var(--ink);margin:8px 32px 0;font-weight:600';
    const g = grid();
    names.forEach(n => {
      const v = cssvar(n);
      const card = document.createElement('div');
      card.innerHTML = \`
        <div style="height:64px;border-radius:var(--r-2);border:1px solid var(--edge);background:\${v}"></div>
        \${label(n, v)}\`;
      g.append(card);
    });
    wrap.append(h, g);
  };
  section('Surfaces & ink', surfaces);
  section('Lineage hues', hues);
  return wrap;
}`,...(y=(x=i.parameters)==null?void 0:x.docs)==null?void 0:y.source}}};var h,b,w;l.parameters={...l.parameters,docs:{...(h=l.parameters)==null?void 0:h.docs,source:{originalSource:`() => {
  // Two families: a serif for names/display, one sans (Hanken Grotesk) for
  // everything else — labels and data are sans conventions, not a third family.
  const roles = [['--serif', 'Display / names', 'Angiosperms · Caryophyllales', '38px'], ['--sans', 'Text / UI', 'Stem-succulents of the Americas', '26px']];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:26px;padding:32px';
  roles.forEach(([tok, role, sample, size]) => {
    const b = document.createElement('div');
    b.innerHTML = \`
      <div style="font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">\${role}</div>
      <div style="font-family:var(\${tok});font-size:\${size};color:var(--ink);margin-top:8px;letter-spacing:var(--track-display)">\${sample}</div>
      <div style="font-family:var(--sans);font-size:10px;color:var(--faint);margin-top:6px">var(\${tok})</div>\`;
    wrap.append(b);
  });
  // the two sans conventions that replaced mono: tracked labels + tabular data
  const conv = document.createElement('div');
  conv.style.cssText = 'border-top:1px solid var(--line);padding-top:22px;display:flex;gap:56px;flex-wrap:wrap';
  conv.innerHTML = \`
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Label — sans, uppercase, tracked</div>
      <div style="font-family:var(--sans);font-size:9.5px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--dim);margin-top:8px">Examples · Native range · References</div>
    </div>
    <div>
      <div style="font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--faint)">Data — sans, tabular figures</div>
      <div style="font-family:var(--sans);font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink);margin-top:6px">389,873 · 14,129 · 611</div>
    </div>\`;
  wrap.append(conv);
  return wrap;
}`,...(w=(b=l.parameters)==null?void 0:b.docs)==null?void 0:w.source}}};var k,E,$;c.parameters={...c.parameters,docs:{...(k=c.parameters)==null?void 0:k.docs,source:{originalSource:`() => {
  const g = grid(170);
  [['--r-1', 'controls'], ['--r-2', 'containers'], ['--r-3', 'large surfaces'], ['--r-pill', 'pills']].forEach(([n, use]) => {
    const v = cssvar(n);
    const card = document.createElement('div');
    card.innerHTML = \`
      <div style="height:76px;border-radius:var(\${n});border:1px solid var(--faint);background:var(--ground-2)"></div>
      \${label(\`\${n} · \${use}\`, v)}\`;
    g.append(card);
  });
  return g;
}`,...($=(E=c.parameters)==null?void 0:E.docs)==null?void 0:$.source}}};var z,T,L;d.parameters={...d.parameters,docs:{...(z=d.parameters)==null?void 0:z.docs,source:{originalSource:`() => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:32px;font-family:var(--sans);color:var(--ink)';
  const rows = [['--dur-1', 'quick — hovers, taps, focus'], ['--dur-2', 'considered — panels, reflows, grows'], ['--ease-out', 'entrances & most transitions'], ['--ease-settle', 'things that come to rest (springy settle)']];
  wrap.innerHTML = \`<p style="color:var(--dim);max-width:52ch;margin:0 0 20px">One shared motion language. Hover a dot to feel each easing / duration pair.</p>\` + rows.map(([n, use]) => \`
      <div style="display:flex;align-items:center;gap:16px;margin:10px 0">
        <div class="motion-demo" style="width:26px;height:26px;border-radius:var(--r-pill);background:var(--l-fern);
             transition:transform \${n.startsWith('--dur') ? \`var(\${n}) var(--ease-out)\` : \`var(--dur-2) var(\${n})\`}"></div>
        <code style="font-family:var(--sans);font-size:12px;color:var(--ink)">var(\${n})</code>
        <span style="font-family:var(--sans);font-size:11px;color:var(--faint)">\${cssvar(n)}</span>
        <span style="color:var(--dim);font-size:13px">\${use}</span>
      </div>\`).join('');
  wrap.querySelectorAll('.motion-demo').forEach(dot => {
    dot.parentElement.addEventListener('mouseenter', () => {
      dot.style.transform = 'translateX(180px)';
    });
    dot.parentElement.addEventListener('mouseleave', () => {
      dot.style.transform = 'none';
    });
  });
  return wrap;
}`,...(L=(T=d.parameters)==null?void 0:T.docs)==null?void 0:L.source}}};const C=["Colour","Typography","Radius","Motion"];export{i as Colour,d as Motion,c as Radius,l as Typography,C as __namedExportsOrder,S as default};
