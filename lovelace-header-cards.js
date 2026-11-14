/**
 * header-cards
 * One dashboard key, every view. Reads `header_cards` from the Lovelace
 * config and puts those cards (or label chips) into a header menu,
 * including subviews. A placed `custom:header-cards` is only a fallback.
 * The menu button shows an alert icon when something is inside.
 *
 * Lit redraws the toolbar and drops nodes it does not own. The slot is
 * moved back, not rebuilt, unless the card config changed.
 *
 *   header_cards:
 *     justify_content: right
 *     labels:
 *       - alert
 *       - override
 */
const THEME_VARS = [
  "--card-background-color",
  "--ha-card-background",
  "--primary-text-color",
  "--secondary-text-color",
  "--primary-color",
  "--error-color",
  "--divider-color",
];

function listOf(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return fallback.slice();
}

function shadowQuery(el, selector) {
  if (!el || !el.shadowRoot) return null;
  return el.shadowRoot.querySelector(selector);
}

function liveToolbar(header) {
  if (!header) return null;
  for (const bar of header.querySelectorAll(".toolbar")) {
    if (bar.closest(".edit-mode")) continue;
    return bar;
  }
  return null;
}

function place(slot, toolbar) {
  if (!slot || !toolbar) return;
  const actions = toolbar.querySelector(":scope > .action-items");
  toolbar.style.removeProperty("flex-wrap");
  toolbar.style.removeProperty("flex-direction");
  if (actions) {
    actions.style.removeProperty("display");
    actions.style.removeProperty("flex-direction");
    actions.style.removeProperty("flex-wrap");
    actions.style.removeProperty("flex");
    actions.style.removeProperty("align-items");
  }
  const parked = slot.parentElement === toolbar && (!actions || slot.nextElementSibling === actions);
  if (!parked) {
    if (actions) toolbar.insertBefore(slot, actions);
    else toolbar.appendChild(slot);
  }
}

function locate() {
  const root = shadowQuery(document.querySelector("home-assistant"), "home-assistant-main");
  const main = root && root.shadowRoot;
  if (!main) return null;
  const drawer = main.querySelector("ha-drawer");
  const scopes = [drawer, drawer && drawer.shadowRoot, main];
  let panel = null;
  for (const scope of scopes) {
    if (!scope || !scope.querySelector) continue;
    const resolver = scope.querySelector("partial-panel-resolver");
    const inner = (resolver && resolver.shadowRoot) || resolver;
    panel = inner && inner.querySelector && inner.querySelector("ha-panel-lovelace");
    if (panel) break;
  }
  if (!panel) panel = main.querySelector("ha-panel-lovelace");
  const hui = shadowQuery(panel, "hui-root");
  const shadow = hui && hui.shadowRoot;
  if (!shadow) return null;
  const header = shadow.querySelector(".header");
  const toolbar = liveToolbar(header);
  if (!toolbar) return null;
  return { panel, hui, header, toolbar };
}

function hassOf() {
  const ha = document.querySelector("home-assistant");
  const main = shadowQuery(ha, "home-assistant-main");
  return (main && main.hass) || (ha && ha.hass) || null;
}

function normalize(config) {
  if (!config) return null;
  const cards = (Array.isArray(config.cards) ? config.cards : []).filter(
    (card) => card && card.type !== "custom:header-cards",
  );
  const nested = (Array.isArray(config.cards) ? config.cards : []).find(
    (card) => card && card.type === "custom:header-cards",
  );
  const labels = listOf(config.labels, listOf(nested && nested.labels, []));
  const badges = Array.isArray(config.badges) ? config.badges : [];
  if (!labels.length && !cards.length && !badges.length) return null;
  return {
    replace_tabs: !!(config.replace_tabs || (nested && nested.replace_tabs)),
    justify_content: config.justify_content || (nested && nested.justify_content) || "right",
    show_empty: !!(config.show_empty || (nested && nested.show_empty)),
    content_info: config.content_info || (nested && nested.content_info) || "name",
    tap_action: actionOf(config.tap_action || (nested && nested.tap_action), "toggle"),
    labels,
    cards,
    badges,
  };
}

function actionOf(action, fallback) {
  if (!action) return fallback;
  if (typeof action === "string") return action;
  if (typeof action === "object" && action.action) return String(action.action);
  return fallback;
}

function needsRetry(slot, menu) {
  return [slot, menu].some((root) => {
    if (!root || !root.querySelectorAll) return false;
    for (const el of root.querySelectorAll("[data-hid][hidden]")) {
      if (!el.dataset.hcSkip) return true;
    }
    return false;
  });
}

const SKIP_CHIP = new Set(["mushroom-spacer-chip", "mushroom-conditional-chip", "mushroom-chips-card"]);

function isAlertChip(el) {
  if (!el || el.hidden || el.nodeType !== 1) return false;
  if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
  if (el.style && el.style.display === "none") return false;
  if (el.classList && el.classList.contains("header-chip")) return true;
  const name = el.localName || "";
  if (!name.startsWith("mushroom-") || !name.endsWith("-chip")) return false;
  return !SKIP_CHIP.has(name);
}

function nodeShown(node) {
  if (!node || node.hidden) return false;
  if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return false;
  if (node.style && node.style.display === "none") return false;
  return true;
}

function chipShown(el) {
  const root = el.shadowRoot;
  if (!root || !root.querySelector) return false;
  const card = root.querySelector("ha-card");
  if (card) return nodeShown(card);
  const span = root.querySelector("span");
  return !!(span && nodeShown(span) && span.textContent && span.textContent.trim());
}

