const H={title:"Design/Foundations",parameters:{layout:"fullscreen",backgrounds:{default:"ground"}}},c=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(),L=(n=150)=>{const r=document.createElement("div");return r.style.cssText=`display:grid;gap:14px;padding:32px;grid-template-columns:repeat(auto-fill,minmax(${n}px,1fr))`,r},M=(n,r)=>`
  <div style="font-family:var(--mono);font-size:11px;color:var(--ink);margin-top:9px">${n}</div>
  <div style="font-family:var(--mono);font-size:10px;color:var(--faint)">${r}</div>`,s=()=>{const n=["--ground","--ground-2","--panel","--edge","--line","--ink","--dim","--faint"],r=["--l-bryo","--l-fern","--l-gymno","--l-basal","--l-mono","--l-rosid","--l-asterid","--l-eudicot","--l-root"],e=document.createElement("div"),t=(o,a)=>{const p=document.createElement("h3");p.textContent=o,p.style.cssText="font-family:var(--serif);color:var(--ink);margin:8px 32px 0;font-weight:600";const m=L();a.forEach(u=>{const v=c(u),f=document.createElement("div");f.innerHTML=`
        <div style="height:64px;border-radius:var(--r-2);border:1px solid var(--edge);background:${v}"></div>
        ${M(u,v)}`,m.append(f)}),e.append(p,m)};return t("Surfaces & ink",n),t("Lineage hues",r),e},i=()=>{const n=[["--serif","Serif — display & taxon names","Angiosperms · Caryophyllales"],["--sans","Sans — UI & body","Stem-succulents of the Americas"],["--mono","Mono — data, labels & counts","~389,873 species · 611 branches"]],r=document.createElement("div");return r.style.cssText="display:flex;flex-direction:column;gap:22px;padding:32px",n.forEach(([e,t,o])=>{const a=document.createElement("div");a.innerHTML=`
      <div style="font-family:var(--mono);font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint)">${t}</div>
      <div style="font-family:var(${e});font-size:26px;color:var(--ink);margin-top:6px">${o}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px">var(${e}) → ${c(e)}</div>`,r.append(a)}),r},l=()=>{const n=L(170);return[["--r-1","controls"],["--r-2","containers"],["--r-3","large surfaces"],["--r-pill","pills"]].forEach(([r,e])=>{const t=c(r),o=document.createElement("div");o.innerHTML=`
      <div style="height:76px;border-radius:var(${r});border:1px solid var(--faint);background:var(--ground-2)"></div>
      ${M(`${r} · ${e}`,t)}`,n.append(o)}),n},d=()=>{const n=document.createElement("div");n.style.cssText="padding:32px;font-family:var(--sans);color:var(--ink)";const r=[["--dur-1","quick — hovers, taps, focus"],["--dur-2","considered — panels, reflows, grows"],["--ease-out","entrances & most transitions"],["--ease-settle","things that come to rest (springy settle)"]];return n.innerHTML='<p style="color:var(--dim);max-width:52ch;margin:0 0 20px">One shared motion language. Hover a dot to feel each easing / duration pair.</p>'+r.map(([e,t])=>`
      <div style="display:flex;align-items:center;gap:16px;margin:10px 0">
        <div class="motion-demo" style="width:26px;height:26px;border-radius:var(--r-pill);background:var(--l-fern);
             transition:transform ${e.startsWith("--dur")?`var(${e}) var(--ease-out)`:`var(--dur-2) var(${e})`}"></div>
        <code style="font-family:var(--mono);font-size:12px;color:var(--ink)">var(${e})</code>
        <span style="font-family:var(--mono);font-size:11px;color:var(--faint)">${c(e)}</span>
        <span style="color:var(--dim);font-size:13px">${t}</span>
      </div>`).join(""),n.querySelectorAll(".motion-demo").forEach(e=>{e.parentElement.addEventListener("mouseenter",()=>{e.style.transform="translateX(180px)"}),e.parentElement.addEventListener("mouseleave",()=>{e.style.transform="none"})}),n};var g,x,y;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`() => {
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
}`,...(y=(x=s.parameters)==null?void 0:x.docs)==null?void 0:y.source}}};var h,$,b;i.parameters={...i.parameters,docs:{...(h=i.parameters)==null?void 0:h.docs,source:{originalSource:`() => {
  const roles = [['--serif', 'Serif — display & taxon names', 'Angiosperms · Caryophyllales'], ['--sans', 'Sans — UI & body', 'Stem-succulents of the Americas'], ['--mono', 'Mono — data, labels & counts', '~389,873 species · 611 branches']];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:22px;padding:32px';
  roles.forEach(([tok, role, sample]) => {
    const b = document.createElement('div');
    b.innerHTML = \`
      <div style="font-family:var(--mono);font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint)">\${role}</div>
      <div style="font-family:var(\${tok});font-size:26px;color:var(--ink);margin-top:6px">\${sample}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px">var(\${tok}) → \${cssvar(tok)}</div>\`;
    wrap.append(b);
  });
  return wrap;
}`,...(b=($=i.parameters)==null?void 0:$.docs)==null?void 0:b.source}}};var E,w,k;l.parameters={...l.parameters,docs:{...(E=l.parameters)==null?void 0:E.docs,source:{originalSource:`() => {
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
}`,...(k=(w=l.parameters)==null?void 0:w.docs)==null?void 0:k.source}}};var T,S,z;d.parameters={...d.parameters,docs:{...(T=d.parameters)==null?void 0:T.docs,source:{originalSource:`() => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:32px;font-family:var(--sans);color:var(--ink)';
  const rows = [['--dur-1', 'quick — hovers, taps, focus'], ['--dur-2', 'considered — panels, reflows, grows'], ['--ease-out', 'entrances & most transitions'], ['--ease-settle', 'things that come to rest (springy settle)']];
  wrap.innerHTML = \`<p style="color:var(--dim);max-width:52ch;margin:0 0 20px">One shared motion language. Hover a dot to feel each easing / duration pair.</p>\` + rows.map(([n, use]) => \`
      <div style="display:flex;align-items:center;gap:16px;margin:10px 0">
        <div class="motion-demo" style="width:26px;height:26px;border-radius:var(--r-pill);background:var(--l-fern);
             transition:transform \${n.startsWith('--dur') ? \`var(\${n}) var(--ease-out)\` : \`var(--dur-2) var(\${n})\`}"></div>
        <code style="font-family:var(--mono);font-size:12px;color:var(--ink)">var(\${n})</code>
        <span style="font-family:var(--mono);font-size:11px;color:var(--faint)">\${cssvar(n)}</span>
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
}`,...(z=(S=d.parameters)==null?void 0:S.docs)==null?void 0:z.source}}};const C=["Colour","Typography","Radius","Motion"];export{s as Colour,d as Motion,l as Radius,i as Typography,C as __namedExportsOrder,H as default};
