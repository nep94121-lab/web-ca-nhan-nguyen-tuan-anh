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

  function mountStudioToolbar(schema, currentProps, onUpdateProps) {
    if (window.self !== window.top) return;

    const PAGES = [
      { file: 'Main.dc.html', label: '00 · Trang chủ' },
      { file: 'Works.dc.html', label: '01 · Tác phẩm' },
      { file: 'WorkDetail.dc.html', label: '01.1 · Chi tiết tác phẩm' },
      { file: 'About.dc.html', label: '02 · Giới thiệu' },
      { file: 'PortraitLab.dc.html', label: '02.1 · Chân dung' },
      { file: 'Journal.dc.html', label: '03 · Nhật ký' },
      { file: 'JournalPost.dc.html', label: '03.1 · Bài viết' },
      { file: 'Commission.dc.html', label: '04 · Đặt dự án' },
      { file: 'Thanks.dc.html', label: '04.1 · Cảm ơn' },
      { file: 'Sitemap.dc.html', label: 'Sơ đồ trang' }
    ];

    const currentFile = (location.pathname.split('/').pop() || 'Main.dc.html');
    const host = document.createElement('div');
    host.id = 'dc-studio-toolbar';
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;font-family:"Space Mono",monospace;font-size:12px;color:#f2f1ec;';

    const panel = document.createElement('div');
    panel.style.cssText = 'display:none;margin-bottom:10px;padding:14px 16px;background:#0f0f14;border:2px solid #d8ff3c;box-shadow:6px 6px 0 rgba(0,0,0,0.45);min-width:260px;max-width:320px;';

    let html = '<div style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d8ff3c;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;"><span>Chuyển trang</span><a href="/canvas" style="color:#f2f1ec;text-decoration:underline;font-size:11px;">Xem Canvas</a></div>';
    html += '<select id="dc-page-select" style="width:100%;padding:6px 8px;background:#1a1a24;color:#f2f1ec;border:1.5px solid #f2f1ec;font-family:inherit;font-size:12px;margin-bottom:12px;cursor:pointer;">';
    PAGES.forEach((p) => {
      const sel = p.file.toLowerCase() === currentFile.toLowerCase() ? 'selected' : '';
      html += `<option value="${p.file}" ${sel}>${p.label}</option>`;
    });
    html += '</select>';

    const propKeys = Object.keys(schema || {}).filter((k) => k !== '$preview');
    if (propKeys.length > 0) {
      html += '<div style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d8ff3c;margin:8px 0;">Tùy chỉnh giao diện</div>';
      propKeys.forEach((k) => {
        const def = schema[k];
        if (def.editor === 'color' && Array.isArray(def.options)) {
          html += `<div style="margin-bottom:8px;"><div style="margin-bottom:4px;color:#c9c9d1;">${k === 'ground' ? 'Màu nền chủ đạo' : 'Màu nhấn'}:</div><div style="display:flex;gap:6px;">`;
          def.options.forEach((hex) => {
            const active = (currentProps[k] || def.default) === hex;
            html += `<button type="button" data-prop="${k}" data-val="${hex}" style="width:26px;height:26px;border-radius:50%;background:${hex};border:2px solid ${active ? '#ffffff' : '#444'};box-shadow:${active ? '0 0 0 2px #d8ff3c' : 'none'};cursor:pointer;"></button>`;
          });
          html += '</div></div>';
        } else if (def.editor === 'boolean') {
          const checked = currentProps[k] !== false ? 'checked' : '';
          const label = k === 'motion' ? 'Chuyển động' : k === 'grain' ? 'Hạt giấy' : k === 'notes' ? 'Ghi chú tay' : k;
          html += `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" data-bool-prop="${k}" ${checked}><span>${label}</span></label>`;
        }
      });
    }

    panel.innerHTML = html;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Tùy chỉnh';
    toggleBtn.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:6px;padding:8px 14px;background:#0f0f14;color:#d8ff3c;border:2px solid #d8ff3c;box-shadow:4px 4px 0 #0f0f14;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;';

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    panel.addEventListener('change', (e) => {
      if (e.target.id === 'dc-page-select') {
        location.href = e.target.value;
        return;
      }
      const boolProp = e.target.getAttribute('data-bool-prop');
      if (boolProp) {
        currentProps[boolProp] = e.target.checked;
        onUpdateProps(currentProps);
      }
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-prop]');
      if (!btn) return;
      const k = btn.getAttribute('data-prop');
      const v = btn.getAttribute('data-val');
      currentProps[k] = v;
      onUpdateProps(currentProps);
      panel.querySelectorAll(`button[data-prop="${k}"]`).forEach((b) => {
        const isOn = b.getAttribute('data-val') === v;
        b.style.borderColor = isOn ? '#ffffff' : '#444';
        b.style.boxShadow = isOn ? '0 0 0 2px #d8ff3c' : 'none';
      });
    });

    host.appendChild(panel);
    host.appendChild(toggleBtn);
    document.body.appendChild(host);
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