function iconDrawn(icon) {
  const root = icon && icon.shadowRoot;
  if (!root || !root.querySelector) return false;
  const inner = root.querySelector("ha-svg-icon");
  if (inner && inner.shadowRoot && inner.shadowRoot.querySelector("path")) return true;
  return !!root.querySelector("svg path");
}

function menuCard(item) {
  const type = String((item && item.type) || "");
  const name = type.startsWith("custom:") ? type.slice(7) : type;
  return name === "mushroom-chips-card" || name === "auto-entities";
}

function flattenMenuRoot(root) {
  if (!root || !root.appendChild) return;
  const host = root.host;
  const name = (host && host.localName) || "";
  const chip = name.startsWith("mushroom-") && name.endsWith("-chip") && name !== "mushroom-chips-card";
  if (chip) {
    host.style.setProperty("--chip-height", "36px");
    host.style.setProperty("--chip-icon-size", "18px");
    host.style.setProperty("--chip-border-radius", "18px");
    host.style.setProperty("--chip-padding", "0 8px");
    let style = root.querySelector && root.querySelector("[data-hc-flat]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.hcFlat = "1";
      root.appendChild(style);
    }
    style.textContent = ":host{--chip-height:36px;--chip-icon-size:18px;--chip-border-radius:18px;--chip-padding:0 8px}";
    return;
  }
  let style = root.querySelector && root.querySelector("[data-hc-flat]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.hcFlat = "1";
    root.appendChild(style);
  }
  style.textContent = [
    "ha-card,#container,.card-content{background:transparent!important;box-shadow:none!important;border:none!important;padding:0!important;margin:0!important;border-radius:0!important}",
    ".chip-container{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important}",
    ":host{--ha-card-background:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0px}",
  ].join("");
}

function entityOf(event) {
  const path = event.composedPath ? event.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    const config = node._config || node.config;
    const id = config && (config.entity || config.entity_id);
    if (typeof id === "string") return id;
    if (node.stateObj && typeof node.stateObj.entity_id === "string") return node.stateObj.entity_id;
  }
  return null;
}

const NO_TOGGLE = new Set([
  "binary_sensor",
  "sensor",
  "device_tracker",
  "person",
  "weather",
  "zone",
  "sun",
  "camera",
  "image",
  "update",
  "button",
  "input_button",
  "scene",
  "event",
  "lock",
  "select",
  "input_select",
  "number",
  "input_number",
  "input_text",
  "input_datetime",
  "timer",
  "counter",
  "alarm_control_panel",
  "calendar",
  "todo",
  "automation",
  "script",
]);

function domainOf(id) {
  const text = String(id || "");
  const dot = text.indexOf(".");
  return dot === -1 ? "" : text.slice(0, dot);
}

function openMoreInfo(id) {
  const ha = document.querySelector("home-assistant");
  if (!ha || !id) return;
  ha.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
}

function actOn(id) {
  if (NO_TOGGLE.has(domainOf(id))) {
    openMoreInfo(id);
    return;
  }
  toggleEntity(id);
}

function toggleEntity(id) {
  const hass = hassOf();
  if (!hass || typeof hass.callService !== "function" || !id) return;
  const pending = hass.callService("homeassistant", "toggle", { entity_id: id });
  if (pending && typeof pending.catch === "function") pending.catch(() => {});
}

const POKED = new WeakMap();

function poke(el, hass) {
  if (!el) return;
  POKED.set(el, hass);
  el.hass = hass;
  if (typeof el.requestUpdate === "function") el.requestUpdate("hass", null);
}

// Later updates only hand over a new hass object, like hui-card does. A forced
// requestUpdate makes mushroom-chips-card rebuild every chip element.
function pokeChanged(el, hass) {
  if (!el || POKED.get(el) === hass) return;
  POKED.set(el, hass);
  el.hass = hass;
}

// Only write on change: the menu observer watches `hidden`, and even an
// unchanged attribute write queues a mutation record (repaint loop).
function setMenuVisible(menu, open) {
  if (!menu) return;
  if (menu.hidden !== !open) menu.hidden = !open;
  const display = open ? "flex" : "none";
  if (menu.style.getPropertyValue("display") !== display || menu.style.getPropertyPriority("display") !== "important") {
    menu.style.setProperty("display", display, "important");
  }
}

const BADGE_GAP = 500;

function buttonHidden(count, config) {
  if (count > 0) return false;
  if (config && config.show_empty) return false;
  return true;
}

function countAlerts(root, depth) {
  if (!root || depth > 8) return 0;
  let count = 0;
  const kids = root.children ? Array.from(root.children) : [];
  for (const el of kids) {
    if (!el || el.nodeType !== 1) continue;
    if (el.hidden || (el.getAttribute && el.getAttribute("aria-hidden") === "true") || (el.style && el.style.display === "none")) continue;
    if (isAlertChip(el)) {
      if (el.classList.contains("header-chip") || chipShown(el)) {
        count += 1;
        continue;
      }
    }
    count += countAlerts(el, depth + 1);
    if (el.shadowRoot) count += countAlerts(el.shadowRoot, depth + 1);
  }
  return count;
}

function labelNames(hass, entityId) {
  const entry = hass.entities && hass.entities[entityId];
  const ids = (entry && entry.labels) || [];
  const registry = hass.labels || {};
  const names = [];
  for (const id of ids) {
    names.push(String(id).toLowerCase());
    const name = registry[id] && registry[id].name;
    if (name) names.push(String(name).toLowerCase());
  }
  return names;
}

