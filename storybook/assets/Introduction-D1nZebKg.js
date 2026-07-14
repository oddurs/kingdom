import{j as e,M as t}from"./index-C9jbGsFF.js";import{useMDXComponents as i}from"./index-bgSmKwyL.js";import"./iframe-Cab6WoAH.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-Ca4lBP7z.js";import"./index-Bhqu_tAV.js";function o(s){const n={code:"code",em:"em",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...i(),...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(t,{title:"Design/Introduction"}),`
`,e.jsx(n.h1,{id:"yggdrasil-design-system",children:"Yggdrasil Design System"}),`
`,e.jsxs(n.p,{children:[`A dark, luminous, botanical identity for an interactive tree of the plant kingdom.
This workshop documents the `,e.jsx(n.strong,{children:"chrome around the canvas"}),` — the controls, menus, chips,
search, tooltips and the specimen detail card.`]}),`
`,e.jsx(n.h2,{id:"one-source-of-truth",children:"One source of truth"}),`
`,e.jsxs(n.p,{children:["The app ships as a ",e.jsx(n.strong,{children:"single self-contained HTML file"}),` with zero runtime dependencies,
built by `,e.jsx(n.code,{children:"build/build.py"}),". There is no framework and no component runtime."]}),`
`,e.jsxs(n.p,{children:["So this Storybook does ",e.jsx(n.strong,{children:"not"})," re-implement the UI. Every story renders the ",e.jsx(n.em,{children:"exact"}),` CSS
classes the app ships:`]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Tokens"})," live in ",e.jsx(n.code,{children:"design/tokens.css"})," — the ",e.jsx(n.code,{children:":root"})," custom properties."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Components & layout"})," live in ",e.jsx(n.code,{children:"build/src/app.css"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.code,{children:"build.py"})," concatenates ",e.jsx(n.code,{children:"tokens.css + app.css"})," into the page's single ",e.jsx(n.code,{children:"<style>"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.code,{children:".storybook/preview.js"})," imports those ",e.jsx(n.strong,{children:"same two files"}),"."]}),`
`]}),`
`,e.jsxs(n.p,{children:[`Because both the app and the workshop read the same stylesheet, a component here
`,e.jsx(n.strong,{children:"cannot drift"})," from the app. Change ",e.jsx(n.code,{children:"app.css"}),", and both update."]}),`
`,e.jsx(n.h2,{id:"whats-a-component-here",children:`What's a "component" here`}),`
`,e.jsxs(n.p,{children:["The building blocks are ",e.jsx(n.strong,{children:"CSS classes + HTML patterns"}),", not custom elements:"]}),`
`,e.jsxs(n.p,{children:[`| Class | Role |
| --- | --- |
| `,e.jsx(n.code,{children:".ctl"})," | the base control button (+ ",e.jsx(n.code,{children:".on"}),", ",e.jsx(n.code,{children:".menu-btn"}),", ",e.jsx(n.code,{children:".iconbtn"}),", ",e.jsx(n.code,{children:".wide"}),", ",e.jsx(n.code,{children:".primary"}),`) |
| `,e.jsx(n.code,{children:".seg"}),` | segmented control — mutually-exclusive options |
| `,e.jsx(n.code,{children:".menu"})," | header popover menu (",e.jsx(n.code,{children:".menu-sec"}),", ",e.jsx(n.code,{children:".menu-label"}),`) |
| `,e.jsx(n.code,{children:".schip"})," / ",e.jsx(n.code,{children:".pref"})," / ",e.jsx(n.code,{children:".exchip"}),` | story / reference / example chips |
| `,e.jsx(n.code,{children:".search"}),` | the find field |
| `,e.jsx(n.code,{children:".tip"}),` | hover tooltip |
| `,e.jsx(n.code,{children:".panel"})," | the detail ",e.jsx(n.strong,{children:"specimen card"}),", tinted by lineage via ",e.jsx(n.code,{children:"--lc"})," |"]}),`
`,e.jsx(n.h2,{id:"foundations",children:"Foundations"}),`
`,e.jsxs(n.p,{children:["See ",e.jsx(n.strong,{children:"Design → Colour / Typography / Motion / Radius"}),` for the token scales that
everything else is built from.`]})]})}function p(s={}){const{wrapper:n}={...i(),...s.components};return n?e.jsx(n,{...s,children:e.jsx(o,{...s})}):o(s)}export{p as default};
