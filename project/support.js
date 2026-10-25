(function () {
  'use strict';

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this._updater = null;
    }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state || {}) : patch;
      if (!next) return;
      this.state = Object.assign({}, this.state || {}, next);
      if (this._updater) this._updater();
    }
    renderVals() {
      return {};
    }
  }
  window.DCLogic = DCLogic;

  const MUSTACHE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const SINGLE_MUSTACHE_RE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function resolvePath(scope, expr) {
    if (!scope || !expr) return undefined;
    const key = expr.trim();
    if (key === 'true') return true;
    if (key === 'false') return false;
    const parts = key.split('.');
    let cur = scope;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function evalText(template, scope) {
    return template.replace(MUSTACHE_RE, (_, expr) => {
      const val = resolvePath(scope, expr);
      return val == null ? '' : String(val);
    });
  }

  const EVENT_MAP = {
    onclick: ['click'],
    onpointermove: ['pointermove'],
    onpointerleave: ['pointerleave'],
    onpointerdown: ['pointerdown'],
    onpointerup: ['pointerup'],
    onpointercancel: ['pointercancel'],
    onmousemove: ['mousemove'],
    onkeydown: ['keydown'],
    onchange: ['input', 'change'],
    oninput: ['input']
  };

  function compileNodes(nodeList) {
    const updaters = [];
    const nodes = Array.from(nodeList);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      compileSingleNode(node, updaters);
    }

    return {
      nodes,
      update(scope) {
        for (let i = 0; i < updaters.length; i++) {
          updaters[i](scope);
        }
      }
    };
  }

  function compileSingleNode(node, updaters) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue;
      if (raw && raw.indexOf('{{') !== -1) {
        updaters.push((scope) => {
          const next = evalText(raw, scope);
          if (node.nodeValue !== next) {
            node.nodeValue = next;
          }
        });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === 'sc-if') {
      const rawVal = node.getAttribute('value') || '';
      const match = rawVal.match(SINGLE_MUSTACHE_RE);
      const condExpr = match ? match[1] : rawVal;

      const templateFrag = document.createDocumentFragment();
      while (node.firstChild) {
        templateFrag.appendChild(node.firstChild);
      }

      let mounted = null;
      updaters.push((scope) => {
        const show = Boolean(resolvePath(scope, condExpr));
        if (show) {
          if (!mounted) {
            const clone = templateFrag.cloneNode(true);
            mounted = compileNodes(clone.childNodes);
            node.appendChild(clone);
          }
          mounted.update(scope);
        } else if (mounted) {
          while (node.firstChild) {
            node.removeChild(node.firstChild);
          }
          mounted = null;
        }
      });
      return;
    }

    if (tag === 'sc-for') {
      const rawList = node.getAttribute('list') || '';
      const match = rawList.match(SINGLE_MUSTACHE_RE);
      const listExpr = match ? match[1] : rawList;
      const itemVar = node.getAttribute('as') || 'item';

      const templateFrag = document.createDocumentFragment();
      while (node.firstChild) {
        templateFrag.appendChild(node.firstChild);
      }

      const mountedItems = [];
      updaters.push((scope) => {
        const list = resolvePath(scope, listExpr);
        const arr = Array.isArray(list) ? list : [];

        while (mountedItems.length > arr.length) {
          const removed = mountedItems.pop();
          for (let j = 0; j < removed.nodes.length; j++) {
            const n = removed.nodes[j];
            if (n.parentNode === node) node.removeChild(n);
          }
        }

        for (let idx = 0; idx < arr.length; idx++) {
          const childScope = Object.create(scope);
          childScope[itemVar] = arr[idx];
          childScope.$index = idx;

          if (idx < mountedItems.length) {
            mountedItems[idx].update(childScope);
          } else {
            const clone = templateFrag.cloneNode(true);
            const compiled = compileNodes(clone.childNodes);
            compiled.update(childScope);
            node.appendChild(clone);
            mountedItems.push(compiled);
          }
        }
      });
      return;
    }

    const attrs = Array.from(node.attributes);
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const name = attr.name;
      const lowerName = name.toLowerCase();
      const rawVal = attr.value;

      if (lowerName === 'hint-placeholder-val' || lowerName === 'hint-placeholder-count') {
        continue;
      }

      if (lowerName.indexOf('on') === 0 && rawVal.indexOf('{{') !== -1) {
        const m = rawVal.match(SINGLE_MUSTACHE_RE);
        const expr = m ? m[1] : rawVal;
        node.removeAttribute(name);

        if (!node._dcHandlers) node._dcHandlers = {};
        const domEvents = EVENT_MAP[lowerName] || [lowerName.slice(2)];

        domEvents.forEach((evName) => {
          const handlerKey = lowerName + ':' + evName;
          if (!node._dcHandlers[handlerKey]) {
            node.addEventListener(evName, (e) => {
              const fn = node._dcHandlers[lowerName];
              if (typeof fn === 'function') {
                fn(e);
              }
            });
            node._dcHandlers[handlerKey] = true;
          }
        });

        updaters.push((scope) => {
          node._dcHandlers[lowerName] = resolvePath(scope, expr);
        });
        continue;
      }

      if (rawVal.indexOf('{{') !== -1) {
        if (lowerName === 'disabled') {
          const m = rawVal.match(SINGLE_MUSTACHE_RE);
          const expr = m ? m[1] : rawVal;
          updaters.push((scope) => {
            const val = resolvePath(scope, expr);
            const isDis = Boolean(val) && val !== 'false';
            node.disabled = isDis;
            if (isDis) {
              if (!node.hasAttribute('disabled')) node.setAttribute('disabled', '');
            } else {
              if (node.hasAttribute('disabled')) node.removeAttribute('disabled');
            }
          });
        } else if (lowerName === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
          updaters.push((scope) => {
            const next = evalText(rawVal, scope);
            if (node.value !== next) node.value = next;
            if (node.getAttribute('value') !== next) node.setAttribute('value', next);
          });
        } else if (lowerName === 'style') {
          updaters.push((scope) => {
            let next = evalText(rawVal, scope);
            if (next.indexOf('mask-image:') !== -1 && next.indexOf('-webkit-mask-image:') === -1) {
              const mMatch = next.match(/mask-image:\s*([^;]+)/);
              if (mMatch) {
                next += '; -webkit-mask-image: ' + mMatch[1];
              }
            }
            if (node.getAttribute('style') !== next) {
              node.setAttribute('style', next);
            }
          });
        } else {
          updaters.push((scope) => {
            const next = evalText(rawVal, scope);
            if (node.getAttribute(name) !== next) {
              node.setAttribute(name, next);
            }
          });
        }
      }
    }

    const childNodes = Array.from(node.childNodes);
    for (let i = 0; i < childNodes.length; i++) {
      compileSingleNode(childNodes[i], updaters);
    }
  }

  // ---------------------------------------------------------------------------
  // Bàn điều khiển — nút con dấu + tờ giấy ghim (chuyển trang, mực màu, hiệu ứng)
  // ---------------------------------------------------------------------------
  // tree: SVG connector drawn in a 34×32 slot left of each row (root dot, branches, sub-branches)
  const STUDIO_PAGES = [
    { file: 'Main.dc.html', no: '00', label: 'Trang chủ', lv: 0, tree: 'M6 16V32' },
    { file: 'Works.dc.html', no: '01', label: 'Tác phẩm', lv: 1, tree: 'M6 0V32M6 16H32M22 16V32' },
    { file: 'WorkDetail.dc.html', no: '01.1', label: 'Chi tiết tác phẩm', lv: 2, tree: 'M6 0V32M22 0V16H40' },
    { file: 'About.dc.html', no: '02', label: 'Giới thiệu', lv: 1, tree: 'M6 0V32M6 16H32M22 16V32' },
    { file: 'PortraitLab.dc.html', no: '02.1', label: 'Chân dung', lv: 2, tree: 'M6 0V32M22 0V16H40' },
    { file: 'Journal.dc.html', no: '03', label: 'Nhật ký', lv: 1, tree: 'M6 0V32M6 16H32M22 16V32' },
    { file: 'JournalPost.dc.html', no: '03.1', label: 'Bài viết', lv: 2, tree: 'M6 0V32M22 0V16H40' },
    { file: 'Commission.dc.html', no: '04', label: 'Đặt dự án', lv: 1, tree: 'M6 0V16H32M22 16V32' },
    { file: 'Thanks.dc.html', no: '04.1', label: 'Cảm ơn', lv: 2, tree: 'M22 0V16H40' },
    { file: 'Sitemap.dc.html', no: 'SĐ', label: 'Sơ đồ trang', lv: 0, tree: '' }
  ];
  const STUDIO_INK_NAMES = {
    '#2B2EF0': 'Cobalt', '#5B1FD1': 'Tím điện', '#0B5D3B': 'Rêu', '#0F0F14': 'Mực tàu',
    '#D8FF3C': 'Chanh', '#FF8FB8': 'Hồng phấn', '#FFC21A': 'Nghệ'
  };
  const STUDIO_BOOL_COPY = {
    motion: ['Chuyển động', 'chữ nhảy, giấy bay, nét vẽ chạy'],
    grain: ['Hạt giấy', 'lớp nhiễu như giấy in riso'],
    notes: ['Ghi chú tay', 'mũi tên, vòng khoanh, chữ viết tay']
  };
  // three hand-cut paint daubs, reused round-robin for the ink swatches
  const STUDIO_DAUBS = [
    'M24 3C35 2 45 9 45 21c1 12-6 22-19 23C13 46 3 38 3 25 2 12 12 4 24 3Z',
    'M22 2c12-1 23 6 24 18 2 13-7 25-20 25C12 46 2 37 3 23 3 11 10 3 22 2Z',
    'M25 4c11 0 21 7 20 19 0 13-9 21-21 21C11 45 3 36 4 23 4 11 13 4 25 4Z'
  ];
  const STUDIO_CSS = `
#dcs{position:fixed;right:18px;bottom:18px;z-index:99999;font-family:'Space Mono','Courier New',monospace;color:#0f0f14;-webkit-font-smoothing:antialiased}
#dcs *,#dcs *::before,#dcs *::after{box-sizing:border-box}
#dcs button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
#dcs a{color:inherit}
#dcs :focus-visible{outline:3px solid #0f0f14;outline-offset:3px}
#dcs .dcs-trig{position:relative;display:block;width:76px;height:76px;margin-left:auto;border-radius:50%;background:#FF5A2C;border:2px solid #0f0f14;box-shadow:5px 5px 0 #0f0f14;rotate:-8deg;transition:rotate .45s cubic-bezier(.3,1.6,.5,1),translate .2s,box-shadow .2s}
#dcs .dcs-trig:hover{rotate:4deg;translate:-2px -2px;box-shadow:7px 7px 0 #0f0f14}
#dcs .dcs-trig:active{translate:3px 3px;box-shadow:2px 2px 0 #0f0f14}
#dcs .dcs-ring{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);animation:dcsSpin 18s linear infinite}
#dcs .dcs-ring text{font-family:'Space Mono','Courier New',monospace;font-size:9.6px;font-weight:700;letter-spacing:1.6px;fill:#0f0f14}
#dcs .dcs-core{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#F2F1EC;border:2px solid #0f0f14;display:grid;place-items:center;transition:rotate .45s cubic-bezier(.3,1.6,.5,1)}
#dcs .dcs-core svg{width:18px;height:18px;fill:none;stroke:#0f0f14;stroke-width:2.4;stroke-linecap:round}
#dcs.is-open .dcs-trig{rotate:0deg}
#dcs.is-open .dcs-core{rotate:135deg}
#dcs .dcs-hint{position:absolute;right:86px;bottom:30px;white-space:nowrap;font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:16px;color:#0f0f14;background:#D8FF3C;padding:3px 10px;border:2px solid #0f0f14;rotate:-4deg;opacity:0;translate:8px 0;pointer-events:none;transition:opacity .2s,translate .3s}
#dcs .dcs-trig:hover + .dcs-hint{opacity:1;translate:0 0}
#dcs.is-open .dcs-hint{display:none}
#dcs .dcs-sheet{position:absolute;right:0;bottom:98px;width:340px;max-width:calc(100vw - 36px);filter:drop-shadow(7px 8px 0 #0f0f14);transform-origin:92% 100%;opacity:0;visibility:hidden;translate:0 18px;rotate:3deg;transition:opacity .22s,translate .4s cubic-bezier(.3,1.5,.5,1),rotate .4s cubic-bezier(.3,1.5,.5,1),visibility 0s .4s}
#dcs.is-open .dcs-sheet{opacity:1;visibility:visible;translate:0 0;rotate:-1deg;transition:opacity .2s,translate .45s cubic-bezier(.3,1.5,.5,1),rotate .45s cubic-bezier(.3,1.5,.5,1),visibility 0s}
#dcs .dcs-tabs{position:relative;z-index:2;display:flex;gap:6px;padding-left:14px;margin-bottom:-2px}
#dcs .dcs-tab{position:relative;padding:8px 14px 7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:#c9c7bd;border:2px solid #0f0f14;border-bottom:0;border-radius:10px 10px 0 0;color:#3a3a42;translate:0 3px;transition:translate .2s,background .2s}
#dcs .dcs-tab:hover{translate:0 0}
#dcs .dcs-tab[aria-selected="true"]{background:#F2F1EC;color:#0f0f14;translate:0 0}
#dcs .dcs-tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:5px;background:#F2F1EC}
#dcs .dcs-paper{position:relative;background-color:#F2F1EC;background-image:radial-gradient(rgba(15,15,20,.16) 1.3px,transparent 1.3px);background-size:16px 16px;border:2px solid #0f0f14;padding:18px 18px 16px;max-height:min(560px,calc(100vh - 170px));overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
#dcs .dcs-tape{position:absolute;top:-14px;width:84px;height:26px;background:rgba(216,255,60,.78);mix-blend-mode:multiply;z-index:3;pointer-events:none}
#dcs .dcs-tape.t1{right:22px;rotate:6deg}
#dcs .dcs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#dcs .dcs-kick{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#4a4a52}
#dcs .dcs-title{margin:4px 0 0;font-family:'Bricolage Grotesque','Arial Narrow',sans-serif;font-weight:800;font-stretch:75%;font-size:34px;line-height:.9;letter-spacing:-.03em}
#dcs .dcs-title em{font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:400;font-stretch:100%;letter-spacing:-.01em;color:#FF5A2C}
#dcs .dcs-x{flex:none;width:34px;height:34px;border:2px solid #0f0f14;border-radius:50%;display:grid;place-items:center;background:#F2F1EC;transition:rotate .3s,background .2s}
#dcs .dcs-x:hover{rotate:90deg;background:#D8FF3C}
#dcs .dcs-x svg{width:14px;height:14px;stroke:#0f0f14;stroke-width:2.6;stroke-linecap:round}
#dcs .dcs-sec{margin-top:16px}
#dcs .dcs-lab{display:flex;align-items:center;gap:8px;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#4a4a52;margin-bottom:8px}
#dcs .dcs-lab::after{content:"";flex:1;border-top:2px dashed rgba(15,15,20,.25)}
#dcs .dcs-pages{list-style:none;margin:0;padding:0}
#dcs .dcs-page{display:flex;align-items:center;gap:6px;height:32px;padding:3px 8px;white-space:nowrap;text-decoration:none;font-size:13px;border-radius:2px;transition:background .15s,translate .15s}
#dcs .dcs-page:hover{background:rgba(15,15,20,.07);translate:3px 0}
#dcs .dcs-tree{flex:none;width:34px;height:32px;margin:-3px 0 -3px -4px;overflow:visible}#dcs .dcs-tree path{fill:none;stroke:rgba(15,15,20,.38);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}#dcs .dcs-tree circle{fill:#0f0f14}#dcs .dcs-tree.star path{fill:#FF5A2C;stroke:#0f0f14;stroke-width:1.2}#dcs .dcs-li-map{margin-top:6px;padding-top:6px;border-top:2px dashed rgba(15,15,20,.2)}
#dcs .dcs-no{min-width:32px;font-size:11px;color:#4a4a52}
#dcs .dcs-name{font-family:'Bricolage Grotesque','Arial Narrow',sans-serif;font-weight:700;font-size:16px;letter-spacing:-.01em}
#dcs .dcs-page.lv0 .dcs-name{font-weight:800}#dcs .dcs-page.lv2 .dcs-no{margin-left:10px}#dcs .dcs-page.lv2 .dcs-name{font-size:15px;font-weight:600}
#dcs .dcs-page[aria-current="page"]{background:linear-gradient(transparent 18%,#D8FF3C 18%,#D8FF3C 84%,transparent 84%)}
#dcs .dcs-here{margin-left:auto;font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:13px;color:#FF5A2C;white-space:nowrap}
#dcs .dcs-canvas{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px 12px;background:#0f0f14;color:#F2F1EC;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:2px solid #0f0f14;box-shadow:4px 4px 0 #2B2EF0;transition:translate .2s,box-shadow .2s}
#dcs .dcs-canvas:hover{translate:-2px -2px;box-shadow:6px 6px 0 #2B2EF0}
#dcs .dcs-canvas b{color:#D8FF3C}
#dcs .dcs-inks{display:flex;flex-wrap:wrap;gap:10px 8px}
#dcs .dcs-ink{position:relative;width:64px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;letter-spacing:.02em;color:#3a3a42}
#dcs .dcs-ink svg{width:46px;height:46px;overflow:visible;transition:scale .25s cubic-bezier(.3,1.6,.5,1),rotate .25s}
#dcs .dcs-ink:hover svg{scale:1.1;rotate:-6deg}
#dcs .dcs-ink .daub{stroke:#0f0f14;stroke-width:2}
#dcs .dcs-ink .loop{fill:none;stroke:#0f0f14;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;opacity:0}
#dcs .dcs-ink[aria-pressed="true"]{color:#0f0f14;font-weight:700}
#dcs .dcs-ink[aria-pressed="true"] .loop{opacity:1;stroke-dashoffset:0;transition:stroke-dashoffset .45s ease-out}
#dcs .dcs-tg{display:flex;align-items:center;gap:12px;width:100%;padding:8px 0;border-top:1px dashed rgba(15,15,20,.2);text-align:left}
#dcs .dcs-tg:first-of-type{border-top:0}
#dcs .dcs-tg-t{display:block;font-family:'Bricolage Grotesque','Arial Narrow',sans-serif;font-weight:700;font-size:16px}
#dcs .dcs-tg-d{display:block;font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:13px;color:#4a4a52}
#dcs .dcs-sw{position:relative;flex:none;margin-left:auto;width:58px;height:28px;border:2px solid #0f0f14;border-radius:999px;background:#F2F1EC;transition:background .2s}
#dcs .dcs-sw::before{content:"tắt";position:absolute;right:7px;top:50%;translate:0 -50%;font-size:9px;font-weight:700;text-transform:uppercase;color:#4a4a52}
#dcs .dcs-sw::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#0f0f14;transition:translate .3s cubic-bezier(.3,1.6,.5,1)}
#dcs .dcs-tg[aria-checked="true"] .dcs-sw{background:#D8FF3C}
#dcs .dcs-tg[aria-checked="true"] .dcs-sw::before{content:"bật";right:auto;left:8px;color:#0f0f14}
#dcs .dcs-tg[aria-checked="true"] .dcs-sw::after{translate:30px 0}
#dcs .dcs-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding-top:12px;border-top:2px solid #0f0f14;font-size:10px;color:#4a4a52}
#dcs .dcs-reset{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-decoration:underline;text-underline-offset:3px}
#dcs .dcs-reset:hover{color:#FF5A2C}
#dcs .dcs-empty{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:15px;color:#4a4a52;margin:6px 0 0}
@keyframes dcsSpin{to{rotate:360deg}}
@media (max-width:520px){#dcs{right:12px;bottom:12px}#dcs .dcs-trig{width:64px;height:64px}#dcs .dcs-sheet{position:fixed;left:12px;right:12px;bottom:88px;width:auto;max-width:none}#dcs .dcs-paper{max-height:calc(100vh - 160px)}#dcs .dcs-hint{display:none}#dcs.is-open .dcs-sheet,#dcs .dcs-sheet{rotate:0deg}}
@media (prefers-reduced-motion:reduce){#dcs *,#dcs *::before,#dcs *::after{animation:none!important;transition:none!important}}
`;

  function studioEsc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function mountStudioToolbar(schema, currentProps, onUpdateProps) {
    if (window.self !== window.top) return;
    if (document.getElementById('dcs')) return;

    const style = document.createElement('style');
    style.id = 'dcs-style';
    style.textContent = STUDIO_CSS;
    document.head.appendChild(style);

    const here = (location.pathname.split('/').pop() || 'Main.dc.html').toLowerCase();
    const hereFile = here === 'index.html' ? 'main.dc.html' : here;
    const keys = Object.keys(schema || {}).filter((k) => k !== '$preview' && schema[k]);
    const colorKeys = keys.filter((k) => schema[k].editor === 'color' && Array.isArray(schema[k].options));
    const boolKeys = keys.filter((k) => schema[k].editor === 'boolean');
    const hasTweaks = colorKeys.length + boolKeys.length > 0;
    let tab = 'pages';
    try { tab = localStorage.getItem('nta_dcs_tab') || 'pages'; } catch (e) {}
    if (tab === 'ink' && !hasTweaks) tab = 'pages';

    const pagesHtml = STUDIO_PAGES.map((p) => {
      const cur = p.file.toLowerCase() === hereFile;
      const glyph = p.tree
        ? `<svg class="dcs-tree" viewBox="0 0 34 32" aria-hidden="true"><path d="${p.tree}"/>${p.lv === 0 ? '<circle cx="6" cy="16" r="4"/>' : ''}</svg>`
        : '<svg class="dcs-tree star" viewBox="0 0 34 32" aria-hidden="true"><path d="M8 6l2.2 6.4L16 10l-4.6 4.6L16 19l-5.8-2.2L8 23l-1.6-6.2L1 19l4-4.4L1 10l5.4 2.4Z"/></svg>';
      return `<li${p.file === 'Sitemap.dc.html' ? ' class="dcs-li-map"' : ''}><a class="dcs-page lv${p.lv}" href="${p.file}"${cur ? ' aria-current="page"' : ''}>` +
        glyph + `<span class="dcs-no">${p.no}</span><span class="dcs-name">${studioEsc(p.label)}</span>` +
        (cur ? '<span class="dcs-here">← bạn ở đây</span>' : '') + '</a></li>';
    }).join('');

    const inkLabel = (k) => (k === 'ground' ? 'Mực nền' : k === 'accent' ? 'Mực nhấn' : k);
    const inksHtml = colorKeys.map((k) => {
      const def = schema[k];
      const cur = String(currentProps[k] || def.default || '').toUpperCase();
      const sw = def.options.map((hex, i) => {
        const on = String(hex).toUpperCase() === cur;
        const name = STUDIO_INK_NAMES[String(hex).toUpperCase()] || hex;
        return `<button type="button" class="dcs-ink" data-prop="${k}" data-val="${hex}" aria-pressed="${on}" aria-label="${inkLabel(k)}: ${name}">` +
          `<svg viewBox="0 0 48 48" aria-hidden="true" style="rotate:${[-8, 6, -3, 9][i % 4]}deg"><path class="daub" d="${STUDIO_DAUBS[i % 3]}" fill="${hex}"/>` +
          '<path class="loop" pathLength="1" d="M24 -2C40 -3 52 9 51 24 50 40 37 51 22 50 7 49-3 37-2 22-1 9 10 1 26 0"/></svg>' +
          `<span>${name}</span></button>`;
      }).join('');
      return `<div class="dcs-sec"><div class="dcs-lab">${inkLabel(k)}</div><div class="dcs-inks">${sw}</div></div>`;
    }).join('');

    const boolsHtml = boolKeys.length ? '<div class="dcs-sec"><div class="dcs-lab">Hiệu ứng</div>' + boolKeys.map((k) => {
      const copy = STUDIO_BOOL_COPY[k] || [k, ''];
      const on = currentProps[k] !== false;
      return `<button type="button" class="dcs-tg" role="switch" data-bool-prop="${k}" aria-checked="${on}">` +
        `<span><span class="dcs-tg-t">${copy[0]}</span><span class="dcs-tg-d">${copy[1]}</span></span><span class="dcs-sw" aria-hidden="true"></span></button>`;
    }).join('') + '</div>' : '';

    const host = document.createElement('div');
    host.id = 'dcs';
    host.innerHTML =
      '<div class="dcs-sheet" id="dcs-sheet" role="dialog" aria-label="Bàn điều khiển: chuyển trang và tùy chỉnh giao diện">' +
        '<div class="dcs-tabs" role="tablist">' +
          '<button type="button" class="dcs-tab" role="tab" id="dcs-tab-pages" data-tab="pages" aria-controls="dcs-panel-pages">Đi tới</button>' +
          '<button type="button" class="dcs-tab" role="tab" id="dcs-tab-ink" data-tab="ink" aria-controls="dcs-panel-ink">Mực &amp; hiệu ứng</button>' +
        '</div>' +
        '<div class="dcs-paper">' +
          '<span class="dcs-tape t1" aria-hidden="true"></span>' +
          '<div class="dcs-head"><div><div class="dcs-kick">Bàn điều khiển · Nguyễn Tuấn Anh</div>' +
            '<p class="dcs-title" id="dcs-title"></p></div>' +
            '<button type="button" class="dcs-x" aria-label="Đóng"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2 12 12M12 2 2 12"/></svg></button></div>' +
          '<div id="dcs-panel-pages" role="tabpanel" aria-labelledby="dcs-tab-pages">' +
            `<div class="dcs-sec"><div class="dcs-lab">10 bảng · 3 cấp</div><ul class="dcs-pages">${pagesHtml}</ul></div>` +
            '<a class="dcs-canvas" href="/canvas"><span>Xem cả bức tường</span><b>Canvas ↗</b></a>' +
          '</div>' +
          '<div id="dcs-panel-ink" role="tabpanel" aria-labelledby="dcs-tab-ink">' +
            (hasTweaks ? inksHtml + boolsHtml :
              '<p class="dcs-empty">Trang này là bản vẽ cố định — không có mực hay hiệu ứng nào để vặn.</p>') +
            (hasTweaks ? '<div class="dcs-foot"><button type="button" class="dcs-reset">↺ Về mặc định</button><span>lưu trên máy bạn</span></div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="dcs-trig" aria-expanded="false" aria-controls="dcs-sheet" aria-label="Mở bàn điều khiển: chuyển trang và tùy chỉnh">' +
        '<svg class="dcs-ring" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="dcsRingPath" d="M50 50m-38 0a38 38 0 1 1 76 0a38 38 0 1 1 -76 0"/></defs>' +
        '<text><textPath href="#dcsRingPath">TÙY CHỈNH ✶ ĐI TỚI ✶ TÙY CHỈNH ✶ ĐI TỚI ✶</textPath></text></svg>' +
        '<span class="dcs-core" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M9 3v12M3 9h12"/></svg></span>' +
      '</button>' +
      '<span class="dcs-hint" aria-hidden="true">chỉnh tí cho vui?</span>';
    document.body.appendChild(host);

    const sheet = host.querySelector('.dcs-sheet');
    const trig = host.querySelector('.dcs-trig');
    const title = host.querySelector('#dcs-title');

    function setTab(t) {
      tab = t;
      try { localStorage.setItem('nta_dcs_tab', t); } catch (e) {}
      host.querySelectorAll('.dcs-tab').forEach((b) => {
        const on = b.getAttribute('data-tab') === t;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      host.querySelector('#dcs-panel-pages').hidden = t !== 'pages';
      host.querySelector('#dcs-panel-ink').hidden = t !== 'ink';
      title.innerHTML = t === 'pages' ? 'Đi tới <em>trang nào?</em>' : 'Vặn web <em>tùy ý</em>';
    }

    function setOpen(open, focusTrigger) {
      host.classList.toggle('is-open', open);
      trig.setAttribute('aria-expanded', String(open));
      trig.setAttribute('aria-label', open ? 'Đóng bàn điều khiển' : 'Mở bàn điều khiển: chuyển trang và tùy chỉnh');
      if (open) {
        const first = host.querySelector('.dcs-tab[aria-selected="true"]');
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
      } else if (focusTrigger) {
        trig.focus({ preventScroll: true });
      }
    }

    function syncInks(k, v) {
      host.querySelectorAll(`.dcs-ink[data-prop="${k}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(String(b.getAttribute('data-val')).toUpperCase() === String(v).toUpperCase()));
      });
    }

    setTab(tab);

    trig.addEventListener('click', () => setOpen(!host.classList.contains('is-open'), false));
    host.querySelector('.dcs-x').addEventListener('click', () => setOpen(false, true));
    host.querySelectorAll('.dcs-tab').forEach((b) => {
      b.addEventListener('click', () => setTab(b.getAttribute('data-tab')));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const next = tab === 'pages' ? 'ink' : 'pages';
        setTab(next);
        host.querySelector(`.dcs-tab[data-tab="${next}"]`).focus();
      });
    });

    sheet.addEventListener('click', (e) => {
      const ink = e.target.closest('.dcs-ink');
      if (ink) {
        const k = ink.getAttribute('data-prop');
        const v = ink.getAttribute('data-val');
        currentProps[k] = v;
        onUpdateProps(currentProps);
        syncInks(k, v);
        return;
      }
      const tg = e.target.closest('.dcs-tg');
      if (tg) {
        const k = tg.getAttribute('data-bool-prop');
        const on = tg.getAttribute('aria-checked') !== 'true';
        tg.setAttribute('aria-checked', String(on));
        currentProps[k] = on;
        onUpdateProps(currentProps);
        return;
      }
      if (e.target.closest('.dcs-reset')) {
        keys.forEach((k) => {
          if (schema[k].default === undefined) return;
          currentProps[k] = schema[k].default;
          if (colorKeys.indexOf(k) !== -1) syncInks(k, schema[k].default);
          const tgl = host.querySelector(`.dcs-tg[data-bool-prop="${k}"]`);
          if (tgl) tgl.setAttribute('aria-checked', String(schema[k].default !== false));
        });
        try { localStorage.removeItem('nta_dc_props'); } catch (err) {}
        onUpdateProps(currentProps, true);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && host.classList.contains('is-open')) setOpen(false, true);
    });
    document.addEventListener('pointerdown', (e) => {
      if (host.classList.contains('is-open') && !host.contains(e.target)) setOpen(false, false);
    });
  }

  function boot() {
    const xDc = document.querySelector('x-dc');
    if (!xDc) return;

    const helmet = xDc.querySelector('helmet');
    if (helmet) {
      while (helmet.firstChild) {
        document.head.appendChild(helmet.firstChild);
      }
      helmet.remove();
    }

    const scriptEl = document.querySelector('script[type="text/x-dc"], script[data-dc-script]');
    let schema = {};
    const props = {};

    if (scriptEl) {
      const rawProps = scriptEl.getAttribute('data-props');
      if (rawProps) {
        try {
          schema = JSON.parse(rawProps);
          Object.keys(schema).forEach((k) => {
            if (k !== '$preview' && schema[k] && schema[k].default !== undefined) {
              props[k] = schema[k].default;
            }
          });
        } catch (err) {
          console.warn('Failed to parse data-props:', err);
        }
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem('nta_dc_props') || '{}');
      Object.keys(saved).forEach((k) => {
        if (k in props) props[k] = saved[k];
      });
    } catch (e) {}

    let ComponentClass = DCLogic;
    if (scriptEl && scriptEl.textContent.trim()) {
      try {
        ComponentClass = new Function('DCLogic', `${scriptEl.textContent}\nreturn Component;`)(DCLogic);
      } catch (err) {
        console.error('Error compiling DCLogic Component:', err);
      }
    }

    const instance = new ComponentClass(props);
    const compiled = compileNodes(xDc.childNodes);

    instance._updater = () => {
      try {
        const vals = instance.renderVals() || {};
        compiled.update(vals);
      } catch (err) {
        console.error('Error in renderVals/update:', err);
      }
    };

    instance._updater();
    if (typeof instance.componentDidMount === 'function') {
      instance.componentDidMount();
    }

    mountStudioToolbar(schema, props, (nextProps) => {
      try {
        localStorage.setItem('nta_dc_props', JSON.stringify(nextProps));
      } catch (e) {}
      instance.props = Object.assign({}, nextProps);
      instance._updater();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