const ENTITY_RE = /\b[a-z_]+\.[a-z0-9_]+\b/g;
// Keys an auto-entities include rule may use and still be resolved here.
const PLAIN_RULE = new Set(["label", "state", "entity_id", "options", "not", "or", "and", "sort", "type"]);
const SOFT_GAP = 2000;

// Which entities can change what the hosted cards show? `hard` means the
// config filters in ways we cannot follow (domain, area, template, ...).
function watchList(config) {
  const ids = new Set();
  const labels = new Set((config.labels || []).map((label) => String(label).toLowerCase()));
  let hard = false;
  const walk = (value, key, rule) => {
    if (typeof value === "string") {
      if (key === "label" || key === "labels") labels.add(value.toLowerCase());
      if (rule && key === "entity_id" && /[*/]/.test(value)) hard = true;
      for (const match of value.matchAll(ENTITY_RE)) ids.add(match[0]);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, key, rule || key === "include" || key === "or" || key === "and");
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [name, item] of Object.entries(value)) {
      if (rule && !PLAIN_RULE.has(name)) hard = true;
      if (name === "template") hard = true;
      walk(item, name, rule && name !== "options");
    }
  };
  walk(config.cards, "cards", false);
  walk(config.badges, "badges", false);
  return { ids, labels, hard };
}

function waitForElement(tag, ms) {
  if (customElements.get(tag)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(!!customElements.get(tag)), ms);
    customElements.whenDefined(tag).then(() => {
      clearTimeout(timer);
      finish(true);
    });
  });
}

class HeaderCardsController {
  constructor() {
    this._building = false;
    this._again = false;
    this._away = false;
    this._header = null;
    this._headerObs = null;
    this._helpers = null;
    this._slot = null;
    this._open = false;
    this._dead = false;
    this._unsubs = [];
    this._onDocClick = (event) => this.onOutside(event);
    this._onKey = (event) => {
      if (event.key === "Escape") this.close();
    };
    this._onResize = () => this.positionMenu();
    this.watchHass();
    document.addEventListener("click", this._onDocClick, true);
    document.addEventListener("keydown", this._onKey);
    window.addEventListener("resize", this._onResize);
    this._boot = setInterval(() => {
      const slot = this._slot;
      const missing = !slot || !slot.isConnected;
      const root = this._menu;
      const hidden = needsRetry(slot, root);
      if (!this._header || !this._header.isConnected || !liveToolbar(this._header)) this.close();
      if (!this._hassWatch) this.watchHass();
      if (hidden) this._hiddenTries = (this._hiddenTries || 0) + 1;
      else this._hiddenTries = 0;
      if (this._away || this._pending || (missing && (this._config || !this._header || !this._header.isConnected)) || (hidden && this._hiddenTries < 30)) this.schedule();
    }, 1000);
    this.schedule();
  }

  destroy() {
    this._dead = true;
    clearInterval(this._boot);
    clearTimeout(this._timer);
    clearTimeout(this._hassTimer);
    clearTimeout(this._badgeTimer);
    clearTimeout(this._badgeLate);
    document.removeEventListener("click", this._onDocClick, true);
    document.removeEventListener("keydown", this._onKey);
    window.removeEventListener("resize", this._onResize);
    if (this._headerObs) this._headerObs.disconnect();
    if (this._toolbarObs) this._toolbarObs.disconnect();
    if (this._menuObs) this._menuObs.disconnect();
    if (this._menuSize) this._menuSize.disconnect();
    this.dropShadows();
    if (this._slot && this._slot.parentElement) this._slot.remove();
    if (this._menu && this._menu.parentElement) this._menu.remove();
    this._slot = null;
    this._menu = null;
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    }
    this._unsubs = [];
  }

  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.render(), 60);
  }

  parkAway() {
    this._away = true;
    this.close();
    if (this._headerObs) this._headerObs.disconnect();
    if (this._toolbarObs) this._toolbarObs.disconnect();
    this._headerObs = null;
    this._toolbarObs = null;
    this._header = null;
    this._toolbar = null;
    if (this._slot && !this._slot.isConnected) this._slot.remove();
  }

  async watchHass() {
    if (this._hassWatch) return;
    this._hassWatch = true;
    try {
      const connection = await window.hassConnection;
      if (this._dead) return;
      const types = ["state_changed", "entity_registry_updated"];
      for (const eventType of types) {
        const unsub = await connection.conn.subscribeMessage(
          (event) => this.onHassEvent(event),
          { type: "subscribe_events", event_type: eventType },
        );
        if (unsub) this._unsubs.push(unsub);
        if (this._dead) return;
      }
    } catch {
      this._hassWatch = false;
    } finally {
      if (this._dead || this._hassWatch === false) {
        for (const fn of this._unsubs) {
          try { fn(); } catch { /* ignore */ }
        }
        this._unsubs = [];
      }
    }
  }

  onHassEvent(event) {
    if (this._dead || !event) return;
    if (this._away || (this._slot && !this._slot.isConnected) || (!this._slot && this._config)) {
      this.schedule();
      return;
    }
    if (!this._slot) return;
    if (event.event_type === "entity_registry_updated") {
      if (this._usesLabels) this.schedule();
      else this.applyHass(true);
      return;
    }
    if (event.event_type !== "state_changed") return;
    const data = event.data || {};
    const id = data.entity_id;
    const prev = data.old_state && data.old_state.state;
    const next = data.new_state && data.new_state.state;
    if (!this._usesLabels || (prev === next && !(this._chipIds && this._chipIds.has(id)))) {
      this.applyHass(this.isRelevant(id));
      return;
    }
    if (prev !== "on" && next !== "on" && !(this._chipIds && this._chipIds.has(id))) {
      this.applyHass(this.isRelevant(id));
      return;
    }
    this.schedule();
  }

  onDom() {
    if (this._building) {
      this._again = true;
      return;
    }
    const toolbar = liveToolbar(this._header);
    if (!this._header || !this._header.isConnected || !toolbar) {
      this.close();
      this.schedule();
      return;
    }
    this.bindToolbar(toolbar);
    const slot = this._slot;
    if (!slot || slot.dataset.pending === "1" || needsRetry(slot, this._menu)) {
      this.schedule();
      return;
    }
    place(slot, toolbar);
    if (this._config) this.layout(toolbar, this._config);
    this.refreshBadge();
    if (this._open) this.positionMenu();
  }

  watchHeader(header) {
    if (this._header === header && this._headerObs) {
      this.bindToolbar(liveToolbar(header));
      return;
    }
    if (this._headerObs) this._headerObs.disconnect();
    if (this._toolbarObs) this._toolbarObs.disconnect();
    this._toolbar = null;
    this._header = header;
    this._headerObs = new MutationObserver(() => this.onDom());
    this._headerObs.observe(header, { childList: true });
    this.bindToolbar(liveToolbar(header));
  }

  bindToolbar(toolbar) {
    if (this._toolbar === toolbar) return;
    if (this._toolbarObs) this._toolbarObs.disconnect();
    this._toolbar = toolbar || null;
    this._toolbarObs = null;
    if (!toolbar) return;
    this._toolbarObs = new MutationObserver(() => this.onDom());
    this._toolbarObs.observe(toolbar, { childList: true });
  }

  activeConfig(ctx) {
    const found = ctx || locate();
    const ll = found && ((found.hui && found.hui.lovelace) || (found.panel && found.panel.lovelace));
    const key = ll && ((ll.rawConfig && ll.rawConfig.header_cards) || (ll.config && ll.config.header_cards));
    return normalize(key) || normalize(window.__headerCardsFallback);
  }

  chips(config, hass) {
    if (!hass || !hass.states || !config.labels.length) return [];
    const wanted = config.labels.map((label) => label.toLowerCase());
    const list = [];
    for (const entityId of Object.keys(hass.states)) {
      const names = labelNames(hass, entityId);
      if (!wanted.some((label) => names.includes(label))) continue;
      const state = hass.states[entityId];
      if (!state || state.state !== "on") continue;
      list.push(state);
    }
    list.sort((a, b) => (Date.parse(b.last_changed || "") || 0) - (Date.parse(a.last_changed || "") || 0));
    return list;
  }

  async render() {
    if (this._building) {
      this._again = true;
      return;
    }
    const ctx = locate();
    if (!ctx) {
      this.parkAway();
      return;
    }
    this._away = false;
    this.watchHass();
    this.watchHeader(ctx.header);
    const config = this.activeConfig(ctx);
    if (!config) {
      this._usesLabels = false;
      this._pending = false;
      this._config = null;
      if (this._slot && this._slot.parentElement) this._slot.remove();
      this._slot = null;
      if (this._menuObs) this._menuObs.disconnect();
      if (this._menuSize) this._menuSize.disconnect();
      this.dropShadows();
      if (this._menu) this._menu.remove();
      this._menu = null;
      this.layout(ctx.toolbar, { replace_tabs: false });
      return;
    }
    this._config = config;
    const hass = hassOf();
    const chips = this.chips(config, hass);
    this._usesLabels = config.labels.length > 0;
    this._chipIds = new Set(chips.map((state) => state.entity_id));
    const configSig = JSON.stringify(config);
    const chipSig = chips.map((state) => {
      const name = (state.attributes && state.attributes.friendly_name) || "";
      return `${state.entity_id}:${state.state}:${state.last_changed}:${state.last_updated}:${name}`;
    }).join("\n");
    const slot = this._slot;
    const retry = needsRetry(slot, this._menu);
    const same = slot && slot.dataset.config === configSig;
    if (same && slot.dataset.chips !== chipSig) {
      const labels = this._menu && this._menu.querySelector("#headerCardLabels");
      if (labels) this.paintLabels(labels, config, chips, hass);
      slot.dataset.chips = chipSig;
    }
    if (same && slot.dataset.pending !== "1" && !retry) {
      this._pending = false;
      place(slot, ctx.toolbar);
      this.layout(ctx.toolbar, config);
      this.paintTheme(ctx.toolbar);
      this.applyHass();
      if (this._open) this.positionMenu();
      return;
    }
    if (same && (slot.dataset.pending === "1" || retry)) {
      this._building = true;
      try {
        place(slot, ctx.toolbar);
        this._pending = true;
        const pending = await this.paintHosted(slot, config, hass);
        if (this._dead) return;
        const live = locate();
        if (!live) {
          this.parkAway();
          return;
        }
        this.watchHeader(live.header);
        slot.dataset.pending = pending ? "1" : "0";
        this._pending = !!pending;
        place(slot, live.toolbar);
        this.applyHass();
        this.refreshBadge();
      } finally {
        this._building = false;
        if (this._again && !this._dead) {
          this._again = false;
          this.schedule();
        }
      }
      return;
    }

    this._building = true;
    try {
      if (slot && slot.parentElement) slot.remove();
      this._wait = {};
      const next = document.createElement("div");
      next.id = "headerCards";
      next.dataset.config = configSig;
      next.dataset.chips = chipSig;
      next.dataset.pending = "0";
      next.style.display = "none";
      next.style.alignItems = "center";
      next.style.alignSelf = "center";
      next.style.flex = "0 0 auto";
      next.style.justifyContent = "flex-end";
      this._slot = next;
      this._open = false;
      const menu = this.buildChrome(next);
      place(next, ctx.toolbar);

      const labels = menu.querySelector("#headerCardLabels");
      this.paintLabels(labels, config, chips, hass);

      let toolbar = ctx.toolbar;
      if (config.badges.length || config.cards.length) {
        this._pending = true;
        const pending = await this.paintHosted(next, config, hass);
        if (this._dead) return;
        const live = locate();
        if (!live) {
          this.parkAway();
          return;
        }
        this.watchHeader(live.header);
        next.dataset.pending = pending ? "1" : "0";
        this._pending = !!pending;
        toolbar = live.toolbar;
      } else {
        this._pending = false;
      }
      place(next, toolbar);
      this.layout(toolbar, config);
      this.paintTheme(toolbar);
      this.refreshBadge();
    } finally {
      this._building = false;
      if (this._again && !this._dead) {
        this._again = false;
        this.schedule();
      }
    }
  }

  buildChrome(slot) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-cards-toggle";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.style.cssText = [
      "position:relative",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "width:40px",
      "height:40px",
      "padding:0",
      "border:0",
      "border-radius:20px",
      "background:transparent",
      "color:var(--secondary-text-color, var(--primary-text-color))",
      "cursor:pointer",
      "flex:0 0 auto",
    ].join(";");
    const icon = document.createElement("ha-icon");
    icon.className = "header-cards-icon";
    icon.setAttribute("icon", "mdi:bell");
    icon.icon = "mdi:bell";
    icon.style.width = "24px";
    icon.style.height = "24px";
    icon.style.setProperty("--mdc-icon-size", "24px");
    icon.style.color = "var(--secondary-text-color, var(--primary-text-color))";
    const badge = document.createElement("span");
    badge.className = "header-cards-count";
    badge.style.cssText = [
      "position:absolute",
      "top:4px",
      "right:2px",
      "z-index:1",
      "box-sizing:border-box",
      "min-width:16px",
      "height:16px",
      "padding:0 4px",
      "border-radius:999px",
      "background:var(--error-color, #f44336)",
      "color:#fff",
      "box-shadow:0 0 0 2px var(--app-header-background-color, var(--primary-background-color, #111))",
      "font-family:var(--ha-font-family-body, sans-serif)",
      "font-size:11px",
      "font-weight:700",
      "line-height:16px",
      "text-align:center",
      "pointer-events:none",
      "display:none",
    ].join(";");
    badge.style.setProperty("font-size", "11px", "important");
    badge.style.setProperty("line-height", "16px", "important");
    button.append(icon, badge);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this._open) this.close();
      else this.open();
    });

    const menu = document.createElement("div");
    menu.id = "headerCardsMenu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.style.cssText = [
      "position:fixed",
      "z-index:6",
      "flex-direction:column",
      "gap:2px",
      "width:max-content",
      "max-width:min(280px, calc(100vw - 16px))",
      "max-height:min(70vh, 480px)",
      "overflow:auto",
      "padding:4px",
      "box-sizing:border-box",
      "border-radius:12px",
      "background:var(--card-background-color, #1c1c1c)",
      "border:1px solid var(--divider-color, rgba(255,255,255,.12))",
      "box-shadow:0 8px 24px rgba(0,0,0,.4)",
    ].join(";");
    setMenuVisible(menu, false);
    const labels = document.createElement("div");
    labels.id = "headerCardLabels";
    labels.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    menu.appendChild(labels);
    slot.append(button);
    if (this._menu && this._menu.parentElement) this._menu.remove();
    (document.body || document.documentElement).appendChild(menu);
    this._menu = menu;
    if (this._menuObs) this._menuObs.disconnect();
    this.dropShadows();
    this._menuObs = new MutationObserver(() => this.refreshBadge());
    this._menuObs.observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
    if (this._menuSize) this._menuSize.disconnect();
    if (typeof ResizeObserver === "function") {
      this._menuSize = new ResizeObserver(() => {
        if (this._open) this.positionMenu();
      });
      this._menuSize.observe(menu);
    }
    menu.addEventListener("pointerup", (event) => this.onMenuPress(event), true);
    menu.addEventListener("touchend", (event) => this.onMenuPress(event), true);
    menu.addEventListener("click", (event) => this.onMenuPress(event), true);
    return menu;
  }

  onMenuPress(event) {
    if (event.button > 0) return;
    const path = event.composedPath ? event.composedPath() : [];
    const own = path.some((node) => node && node.classList && node.classList.contains("header-chip"));
    if (event.type !== "click") {
      if (!own) event.stopPropagation();
      return;
    }
    const id = own ? null : entityOf(event);
    if (id) {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (!this._lastAct || this._lastAct.id !== id || now - this._lastAct.at > 700) {
        this._lastAct = { id, at: now };
        actOn(id);
      }
    }
    setTimeout(() => this.close(), 0);
  }

  open() {
    const menu = this._menu;
    const button = this._slot && this._slot.querySelector(".header-cards-toggle");
    if (!menu || !button) return;
    this._open = true;
    const rect = button.getBoundingClientRect();
    menu.style.left = "auto";
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    setMenuVisible(menu, true);
    button.setAttribute("aria-expanded", "true");
    this.positionMenu();
    requestAnimationFrame(() => this.positionMenu());
  }

  close() {
    this._open = false;
    setMenuVisible(this._menu, false);
    const button = this._slot && this._slot.querySelector(".header-cards-toggle");
    if (button) button.setAttribute("aria-expanded", "false");
  }

  onOutside(event) {
    if (!this._open) return;
    const path = event.composedPath ? event.composedPath() : [];
    if (this._slot && path.includes(this._slot)) return;
    if (this._menu && path.includes(this._menu)) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  positionMenu() {
    if (!this._open || !this._slot || !this._menu || this._placing) return;
    const button = this._slot.querySelector(".header-cards-toggle");
    if (!button) return;
    this._placing = true;
    try {
      const menu = this._menu;
      const rect = button.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const margin = 8;
      const viewport = window.innerWidth;
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      let right = Math.max(margin, Math.round(viewport - rect.right));
      const top = Math.round(rect.bottom + 6);
      menu.style.left = "auto";
      menu.style.maxWidth = `${Math.min(280, viewport - margin * 2)}px`;
      menu.style.maxHeight = `${Math.max(120, Math.round(height - top - margin))}px`;
      menu.style.right = `${right}px`;
      menu.style.top = `${top}px`;
      const box = menu.getBoundingClientRect();
      if (box.width <= 0) return;
      if (box.right > viewport - margin) {
        right += box.right - (viewport - margin);
        menu.style.right = `${Math.round(right)}px`;
      }
      const next = menu.getBoundingClientRect();
      if (next.left < margin) {
        const room = viewport - margin - next.right;
        const shift = Math.min(margin - next.left, Math.max(0, room));
        if (shift > 0) menu.style.right = `${Math.round(right - shift)}px`;
      }
    } finally {
      this._placing = false;
    }
  }

  // Coalesce: one pending paint at a time, at most one full pass per BADGE_GAP.
  refreshBadge() {
    if (this._badgeTimer) return;
    const wait = Math.max(32, BADGE_GAP - (Date.now() - (this._badgeAt || 0)));
    this._badgeTimer = setTimeout(() => {
      this._badgeTimer = null;
      this.paintBadge();
    }, wait);
  }

  paintBadge(iconOnly) {
    const slot = this._slot;
    const menu = this._menu;
    if (!slot || !menu) return;
    let count = this._badgeCount;
    if (!iconOnly || count === undefined) {
      clearTimeout(this._badgeTimer);
      this._badgeTimer = null;
      this._badgeAt = Date.now();
      count = countAlerts(menu, 0);
      this._badgeCount = count;
      this.bindShadows(menu);
    }
    if (this._pending) return;
    const button = slot.querySelector(".header-cards-toggle");
    const show = count > 0;
    const icon = slot.querySelector(".header-cards-icon");
    const badge = slot.querySelector(".header-cards-count");
    const drawn = iconDrawn(icon);
    if (drawn) this._iconTries = 0;
    if (icon) {
      if (icon.getAttribute("icon") !== "mdi:bell") {
        icon.setAttribute("icon", "mdi:bell");
        icon.icon = "mdi:bell";
      }
      icon.style.color = "var(--secondary-text-color, var(--primary-text-color))";
      icon.style.width = "24px";
      icon.style.height = "24px";
      icon.style.setProperty("--mdc-icon-size", "24px");
    }
    if (badge) {
      const text = count > 99 ? "99+" : String(count);
      if (badge.textContent !== text) badge.textContent = text;
      badge.style.display = show ? "block" : "none";
    }
    if (button) {
      const noAlerts = buttonHidden(count, this._config);
      let hide = noAlerts;
      if (!hide && !drawn && (this._iconTries || 0) < 40) {
        hide = true;
        if (!this._iconWait) {
          this._iconWait = true;
          const reveal = () => requestAnimationFrame(() => {
            this._iconWait = false;
            this._iconTries = (this._iconTries || 0) + 1;
            this.paintBadge(true);
          });
          if (customElements.get("ha-icon")) reveal();
          else customElements.whenDefined("ha-icon").then(reveal);
        }
      }
      button.style.display = hide ? "none" : "inline-flex";
      const hosted = slot.querySelector("[data-hid]:not([hidden])");
      slot.style.display = hide && !hosted ? "none" : "inline-flex";
      button.setAttribute("aria-label", show ? `Alerts, ${count}` : "Alerts");
      if (noAlerts) this.close();
    }
  }

  dropShadows() {
    if (this._shadowObs) this._shadowObs.forEach((rec) => rec.obs.disconnect());
    this._shadowObs = [];
    this._seenRoots = new WeakSet();
  }

  bindShadows(root) {
    const live = [];
    for (const rec of this._shadowObs || []) {
      if (rec.host && rec.host.isConnected) live.push(rec);
      else {
        rec.obs.disconnect();
        if (this._seenRoots && rec.host && rec.host.shadowRoot) this._seenRoots.delete(rec.host.shadowRoot);
      }
    }
    this._shadowObs = live;
    if (!root || !root.querySelectorAll) return;
    const seen = this._seenRoots || (this._seenRoots = new WeakSet());
    const visit = (node, depth) => {
      if (!node || !node.querySelectorAll || depth > 8) return;
      for (const el of node.querySelectorAll("*")) {
        const shadow = el.shadowRoot;
        if (!shadow) continue;
        if (seen.has(shadow)) {
          visit(shadow, depth + 1);
          continue;
        }
        if (el.localName === "ha-icon" || el.localName === "ha-svg-icon" || el.localName === "ha-state-icon" || el.localName === "ha-tooltip") continue;
        seen.add(shadow);
        flattenMenuRoot(shadow);
        const obs = new MutationObserver(() => this.refreshBadge());
        obs.observe(shadow, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
        (this._shadowObs || (this._shadowObs = [])).push({ obs, host: el });
        visit(shadow, depth + 1);
      }
    };
    visit(root, 0);
  }

  paintLabels(node, config, chips, hass) {
    node.replaceChildren();
    if (!chips.length) {
      if (!config.show_empty) return;
      const empty = document.createElement("span");
      empty.textContent = "keine Alerts";
      empty.style.cssText = "opacity:.6;font-size:13px;padding:0 8px;";
      node.appendChild(empty);
      return;
    }
    for (const state of chips) node.appendChild(this.chip(state, config, hass));
  }

  chip(state, config, hass) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-chip";
    button.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "width:100%",
      "height:36px",
      "padding:0 10px",
      "border:0",
      "border-radius:12px",
      "background:color-mix(in srgb, var(--primary-text-color, #fff) 10%, transparent)",
      "color:var(--primary-text-color, #fff)",
      "font:inherit",
      "font-size:14px",
      "cursor:pointer",
      "text-align:left",
    ].join(";");
    const icon = document.createElement("ha-state-icon");
    icon.hass = hass;
    icon.stateObj = state;
    button.appendChild(icon);
    if (config.content_info !== "none") {
      const text = document.createElement("span");
      const info = config.content_info === "state" ? state.state : state.attributes.friendly_name || state.entity_id;
      text.textContent = info;
      text.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      button.appendChild(text);
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (config.tap_action === "none") return;
      if (config.tap_action === "more-info") openMoreInfo(state.entity_id);
      else if (config.tap_action === "toggle") actOn(state.entity_id);
    });
    return button;
  }

  async paintHosted(slot, config, hass) {
    if (!this._helpers && window.loadCardHelpers) {
      try {
        this._helpers = window.loadCardHelpers();
      } catch {
        this._helpers = null;
      }
    }
    let helpers = null;
    try {
      helpers = this._helpers ? await this._helpers : null;
    } catch {
      this._helpers = null;
      return true;
    }
    if (this._dead) return false;
    if (!helpers) {
      this._helpersMiss = (this._helpersMiss || 0) + 1;
      return this._helpersMiss < 20;
    }
    this._helpersMiss = 0;
    const items = [
      ...config.badges.map((item) => ({ item, kind: "badge" })),
      ...config.cards.map((item) => ({ item, kind: "card" })),
    ];
    const host = this._menu || slot;
    let pending = false;
    for (let index = 0; index < items.length; index += 1) {
      const inline = items[index].kind !== "card" || !menuCard(items[index].item);
      const ok = await this.addHosted(
        inline ? slot : host,
        items[index].item,
        items[index].kind,
        hass,
        `h${index}`,
        inline,
      );
      if (this._dead) return pending;
      if (!ok) pending = true;
    }
    return pending;
  }

  async addHosted(slot, item, kind, hass, id, inline) {
    if (!this._helpers) return false;
    const helpers = await this._helpers;
    if (this._dead || !helpers) return false;
    const factory = kind === "badge" ? helpers.createBadgeElement : helpers.createCardElement;
    if (!factory || !item) return true;
    let tag = item.type || "";
    if (tag.startsWith("custom:")) tag = tag.slice(7);
    const existing = slot.querySelector(`[data-hid="${id}"]`);
    if (existing && !(existing.hidden && customElements.get(tag))) return true;
    if (existing) existing.remove();
    const custom = String(item.type || "").startsWith("custom:");
    if (custom && tag.includes("-") && !customElements.get(tag)) {
      const found = await waitForElement(tag, 400);
      if (this._dead) return false;
      if (!found) {
        this._wait = this._wait || {};
        this._wait[id] = (this._wait[id] || 0) + 1;
        if (this._wait[id] < 20) return false;
        const skip = document.createElement("span");
        skip.dataset.hid = id;
        skip.dataset.hcSkip = "1";
        skip.hidden = true;
        slot.appendChild(skip);
        return true;
      }
    }
    let el;
    try {
      el = factory(item);
    } catch {
      return true;
    }
    el.classList.add(kind === "badge" ? "header-badge" : "header-card");
    el.style.margin = "0";
    if (!inline) {
      el.style.display = "block";
      el.style.width = "max-content";
      el.style.maxWidth = "100%";
      el.style.setProperty("--ha-card-background", "transparent");
      el.style.setProperty("--ha-card-box-shadow", "none");
      el.style.setProperty("--ha-card-border-width", "0px");
    }
    const wrap = document.createElement("div");
    wrap.dataset.hid = id;
    if (inline) {
      wrap.style.display = "contents";
    } else {
      wrap.style.display = "block";
      wrap.style.width = "max-content";
      wrap.style.maxWidth = "100%";
    }
    wrap.appendChild(el);
    slot.appendChild(wrap);
    if (!inline) flattenMenuRoot(el.shadowRoot);
    poke(el, hass);
    return true;
  }

  // true: forward soon; null: unknown, forward at most every SOFT_GAP;
  // false: nothing in the header depends on it, plan nothing.
  isRelevant(id) {
    if (this._watchFor !== this._config) {
      this._watchFor = this._config;
      this._watch = this._config ? watchList(this._config) : null;
    }
    const watch = this._watch;
    if (!watch || watch.hard) return null;
    if (watch.ids.has(id) || (this._chipIds && this._chipIds.has(id))) return true;
    if (!watch.labels.size) return false;
    const hass = hassOf();
    if (!hass || !hass.entities) return null;
    return labelNames(hass, id).some((name) => watch.labels.has(name));
  }

  applyHass(relevant = true) {
    if (relevant === true) this._hassDirty = true;
    else if (relevant === null) this._hassSoft = true;
    if (this._hassTimer || (!this._hassDirty && !this._hassSoft)) return;
    this._hassTimer = setTimeout(() => this.flushHass(), 50);
  }

  flushHass() {
    this._hassTimer = null;
    if (!this._hassDirty) {
      if (!this._hassSoft) return;
      const gap = SOFT_GAP - (Date.now() - (this._hassAt || 0));
      if (gap > 0) {
        this._hassTimer = setTimeout(() => this.flushHass(), gap);
        return;
      }
    }
    this._hassDirty = false;
    this._hassSoft = false;
    this._hassAt = Date.now();
    const hass = hassOf();
    const slot = this._slot;
    const menu = this._menu;
    const slotLive = !!(slot && slot.isConnected);
    const menuLive = !!(menu && menu.isConnected);
    if (!hass || (!slotLive && !menuLive)) return;
    const roots = [slotLive ? slot : null, menuLive ? menu : null].filter((root) => root && root.querySelectorAll);
    for (const root of roots) {
      root.querySelectorAll(".header-card, .header-badge, .header-chip").forEach((el) => {
        pokeChanged(el, hass);
      });
      root.querySelectorAll("ha-state-icon").forEach((el) => {
        el.hass = hass;
        const id = el.stateObj && el.stateObj.entity_id;
        if (id && hass.states && hass.states[id]) el.stateObj = hass.states[id];
      });
    }
    this.refreshBadge();
    if (!this._config || (!this._config.cards.length && !this._config.badges.length)) return;
    if (this._badgeLate) {
      this._badgeAgain = true;
      return;
    }
    const later = () => {
      this._badgeLate = null;
      if (this._dead) return;
      this.refreshBadge();
      if (!this._badgeAgain) return;
      this._badgeAgain = false;
      this._badgeLate = setTimeout(() => {
        this._badgeLate = null;
        this._badgeAgain = false;
        if (!this._dead) this.refreshBadge();
      }, 1000);
    };
    this._badgeLate = setTimeout(later, 1000);
  }

  paintTheme(node) {
    const menu = this._menu;
    if (!menu || !node || typeof getComputedStyle !== "function") return;
    const style = getComputedStyle(node);
    for (const name of THEME_VARS) {
      const value = style.getPropertyValue(name).trim();
      if (value) menu.style.setProperty(name, value);
    }
    if (style.color) menu.style.color = style.color;
  }

  layout(toolbar, config) {
    const tabs = toolbar.querySelector(":scope > ha-tab-group, :scope > ha-tabs");
    const title = toolbar.querySelector(":scope > .main-title, :scope > [main-title]");
    for (const node of [tabs, title]) {
      if (!node) continue;
      if (config.replace_tabs) {
        if (!node.dataset.hcTabs && node.style.display !== "none") node.dataset.hcTabs = node.style.display || "initial";
        node.style.display = "none";
      } else if (node.dataset.hcTabs) {
        node.style.display = node.dataset.hcTabs === "initial" ? "" : node.dataset.hcTabs;
        delete node.dataset.hcTabs;
      }
    }
  }
}

class HeaderCardsCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("header-cards-editor");
  }

  static getStubConfig() {
    return {
      labels: ["alert", "override"],
      content_info: "name",
      tap_action: "toggle",
      justify_content: "right",
      show_empty: false,
      replace_tabs: false,
    };
  }

  setConfig(config) {
    this._config = config || {};
    this.style.display = "none";
    const parent = this.parentElement;
    if (parent && parent.localName === "hui-card") parent.style.display = "none";
    const live = window.__headerCardsFallbackEl;
    if (live && live !== this && live.isConnected) return;
    window.__headerCardsFallback = this._config;
    window.__headerCardsFallbackEl = this;
    if (window.HeaderCards) window.HeaderCards.schedule();
  }

  disconnectedCallback() {
    if (window.__headerCardsFallbackEl !== this) return;
    queueMicrotask(() => {
      if (this.isConnected || window.__headerCardsFallbackEl !== this) return;
      window.__headerCardsFallback = null;
      window.__headerCardsFallbackEl = null;
      if (window.HeaderCards) window.HeaderCards.schedule();
    });
  }

  getCardSize() {
    return 0;
  }
}

class HeaderCardsEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    const labels = listOf(this._config.labels, ["alert", "override"]).join(", ");
    this.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
        <p style="margin:0;opacity:.7;font-size:13px">Nur diese Ansicht, und nur solange die Karte hier liegt. Für alle Ansichten den Schlüssel header_cards in der Raw-Config nutzen.</p>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:14px">
          Labels
          <input id="labels" style="padding:8px;font:inherit">
        </label>
      </div>
    `;
    const input = this.querySelector("#labels");
    input.value = labels;
    input.addEventListener("change", () => {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: { ...this._config, labels: listOf(input.value, []) } },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }
}

if (!customElements.get("header-cards")) customElements.define("header-cards", HeaderCardsCard);
if (!customElements.get("header-cards-editor")) customElements.define("header-cards-editor", HeaderCardsEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "header-cards")) {
  window.customCards.push({
    type: "header-cards",
    name: "Header Cards",
    description: "Chips rechts im Header, auf jeder Ansicht",
    preview: false,
  });
}

function boot() {
  const previous = window.HeaderCards;
  if (previous && typeof previous.destroy === "function") previous.destroy();
  window.HeaderCards = new HeaderCardsController();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
