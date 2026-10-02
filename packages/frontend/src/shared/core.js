/* eslint-disable no-sequences */
import { TODAY, ROLES, USERS, PROJECTS, SITES, FEED, ISSUES, SNAGS, MATERIALS, THREADS, MESSAGES, MOODBOARD, ROOMS, BOOKINGS, LEAVES, HOLIDAYS, ATTENDANCE_TODAY, SALARY, BADGES, TASKS, AUDIT, NAS_TREE, ORG_LEAVE_TYPES, ORG_LEAVE_REQUESTS, ORG_HOLIDAYS } from './data.js';
import { TIMESHEETS, TRANSMITTALS, RFIS, CHANGES, INVOICES, MEETINGS, VENDORS, HEADCOUNT, GRNS, DOCS, BRIEFS, SIGNATURES, SPOTS, AGENCY, TRADES, STATUTORY_TEMPLATES, STATUTORY, SERVICE_TYPES, ROUTING_RULES, ENQUIRIES, EXPENSES, SITE_CHECKINS, FOLLOWUPS, DECISIONS_DUE, CONNECTIONS, SHARE_LINKS, REVIEWS, PUNCHES, DRAWING_INDEX, INTAKE, PORTFOLIO, CLIENT_REFS, NOTIFICATIONS } from './data2.js';
import { render } from './store.js';
import * as SEED_MAIN from './data.js';
import * as SEED_MORE from './data2.js';
import { shiftSeedExports, shiftDates, daysBetween, monthDelta, addDays, SEED_TODAY } from './liveDates.js';
// Move the sample data from its fixed day to the real current date (see liveDates.js).
shiftSeedExports(SEED_MAIN);
shiftSeedExports(SEED_MORE);
export { render };
// ---------- Core: state, RBAC, service layer, sync queue, AI provider, router ----------
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Plain text remains the portable fallback when private tenant assets are unavailable.
export const wordmark = (s) => esc(s);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeAssetUrl = (url) => typeof url === "string" && /^(?:\.{1,2}\/|\/(?!\/)|https?:\/\/)/i.test(url) ? url : "";
export function tenantBrand() {
  const agency = state.db.AGENCY;
  return agency.brand?.name === agency.name && agency.brand?.short === agency.short ? agency.brand : null;
}
export function tenantWordmark() {
  const agency = state.db.AGENCY, src = safeAssetUrl(tenantBrand()?.logo);
  return src ? `<span class="tenant-wordmark"><img class="tenant-logo" src="${esc(src)}" alt="${esc(agency.short)}" width="180" height="59" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><b hidden>${esc(agency.short)}</b></span>` : wordmark(agency.short);
}
export function tenantProjectImage(projectId) {
  const image = tenantBrand()?.projects?.[projectId];
  return image && safeAssetUrl(image.src) ? image : null;
}
// Reads a design token's CURRENT value straight from the cascade (so this file can never drift
// out of sync with src/index.css the way its old hardcoded hex approximations did) — falling back
// to today's real value only if computed styles aren't available (e.g. no DOM yet).
function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  } catch (_) {
    return fallback;
  }
}
// Brand accents are tenant data. Derive readable light/dark treatments without
// changing the tenant's saved choice or reusing brand colour as a status signal.
export function agencyTheme(accent, dark = false) {
  const hex = /^#[0-9a-f]{6}$/i.test(accent || "") ? accent : "#16587b";
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const str = a => "#" + a.map(v => v.toString(16).padStart(2, "0")).join("");
  const luminance = a => a.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  // The default brand blue has a hand-tuned dark-theme pair (index.css); derive only for custom accents.
  if (dark && hex.toLowerCase() === "#16587b") return {accent: "#84b3ce", text: "#a5c9dd", ink: "#0c1e29", soft: "#1d4157"};
  const base = rgb(hex), target = dark ? [255, 255, 255] : [0, 0, 0];
  // These track --surface / --mine (the outgoing-bubble token) from index.css at call time.
  const surface = rgb(cssVar("--surface", dark ? "#153243" : "#ffffff"));
  let color = base;
  for (let step = 0; contrast(color, surface) < 4.5 && step <= 100; step++) color = mix(base, target, step / 100);
  // Text also appears on outgoing bubbles, which are stronger than page surfaces.
  const textSurface = rgb(cssVar("--mine", dark ? "#1f465c" : "#dce8ee"));
  let textColor = color;
  for (let step = 0; contrast(textColor, textSurface) < 4.5 && step <= 100; step++) textColor = mix(color, target, step / 100);
  return {accent: str(color), text: str(textColor), ink: dark ? "#0f2431" : "#ffffff", soft: str(mix(color, rgb(dark ? "#153243" : "#ffffff"), dark ? .86 : .91))};
}
export function applyAgencyTheme() {
  const dark = state.theme === "dark" || (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const t = agencyTheme(state.db?.AGENCY?.accent || AGENCY.accent, dark);
  const tokens = {accent:t.accent, "accent-ink":t.ink, "on-accent":t.ink, "accent-text":t.text, "accent-soft":t.soft, client:t.text, "client-soft":t.soft, sel:t.accent, "sel-ink":t.ink};
  for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty("--" + key, value);
  // One background colour chosen in Settings; the dark theme gets an automatically darkened version of it.
  const bg = state.db?.AGENCY?.background;
  const shown = bg && /^#[0-9a-f]{6}$/i.test(bg) ? (dark ? darkenBackground(bg) : bg) : "";
  for (const k of ["ground", "chat"]) {
    if (shown) document.documentElement.style.setProperty("--" + k, shown);
    else document.documentElement.style.removeProperty("--" + k);
  }
}
// Keep the hue of the chosen colour, but make it a deep, low-saturation ground that suits dark surfaces.
export function darkenBackground(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(((h * 60) + 360) % 360);
  const l0 = (max + min) / 2;
  const s0 = d ? d / (1 - Math.abs(2 * l0 - 1)) : 0;
  const s = Math.min(s0, 0.4), l = 0.11;
  const f = (n) => { const k = (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

export const inr = (n) =>
  "₹" +
  (Math.abs(n) >= 1e7
    ? (n / 1e7).toFixed(2) + " Cr"
    : Math.abs(n) >= 1e5
      ? (n / 1e5).toFixed(1) + " L"
      : n.toLocaleString("en-IN"));
export const fmtT = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};
export const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtD = (iso) =>
  new Date(iso + (iso.length === 10 ? "T00:00" : "")).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short" },
  );
export const fmtDT = (iso) => `${fmtD(iso)} · ${fmtT(iso)}`;
export const hh = (h) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
export const uid = () => "x" + Math.random().toString(36).slice(2, 8);
export const user = (id) =>
  (state?.db?.USERS || USERS).find((u) => u.id === id) || {
    name: "Unknown",
    ini: "?",
  };
export const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- state (simulated persistence: in-memory + localStorage snapshot) ----------
export const state = {
  authed: false,
  persona: "employee",
  role: "designer",
  userId: "u5",
  device: "mobile",
  theme: "system",
  motion: "system",
  online: true,
  previewAsClient: false,
  route: "#/home",
  tab: {},
  sheet: null,
  toast: null,
  db: null,
  queue: [],
  ai: { enabled: true },
  gamify: { optOut: false, quiet: false },
};
export function loadDb() {
  state.db = clone({
    USERS,
    PROJECTS,
    SITES,
    FEED,
    ISSUES,
    SNAGS,
    MATERIALS,
    THREADS,
    MESSAGES,
    MOODBOARD,
    ROOMS,
    BOOKINGS,
    LEAVES,
    HOLIDAYS,
    ORG_LEAVE_TYPES,
    ORG_LEAVE_REQUESTS,
    ORG_HOLIDAYS,
    ATTENDANCE_TODAY,
    SALARY,
    TASKS,
    AUDIT,
    BADGES,
    TIMESHEETS,
    TRANSMITTALS,
    RFIS,
    CHANGES,
    INVOICES,
    MEETINGS,
    VENDORS,
    HEADCOUNT,
    GRNS,
    DOCS,
    BRIEFS,
    SIGNATURES,
    SPOTS,
    ROLES,
    AGENCY,
    SERVICE_TYPES,
    ROUTING_RULES,
    ENQUIRIES,
    EXPENSES,
    SITE_CHECKINS,
    TRADES,
    STATUTORY,
    STATUTORY_TEMPLATES,
    FOLLOWUPS,
    DECISIONS_DUE,
    CONNECTIONS,
    SHARE_LINKS,
    REVIEWS,
    PUNCHES,
    DRAWING_INDEX,
    INTAKE,
    PORTFOLIO,
    CLIENT_REFS,
    NOTIFICATIONS,
    CONTACTS: [],
    CHECKS: [],
    rr: 0,
    checkedIn: { u5: "09:01", u10: "08:20" },
  });
  try {
    const s = JSON.parse(localStorage.getItem("hertz-proto") || "null");
    if (s && s.v === 10) {
      Object.assign(state, s.state);
      // A saved session keeps its own edits; its dates move forward by the days since it was last opened.
      const from = s.seed || SEED_TODAY;
      if (from !== TODAY) shiftDates(state.db, daysBetween(from, TODAY), monthDelta(from, TODAY));
    }
  } catch (e) {}
  // A page reload interrupts the simulated transfer; make it retryable.
  state.queue.forEach(item => {
    if (item.status === "uploading") { item.status = "queued"; item.progress = 0; }
  });
  if (state.online && state.queue.some(item => item.status === "queued")) setTimeout(flushQueue, 0);
  // One-time seed palette migration; retain any user-customised tenant accent.
  const agency = state.db.AGENCY;
  if (agency && !("brand" in agency) && agency.name === AGENCY.name && agency.short === AGENCY.short) agency.brand = structuredClone(AGENCY.brand);
  if (agency && !agency.paletteVersion) {
    if (agency.accent?.toLowerCase() === "#0a6b4f") agency.accent = AGENCY.accent;
    agency.paletteVersion = 1;
  }
  if (agency && agency.paletteVersion < 2) {
    if (["#b1552f", "#945543"].includes(agency.accent?.toLowerCase())) agency.accent = AGENCY.accent;
    agency.paletteVersion = 2;
  }
}
export function persist() {
  try {
    localStorage.setItem(
      "hertz-proto",
      JSON.stringify({
        v: 10,
        seed: TODAY,
        state: {
          db: state.db,
          queue: state.queue,
          filings: Object.fromEntries(Object.entries(state.filings || {}).filter(([, f]) => !["filing", "queued"].includes(f.status))),
          gamify: state.gamify,
          authed: state.authed,
          persona: state.persona,
          role: state.role,
          userId: state.userId,
          theme: state.theme,
          motion: state.motion,
          device: state.device,
        },
      }),
    );
    state.storageError = "";
    return true;
  } catch (e) {
    state.storageError = "Changes are only in this tab. Device storage is unavailable; keep this tab open and try saving again.";
    return false;
  }
}
export function resetDb() {
  localStorage.removeItem("hertz-proto");
  state.db = null;
  state.queue = [];
  loadDb();
}

// ---------- RBAC matrix: role × entity → set of actions ----------
// Enforced in svc.* (data layer), not just UI. Client/contractor rows are deny-by-default.
export const RBAC = {
  partner: {
    project: "rwa",
    enquiry: "rwa",
    agency: "rwa",
    budget: "rwa",
    drawing: "rwa",
    task: "rw",
    issue: "rwa",
    site: "rw",
    feed: "rw",
    snag: "rw",
    material: "rwa",
    thread: "rw",
    moodboard: "rw",
    leave: "ra",
    attendance: "r",
    salary: "r",
    holiday: "r",
    booking: "rwa",
    achievement: "r",
    audit: "r",
    nas: "rw",
    ai: "rw",
  },
  designer: {
    project: "rw",
    enquiry: "rw",
    budget: "-",
    drawing: "rw",
    task: "rw",
    issue: "rw",
    site: "r",
    feed: "rw",
    snag: "rw",
    material: "rw",
    thread: "rw",
    moodboard: "rw",
    leave: "w",
    attendance: "r",
    salary: "-",
    holiday: "r",
    booking: "rw",
    achievement: "r",
    audit: "-",
    nas: "r",
    ai: "rw",
  },
  site_manager: {
    project: "r",
    budget: "-",
    drawing: "r",
    task: "rw",
    issue: "rwa",
    site: "rw",
    feed: "rw",
    snag: "rwa",
    material: "rw",
    thread: "rw",
    moodboard: "r",
    leave: "w",
    attendance: "r",
    salary: "-",
    holiday: "r",
    booking: "rw",
    achievement: "r",
    audit: "-",
    nas: "-",
    ai: "rw",
  },
  hr: {
    project: "r",
    enquiry: "rw",
    budget: "-",
    drawing: "-",
    task: "-",
    issue: "-",
    site: "-",
    feed: "-",
    snag: "-",
    material: "-",
    thread: "r",
    moodboard: "-",
    leave: "rwa",
    attendance: "rwa",
    salary: "rw",
    holiday: "rw",
    booking: "rw",
    achievement: "rw",
    audit: "r",
    nas: "-",
    ai: "r",
  },
  client: {
    project: "r",
    budget: "-",
    drawing: "r",
    task: "-",
    issue: "-",
    site: "-",
    feed: "-",
    snag: "-",
    material: "ra",
    thread: "rw",
    moodboard: "rw",
    leave: "-",
    attendance: "-",
    salary: "-",
    holiday: "-",
    booking: "w",
    achievement: "-",
    audit: "-",
    nas: "-",
    ai: "-",
  },
  contractor: {
    project: "-",
    budget: "-",
    drawing: "r",
    task: "-",
    issue: "w",
    site: "r",
    feed: "rw",
    snag: "rw",
    material: "-",
    thread: "rw",
    moodboard: "-",
    leave: "-",
    attendance: "-",
    salary: "-",
    holiday: "-",
    booking: "-",
    achievement: "-",
    audit: "-",
    nas: "-",
    ai: "-",
  },
};
// Meeting 23 Sep 2026: share links, manager reviews, client references, intake.
Object.assign(RBAC.partner, { share: "rwa", review: "rwa", ref: "rw", intake: "rw" });
Object.assign(RBAC.designer, { share: "rw", review: "r", ref: "rw", intake: "rw" });
Object.assign(RBAC.site_manager, { share: "r", review: "r", ref: "-", intake: "r" });
Object.assign(RBAC.hr, { share: "-", review: "r", ref: "-", intake: "-" });
Object.assign(RBAC.client, { share: "-", review: "-", ref: "rw", intake: "r" });
Object.assign(RBAC.contractor, { share: "-", review: "-", ref: "-", intake: "-" });
export const can = (entity, action, role = state.role) =>
  (RBAC[role]?.[entity] || "-").includes(action);
export const me = () => state.db.USERS.find((u) => u.id === state.userId);
export const effectiveRole = () =>
  state.previewAsClient &&
  state.role !== "client" &&
  state.role !== "contractor"
    ? "client"
    : state.role;

// ---------- service layer: every read is scoped here ----------
export const svc = {
  // scope helpers
  myProjectIds() {
    const u = me();
    const r = effectiveRole();
    if (r === "client")
      return (
        u.projectIds ||
        (state.previewAsClient
          ? state.db.PROJECTS.filter((p) => p.clientId).map((p) => p.id)
          : [])
      );
    if (r === "contractor")
      return state.db.SITES.filter((s) => (u.siteIds || []).includes(s.id)).map(
        (s) => s.projectId,
      );
    return state.db.PROJECTS.map((p) => p.id);
  },
  mySiteIds() {
    const u = me();
    const r = effectiveRole();
    if (r === "contractor") return u.siteIds || [];
    if (r === "client") return [];
    if (r === "site_manager")
      return state.db.SITES.filter((s) => s.managerId === u.id).map(
        (s) => s.id,
      );
    return state.db.SITES.map((s) => s.id);
  },
  projects() {
    const ids = this.myProjectIds();
    return state.db.PROJECTS.filter((p) => ids.includes(p.id)).map((p) =>
      this.project(p.id),
    );
  },
  // Client projection: strips budget, internal milestones, internal R&D, drafts. Data-layer guarantee.
  project(id) {
    const p = state.db.PROJECTS.find((x) => x.id === id);
    if (!p || !this.myProjectIds().includes(id)) return null;
    const r = effectiveRole();
    if (r === "client" || r === "contractor") {
      const { budget, actual, budgetLines, ...safe } = p;
      return {
        ...safe,
        ...(p.budgetVisible ? { budget, actual, budgetLines } : {}),
        _clientView: true,
        milestones: p.milestones.filter((m) => m.clientVisible),
        rnd: p.rnd.filter((x) => x.clientVisible),
        drawings: p.drawings.filter((d) => d.status !== "Draft"),
      };
    }
    return { ...p, _clientView: false, budgetVisible: can("budget", "r") };
  },
  sites() {
    const ids = this.mySiteIds();
    return state.db.SITES.filter((s) => ids.includes(s.id));
  },
  site(id) {
    return this.mySiteIds().includes(id)
      ? state.db.SITES.find((s) => s.id === id)
      : null;
  },
  feed(siteId) {
    if (!this.site(siteId) || !can("feed", "r")) return [];
    return state.db.FEED.filter((f) => f.siteId === siteId).sort((a, b) =>
      b.at.localeCompare(a.at),
    );
  },
  issues(f = {}) {
    if (!can("issue", "r")) return [];
    const sids = this.mySiteIds();
    return state.db.ISSUES.filter(
      (i) =>
        sids.includes(i.siteId) &&
        (!f.projectId || i.projectId === f.projectId) &&
        (!f.status || i.status === f.status),
    ).sort((a, b) => b.at.localeCompare(a.at));
  },
  snags(siteId) {
    if (!this.site(siteId)) return [];
    const u = me();
    return state.db.SNAGS.filter(
      (n) =>
        n.siteId === siteId &&
        (effectiveRole() !== "contractor" || n.contractorId === u.id),
    );
  },
  materials(f = {}) {
    if (!can("material", "r")) return [];
    const pids = this.myProjectIds();
    const client = effectiveRole() === "client";
    return state.db.MATERIALS.filter(
      (m) =>
        pids.includes(m.projectId) &&
        (!f.projectId || m.projectId === f.projectId) &&
        (!client || m.clientVisible),
    );
  },
  threads() {
    const u = me();
    const r = effectiveRole();
    if (r === "client")
      return state.db.THREADS.filter(
        (t) => t.kind === "client" && this.myProjectIds().includes(t.projectId),
      );
    if (r === "contractor")
      return state.db.THREADS.filter(
        (t) => t.kind === "site" && (u.siteIds || []).includes(t.siteId),
      );
    if (r === "hr") return [];
    return state.db.THREADS.filter(
      (t) => t.memberIds.includes(u.id) || state.role === "partner",
    );
  },
  thread(id) {
    return this.threads().find((t) => t.id === id) || null;
  },
  messages(threadId) {
    return this.thread(threadId)
      ? state.db.MESSAGES.filter((m) => m.threadId === threadId)
      : [];
  },
  moodboard(projectId) {
    return this.myProjectIds().includes(projectId) && can("moodboard", "r")
      ? state.db.MOODBOARD.filter((b) => b.projectId === projectId)
      : [];
  },
  tasks(f = {}) {
    if (!can("task", "r")) return [];
    const u = me();
    // f.all opts out of the open-only filter every existing caller relies on (Dashboard, Today,
    // svc.load, the role Homes) — only the All Tasks page passes it, to also see done tasks.
    return state.db.TASKS.filter(
      (t) =>
        (!f.mine || t.owner === u.id) &&
        (!f.projectId || t.projectId === f.projectId) &&
        (f.all || t.status === "open"),
    );
  },
  bookings(date) {
    return can("booking", "r")
      ? state.db.BOOKINGS.filter((b) => b.date === date)
      : [];
  },
  leaves(f = {}) {
    const u = me();
    if (can("leave", "r"))
      return state.db.LEAVES.filter((l) => !f.status || l.status === f.status);
    if (can("leave", "w"))
      return state.db.LEAVES.filter((l) => l.userId === u.id);
    return [];
  },
  attendance() {
    return can("attendance", "r") ? state.db.ATTENDANCE_TODAY : [];
  },
  salary() {
    return can("salary", "r") ? state.db.SALARY : [];
  },
  audit() {
    return can("audit", "r") ? state.db.AUDIT : [];
  },
  people() {
    return ["client", "contractor"].includes(effectiveRole())
      ? []
      : state.db.USERS.filter(
          (u) => !["client", "contractor"].includes(u.role),
        );
  },
  // writes: all go through audit where financial/approval
  // ---------- project lifecycle ----------
  // Phone hides finished projects. Clients and contractors keep 30 days grace for warranty and payment chat.
  phoneHides(projectId) {
    const p = state.db.PROJECTS.find((x) => x.id === projectId);
    if (!p || p.status !== "finished") return false;
    const outsider = ["client", "contractor"].includes(effectiveRole());
    if (!outsider) return true;
    return (new Date(TODAY) - new Date(p.finishedAt || TODAY)) / 864e5 > 30;
  },
  addSite(s) {
    if (!can("site", "w") || ["contractor", "client"].includes(effectiveRole())) throw new Error("forbidden");
    const nm = (s.name || "").trim();
    if (!nm) throw new Error("Give the site a name.");
    const p = state.db.PROJECTS.find((x) => x.id === s.projectId);
    if (!p) throw new Error("Choose a project for this site.");
    if (state.db.SITES.some((x) => x.name.toLowerCase() === nm.toLowerCase()))
      throw new Error("A site with that name already exists.");
    const progress = Math.max(0, Math.min(100, Number(s.progress) || 0));
    const site = {
      id: "s" + (Math.max(0, ...state.db.SITES.map((x) => parseInt(String(x.id).slice(1), 10) || 0)) + 1),
      projectId: p.id,
      name: nm,
      managerId: s.managerId || null,
      contractorIds: s.contractorIds || [],
      progress,
      hue: p.hue ?? 200,
      stage: (s.stage || "").trim() || "Mobilisation",
      lastVisit: TODAY,
    };
    if (Number(s.pettyCash) > 0) { site.pettyCash = Number(s.pettyCash); site.ownCash = true; }
    state.db.SITES.push(site);
    // Contractors only see the sites they are assigned to.
    state.db.USERS.forEach((u) => {
      if (site.contractorIds.includes(u.id)) u.siteIds = [...(u.siteIds || []), site.id];
    });
    this.log("Site added · " + nm, "Site " + site.id);
    persist();
    return site;
  },
  finishProject(id) {
    if (state.role !== "partner") throw new Error("forbidden");
    const p = state.db.PROJECTS.find((x) => x.id === id);
    if (!p) return;
    p.status = "finished";
    p.finishedAt = TODAY;
    p.finishedBy = state.userId;
    this.log("Project finished · " + p.name, "Project " + id);
    persist();
  },
  reopenProject(id) {
    if (state.role !== "partner") throw new Error("forbidden");
    const p = state.db.PROJECTS.find((x) => x.id === id);
    if (!p) return;
    p.status = "active";
    delete p.finishedAt;
    this.log("Project reopened · " + p.name, "Project " + id);
    persist();
  },
  // ---------- day to day ----------
  expenses(f = {}) {
    return state.db.EXPENSES.filter(
      (e) =>
        this.myProjectIds().includes(e.projectId) &&
        (!f.status || e.status === f.status),
    );
  },
  addExpense(e) {
    const id = uid();
    state.db.EXPENSES.unshift({
      id,
      userId: state.userId,
      date: TODAY,
      status: "pending",
      ...e,
    });
    this.log("Expense raised · " + inr(e.amount), "Expense " + id);
    persist();
    return id;
  },
  decideExpense(id, status) {
    if (state.role !== "partner") throw new Error("forbidden");
    const e = state.db.EXPENSES.find((x) => x.id === id);
    if (e) {
      e.status = status;
      e.by = state.userId;
    }
    persist();
  },
  checkins(siteId, date = TODAY) {
    return state.db.SITE_CHECKINS.filter(
      (c) => (!siteId || c.siteId === siteId) && c.at.startsWith(date),
    );
  },
  siteCheckin(siteId) {
    const id = uid();
    const s = state.db.SITES.find((x) => x.id === siteId) || {};
    state.db.SITE_CHECKINS.push({
      id,
      userId: state.userId,
      siteId,
      at: new Date().toISOString().slice(0, 16),
      gps: "22.3072, 73.1812",
      hue: s.hue || 28,
      seed: Math.floor(Math.random() * 90),
    });
    state.db.checkedIn[state.userId] =
      state.db.checkedIn[state.userId] || new Date().toTimeString().slice(0, 5);
    persist();
    return id;
  },
  followups(all) {
    return state.db.FOLLOWUPS.filter(
      (f) => (all || f.userId === state.userId) && !f.done,
    ).map((f) => ({
      ...f,
      msg: state.db.MESSAGES.find((m) => m.id === f.msgId),
    }));
  },
  addFollowup(msgId, at) {
    const id = uid();
    state.db.FOLLOWUPS.push({
      id,
      msgId,
      userId: state.userId,
      at,
      done: false,
    });
    persist();
    return id;
  },
  doneFollowup(id) {
    const f = state.db.FOLLOWUPS.find((x) => x.id === id);
    if (f) f.done = true;
    persist();
  },
  decisionsDue(f = {}) {
    return state.db.DECISIONS_DUE.filter(
      (d) =>
        this.myProjectIds().includes(d.projectId) &&
        (!f.projectId || d.projectId === f.projectId) &&
        (!f.threadId || d.threadId === f.threadId) &&
        (f.all || d.status === "open"),
    ).map((d) => ({
      ...d,
      late: d.due < TODAY,
      soon: d.due <= TODAY && d.due >= TODAY,
    }));
  },
  decideDecision(id, status = "decided") {
    const d = state.db.DECISIONS_DUE.find((x) => x.id === id);
    if (d) {
      d.status = status;
      d.decidedAt = TODAY;
    }
    persist();
  },
  rateVendor(vendorId, projectId, stars, note = "") {
    const v = state.db.VENDORS.find((x) => x.id === vendorId);
    if (!v) return;
    v.ratings = (v.ratings || []).filter(
      (r) => !(r.projectId === projectId && r.by === state.userId),
    );
    v.ratings.push({ projectId, stars, by: state.userId, at: TODAY, note });
    v.rating = Math.round(
      v.ratings.reduce((a, r) => a + r.stars, 0) / v.ratings.length,
    );
    persist();
  },
  // Holiday push: one message to every site group so contractors plan labour.
  pushHoliday(date) {
    if (!can("thread", "w")) throw new Error("forbidden");
    const h = state.db.HOLIDAYS.find((x) => x.date === date);
    if (!h) return 0;
    const sites = this.threads().filter(
      (t) => t.kind === "site" && !this.phoneHides(t.projectId),
    );
    sites.forEach((t) =>
      this.addMessage(t.id, {
        text: `Studio holiday on ${fmtD(date)}, ${h.name}. Site work and deliveries as agreed with the site manager. Office closed.`,
        holiday: date,
      }),
    );
    h.pushed = TODAY;
    persist();
    return sites.length;
  },
  // Daily site log built from what already happened in the site group that day. Nobody writes a report.
  dailyLog(siteId, date = TODAY) {
    const t = state.db.THREADS.find(
      (x) => x.kind === "site" && x.siteId === siteId,
    );
    const ms = t
      ? state.db.MESSAGES.filter(
          (m) => m.threadId === t.id && m.at.startsWith(date),
        )
      : [];
    const photos = ms.filter((m) => m.photo || m.album);
    const voice = ms.filter((m) => m.voice);
    const issues = state.db.ISSUES.filter(
      (i) => i.siteId === siteId && i.at.startsWith(date),
    );
    const grns = state.db.GRNS.filter(
      (g) => g.siteId === siteId && g.date === date,
    );
    const heads = state.db.HEADCOUNT.filter(
      (h) => h.siteId === siteId && h.date === date,
    );
    const who = this.checkins(siteId, date).map(
      (c) => user(c.userId).name.split(" ")[0],
    );
    return {
      siteId,
      date,
      photos: photos.length,
      voice: voice.length,
      issues,
      grns,
      labour: heads.reduce((a, h) => a + h.count, 0),
      trades: this.tradesLine(heads),
      who,
      lines: ms
        .filter((m) => m.text)
        .map((m) => m.text)
        .slice(0, 6),
    };
  },
  // Search across projects, people, messages, transcripts and filed photos.
  search(q) {
    const re = new RegExp(
      String(q)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    if (!String(q).trim()) return [];
    const out = [];
    this.projects().forEach((p) => {
      if (re.test(p.name + " " + p.code + " " + p.city))
        out.push({
          kind: "project",
          id: p.id,
          title: p.name,
          sub:
            p.code + " · " + (p.status === "finished" ? "Finished" : "Active"),
          ref: "#/projects/" + p.id,
        });
    });
    this.people().forEach((u) => {
      if (re.test(u.name + " " + (u.title || "")))
        out.push({
          kind: "person",
          id: u.id,
          title: u.name,
          sub: u.title || u.role,
          ref: "#/people",
        });
    });
    this.threads().forEach((t) =>
      state.db.MESSAGES.filter((m) => m.threadId === t.id).forEach((m) => {
        const hay = [
          m.text,
          m.transcript,
          m.translation,
          m.file && m.file.name,
          m.photo && m.text,
          m.imported,
        ]
          .filter(Boolean)
          .join(" ");
        if (re.test(hay))
          out.push({
            kind: m.voice ? "voice" : m.photo ? "photo" : "message",
            id: m.id,
            title: hay.slice(0, 90),
            sub:
              t.name + " · " + fmtD(m.at) + (m.imported ? " · imported" : ""),
            ref: "#/chats/" + t.id,
            threadId: t.id,
            msgId: m.id,
          });
      }),
    );
    return out.slice(0, 40);
  },
  log(what, entity) {
    state.db.AUDIT.unshift({
      at: new Date().toISOString().slice(0, 16),
      by: state.userId,
      what,
      entity,
    });
  },
  addIssue(i) {
    if (!can("issue", "w")) throw new Error("forbidden");
    const id = uid();
    state.db.ISSUES.unshift({
      id,
      status: "open",
      raisedBy: state.userId,
      at: new Date().toISOString().slice(0, 16),
      updates: [],
      ...i,
    });
    this.log("Issue raised · " + i.title, "Issue " + id);
    persist();
    return id;
  },
  closeIssue(id) {
    const i = state.db.ISSUES.find((x) => x.id === id);
    if (!i) return;
    if (i.raisedBy === state.userId && !can("issue", "a")) {
      toast("Closure needs verification by someone other than the raiser");
      return;
    }
    i.status = "closed";
    i.closedAt = new Date().toISOString().slice(0, 16);
    i.verifiedBy = state.userId;
    award(i.assignee, 40, "Issue closed within SLA");
    this.log("Issue closure verified · " + id, "Issue " + id);
    persist();
  },
  addMessage(threadId, m) {
    if (!can("thread", "w") || !this.thread(threadId))
      throw new Error("forbidden");
    const id = uid();
    state.db.MESSAGES.push({
      id,
      threadId,
      by: state.userId,
      at: new Date().toISOString().slice(0, 16),
      ...m,
    });
    if (!persist()) {
      state.db.MESSAGES.pop();
      throw new Error("Message could not be saved on this device");
    }
    return id;
  },
  votePoll(msgId, idx) {
    const m = state.db.MESSAGES.find(x => x.id === msgId && !x.deleted);
    if (!m || !m.poll || !m.poll.options[idx]) return;
    const uid2 = state.userId;
    m.poll.options.forEach((o, i) => {
      const has = o.votes.includes(uid2);
      if (i === idx) o.votes = has ? o.votes.filter(v => v !== uid2) : [...o.votes, uid2];
      else if (!m.poll.multi) o.votes = o.votes.filter(v => v !== uid2);
    });
    persist();
    render();
  },
  fileToMoodboard(msgId, save = true) {
    const m = state.db.MESSAGES.find((x) => x.id === msgId);
    if (!m || !m.link) return false;
    const existing = state.db.MOODBOARD.find((item) => item.msgId === msgId);
    const projectId = state.filings[msgId]?.projectId || this.thread(m.threadId).projectId;
    if (existing) {
      const previousProject = existing.projectId;
      existing.projectId = projectId;
      if (save && !persist()) { existing.projectId = previousProject; return false; }
      return true;
    }
    if (m.filed) return true;
    const wasFiled = m.filed;
    m.filed = true;
    state.db.MOODBOARD.unshift({
      id: uid(),
      msgId,
      projectId,
      title: m.link.title,
      src: m.link.src,
      hue: m.link.hue,
      seed: m.link.seed,
    });
    if (save && !persist()) {
      m.filed = wasFiled;
      state.db.MOODBOARD.shift();
      return false;
    }
    return true;
  },
  approveMaterial(id, ok) {
    if (!can("material", "a", effectiveRole())) throw new Error("forbidden");
    const m = this.materials().find((x) => x.id === id);
    if (!m) throw new Error("Material unavailable for your role.");
    m.status = ok ? "approved" : "rejected";
    m.decidedAt = new Date().toISOString();
    this.log(
      `Material ${ok ? "approved" : "rejected"} · ${m.name}`,
      "Material " + id,
    );
    persist();
  },
  // F1: turn a phone approval tap into a permanent record. kind: material|change|leave|bill|rate|extra_work.
  // value: number or string being approved. instruction/followUp: optional free text.
  recordApproval(a) {
    state.db.APPROVALS = state.db.APPROVALS || [];
    const rec = {
      id: uid(),
      kind: a.kind,
      projectId: a.projectId || null,
      by: a.by || state.userId,
      value: a.value ?? null,
      instruction: a.instruction || "",
      attachments: a.attachments || [],
      followUp: a.followUp || "",
      at: a.at || new Date().toISOString().slice(0, 16),
    };
    state.db.APPROVALS.unshift(rec);
    this.strikeDrawings(a.projectId, a.value, rec.by, "Client approval");
    this.log(
      `Approved · ${a.kind}${a.value ? " · " + a.value : ""}`,
      "Approval " + rec.id,
    );
    persist();
    return rec;
  },
  // ---------- booking engine (rooms + people + leave/holiday + hours) ----------
  cfg() {
    return state.db.AGENCY;
  },
  prepBooking(b) {
    // purpose decides what gets reserved; caller passes {title,date,start,end,purpose,attendees,projectId,roomId?}
    const out = { attendees: [], ...b };
    out.attendees = [...new Set(out.attendees)];
    const rooms = state.db.ROOMS.filter((r) => r.type === "room");
    if (out.purpose === "office" && !out.roomId && rooms.length)
      out.roomId = rooms[0].id;
    if (out.purpose === "video") out.roomId = null;
    if (out.purpose === "site") {
      out.roomId = null;
      const s = state.db.SITES.find((s) => s.projectId === out.projectId);
      if (s?.managerId && !out.attendees.includes(s.managerId))
        out.attendees.push(s.managerId);
      out.travel = 1; // hours blocked after the visit
    }
    return out;
  },
  conflict(b) {
    const ov = (k, pad = 0) =>
      k.date === b.date &&
      b.start < k.end + pad &&
      b.end + (b.travel || 0) > k.start - pad;
    const others = state.db.BOOKINGS.filter(
      (k) => k.id !== b.id && k.status !== "declined",
    );
    const room = b.roomId && state.db.ROOMS.find((r) => r.id === b.roomId);
    if (room && room.exclusive !== false) {
      const k = others.find((k) => k.roomId === b.roomId && ov(k));
      if (k)
        return {
          ...k,
          kind: "room",
          msg: `${room.name} taken ${hh(k.start)}–${hh(k.end)} · ${k.title}`,
        };
    }
    const buf = this.cfg().booking.buffer || 0;
    for (const p of b.attendees || []) {
      const k = others.find(
        (k) =>
          (k.attendees || []).includes(p) &&
          ov(k, k.clientId || b.clientId ? buf : 0),
      );
      if (k)
        return {
          ...k,
          kind: "person",
          msg: `${user(p).name.split(" ")[0]} busy ${hh(k.start)}–${hh(k.end)} · ${k.title}`,
        };
    }
    const hol = state.db.HOLIDAYS.find((h) => h.date === b.date);
    if (hol)
      return {
        kind: "holiday",
        title: hol.name,
        msg: `Office closed · ${hol.name}`,
      };
    for (const p of b.attendees || []) {
      const l = state.db.LEAVES.find(
        (l) =>
          l.userId === p &&
          l.status === "approved" &&
          l.from <= b.date &&
          l.to >= b.date,
      );
      if (l)
        return {
          kind: "leave",
          title: l.type + " leave",
          msg: `${user(p).name.split(" ")[0]} on leave till ${fmtD(l.to)}`,
        };
    }
    const h = this.cfg().hours;
    if (b.start < h.start || b.end + (b.travel || 0) > h.end)
      return {
        kind: "hours",
        title: "Outside office hours",
        msg: `Office hours ${hh(h.start)}–${hh(h.end)}`,
      };
    return null;
  },
  freeSlots(b, n = 3) {
    const len = b.end - b.start,
      h = this.cfg().hours,
      out = [];
    const d0 = new Date(b.date + "T00:00:00");
    for (let d = 0; d < 14 && out.length < n; d++) {
      const dt = new Date(d0);
      dt.setDate(d0.getDate() + d);
      if (dt.getDay() === 0) continue;
      const date = isoDay(dt);
      for (let s = h.start; s + len <= h.end && out.length < n; s += 0.5) {
        if (d === 0 && s === b.start) continue;
        const c = { ...b, date, start: s, end: s + len };
        if (!this.conflict(c)) out.push({ date, start: s, end: s + len });
      }
    }
    return out;
  },
  suggestSlot(b) {
    const s = this.freeSlots(b, 1)[0];
    return s ? { ...b, ...s, why: "Next free slot" } : null;
  },
  book(b) {
    if (!can("booking", "w")) throw new Error("forbidden");
    b = this.prepBooking({ attendees: [state.userId], ...b });
    const reps = b.repeat === "weekly" ? b.count || 4 : 1;
    const rows = [];
    for (let i = 0; i < reps; i++) {
      const dt = new Date(b.date + "T00:00:00");
      dt.setDate(dt.getDate() + i * 7);
      const row = { ...b, date: isoDay(dt) };
      const conflict = this.conflict(row);
      if (conflict) return { conflict, at: row.date };
      rows.push(row);
    }
    const needsOk = state.role === "client" && this.cfg().booking.approve;
    const ids = rows.map((row) => {
      const id = uid();
      state.db.BOOKINGS.push({
        id,
        by: state.userId,
        status: needsOk ? "pending" : "approved",
        kind: row.clientId || state.role === "client" ? "client" : "review",
        clientId: state.role === "client" ? state.userId : row.clientId,
        ...row,
      });
      return id;
    });
    this.log(
      (needsOk ? "Booking requested · " : "Booked · ") + b.title,
      "Booking " + ids[0],
    );
    persist();
    return { id: ids[0], ids, pending: needsOk };
  },
  decideBooking(id, ok) {
    if (!can("booking", "a")) throw new Error("forbidden");
    const k = state.db.BOOKINGS.find((k) => k.id === id);
    if (!k) return null;
    k.status = ok ? "approved" : "declined";
    k.decidedBy = state.userId;
    this.log(
      (ok ? "Booking approved · " : "Booking declined · ") + k.title,
      id,
    );
    persist();
    return k;
  },
  pendingBookings() {
    return state.db.BOOKINGS.filter((k) => k.status === "pending");
  },
  // ---------- enquiries (CRM) ----------
  routeEnquiry(e) {
    const rules = state.db.ROUTING_RULES;
    const rule =
      rules.find((r) => r.typeId === e.typeId) ||
      rules.find((r) => r.typeId === "*");
    if (!rule) return {};
    if (rule.mode === "reject") return { reject: true };
    if (rule.mode === "person") return { assignee: rule.to };
    const pool = state.db.USERS.filter((u) => u.role === rule.to).map(
      (u) => u.id,
    );
    if (!pool.length) return {};
    const i = (state.db.rr || 0) % pool.length;
    state.db.rr = i + 1;
    return { assignee: pool[i] };
  },
  addEnquiry(e) {
    // public web form and WhatsApp link have no login; staff typing a phone enquiry is gated in the UI
    const r = this.routeEnquiry(e);
    const row = {
      id: uid(),
      at: new Date().toISOString(),
      status: r.reject ? "not_eligible" : "new",
      assignee: r.assignee || null,
      ...e,
    };
    state.db.ENQUIRIES.unshift(row);
    this.log("Enquiry · " + e.name, "Enquiry " + row.id);
    persist();
    return row;
  },
  decideEnquiry(id, status, assignee) {
    if (!can("enquiry", "a")) throw new Error("forbidden");
    const e = state.db.ENQUIRIES.find((x) => x.id === id);
    if (!e) return null;
    e.status = status;
    if (assignee) e.assignee = assignee;
    if (status === "accepted" && !e.clientId) {
      const c = {
        id: uid(),
        name: e.name,
        role: "client",
        title: "Prospect · " + this.serviceType(e.typeId),
        ini: e.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        projectIds: [],
        fromEnquiry: e.id,
      };
      state.db.USERS.push(c);
      e.clientId = c.id;
    }
    this.log(
      "Enquiry " + status.replace("_", " ") + " · " + e.name,
      "Enquiry " + id,
    );
    persist();
    return e;
  },
  serviceType(id) {
    return state.db.SERVICE_TYPES.find((t) => t.id === id)?.name || id;
  },
  myEnquiries() {
    return state.db.ENQUIRIES.filter(
      (e) =>
        e.status === "new" &&
        (e.assignee === state.userId || can("enquiry", "a")),
    );
  },
  requestLeave(l) {
    if (!can("leave", "w")) throw new Error("forbidden");
    const id = uid();
    state.db.LEAVES.unshift({
      id,
      userId: state.userId,
      status: "pending",
      at: TODAY,
      ...l,
    });
    persist();
    return id;
  },
  decideLeave(id, ok) {
    if (!can("leave", "a")) throw new Error("forbidden");
    const l = state.db.LEAVES.find((x) => x.id === id);
    l.status = ok ? "approved" : "rejected";
    l.approvedBy = state.userId;
    this.log(
      `Leave ${l.status} · ${user(l.userId).name}`,
      "LeaveRequest " + id,
    );
    persist();
  },
  // "12 mason, 8 helper" from headcount rows. Empty string when no trades were tapped.
  tradesLine(rows) {
    const sum = {};
    rows.forEach((h) => Object.entries(h.trades || {}).forEach(([k, n]) => (sum[k] = (sum[k] || 0) + n)));
    return Object.entries(sum)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k.toLowerCase()}`)
      .join(", ");
  },
  // Site holidays (site: true) between two dates, inclusive of a, exclusive of b.
  siteHolidays(a, b) {
    return state.db.HOLIDAYS.filter((h) => h.site && h.date >= a && h.date < b).length;
  },
  // Working days between two dates: calendar days minus site shutdowns. Sundays count, sites work Sundays.
  workDays(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 864e5) - this.siteHolidays(a, b);
  },
  // Petty cash left on a site: float minus cash bills booked against its project.
  pettyCash(siteId) {
    const site = state.db.SITES.find((x) => x.id === siteId);
    if (!site || site.pettyCash == null) return null;
    // Sites added in the app track their own cash by site; seeded sites keep drawing on their project's cash bills.
    const spent = state.db.EXPENSES.filter(
      (e) => (site.ownCash ? e.siteId === site.id : e.projectId === site.projectId) && e.paidBy === "cash" && e.status !== "rejected",
    ).reduce((a, e) => a + e.amount, 0);
    return { float: site.pettyCash, spent, left: site.pettyCash - spent };
  },
  // GST split for a fee invoice: same state as the agency = CGST + SGST, else IGST. 18% on services, SAC 9983.
  gst(inv) {
    const p = state.db.PROJECTS.find((x) => x.id === inv.projectId) || {};
    const ag = state.db.AGENCY;
    const inter = (p.billState || ag.state) !== ag.state;
    const taxable = inv.amount;
    const tax = Math.round(taxable * 0.18);
    return {
      inter,
      taxable,
      cgst: inter ? 0 : Math.round(tax / 2),
      sgst: inter ? 0 : tax - Math.round(tax / 2),
      igst: inter ? tax : 0,
      total: taxable + tax,
      sac: ag.sac,
      placeOfSupply: p.billState || ag.state,
    };
  },
  // One CSV line per invoice for Tally import. Header first.
  tallyCsv(list) {
    const head = "Invoice No,Date,Party,GSTIN,Place of supply,SAC,Taxable,CGST,SGST,IGST,Total";
    const rows = list.map((inv) => {
      const g = this.gst(inv);
      const p = state.db.PROJECTS.find((x) => x.id === inv.projectId) || {};
      return [inv.no, inv.issued, p.name, state.db.AGENCY.gstin, g.placeOfSupply, g.sac, g.taxable, g.cgst, g.sgst, g.igst, g.total].join(",");
    });
    return [head, ...rows].join("\n");
  },
  // Statutory approvals for a project. Missing checklist items from the city template are added as "todo".
  approvals(projectId) {
    const p = state.db.PROJECTS.find((x) => x.id === projectId) || {};
    const city = (p.city || "").split(",").pop().trim();
    const tpl = state.db.STATUTORY_TEMPLATES.find((t) => t.city === city) || state.db.STATUTORY_TEMPLATES.find((t) => t.city === "*");
    const have = state.db.STATUTORY.filter((a) => a.projectId === projectId);
    (tpl ? tpl.items : []).forEach((name) => {
      if (!have.some((a) => a.name === name))
        have.push({ id: "sa" + Date.now() + have.length, projectId, name, authority: "", ownerId: null, submitted: null, due: null, followUp: null, status: "todo", fromTemplate: true });
    });
    return have;
  },
  standIns(userId) {
    // qualified stand-in: shares ≥1 skill, present today, not on leave, fewest open critical tasks
    const u = user(userId);
    const att = state.db.ATTENDANCE_TODAY;
    return state.db.USERS.filter(
      (x) =>
        x.id !== userId &&
        !["client", "contractor", "hr"].includes(x.role) &&
        x.skills.some((s) => u.skills.includes(s)),
    )
      .map((x) => {
        const a = att.find((r) => r.userId === x.id);
        const load = state.db.TASKS.filter(
          (t) => t.owner === x.id && t.status === "open",
        ).length;
        return {
          u: x,
          present: a && a.in && a.mark !== "leave",
          load,
          overlap: x.skills.filter((s) => u.skills.includes(s)),
        };
      })
      .filter((x) => x.present)
      .sort((a, b) => a.load - b.load || b.overlap.length - a.overlap.length)
      .slice(0, 3);
  },
  checkIn() {
    const now = new Date();
    const t = now.toTimeString().slice(0, 5);
    const rec = state.db.ATTENDANCE_TODAY.find(
      (a) => a.userId === state.userId,
    );
    const late = t > "09:30";
    // First check-in of the day sets the mark; checking in again after a check-out just reopens the day.
    const firstIn = !rec?.in;
    if (rec) {
      rec.in = rec.in || t;
      delete rec.out;
      if (firstIn) rec.mark = late ? "late" : "ontime";
    }
    state.db.checkedIn[state.userId] = t;
    if (!late && firstIn) award(state.userId, 5, "On-time check-in");
    persist();
    return { t, late };
  },
  checkOut() {
    const t = new Date().toTimeString().slice(0, 5);
    const rec = state.db.ATTENDANCE_TODAY.find(
      (a) => a.userId === state.userId,
    );
    if (rec) {
      rec.out = t;
      if (rec.in && rec.in > "13:00") rec.mark = "half";
    }
    delete state.db.checkedIn[state.userId];
    persist();
    return t;
  },
  salaryFor(s) {
    const perDay = s.base / 26;
    const halfDed = s.halfDays * perDay * 0.5;
    const lateDed = Math.floor(s.lateMarks / 3) * perDay * 0.5;
    const leaveDed = s.leaveDeduct * perDay;
    const gross = s.base + s.hra - halfDed - lateDed - leaveDed;
    const pt = 200;
    const net = gross - s.pf - pt;
    return { ...s, halfDed, lateDed, leaveDed, gross, pt, net };
  },
  // ---------- Hertz meeting, 23 Sep 2026 ----------
  // WhatsApp-style media view for one thread: everything shared, grouped by kind then month.
  media(threadId) {
    const groups = { Photos: [], Files: [], Links: [], Voice: [], Drawings: [] };
    this.messages(threadId).filter((m) => !m.deleted).forEach((m) => {
      if (m.photo) groups.Photos.push(m);
      if (m.file) (/\.(dwg|pdf)$/i.test(m.file.name || "") ? groups.Drawings : groups.Files).push(m);
      if (m.link) groups.Links.push(m);
      if (m.voice) groups.Voice.push(m);
    });
    const byMonth = (list) => {
      const out = {};
      list.sort((a, b) => (b.at || "").localeCompare(a.at || "")).forEach((m) => (out[(m.at || "").slice(0, 7) || "Undated"] ||= []).push(m));
      return out;
    };
    return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, byMonth(v)]));
  },
  // Simulated phone contact picker. Real sync is production work; the app never bulk-reads a phone book.
  phoneContacts() {
    return [
      { name: "Bhavesh Electricals", phone: "+91 98240 77120", guess: "Vendor" },
      { name: "Kirit Bhai Plumber", phone: "+91 99250 11876", guess: "Vendor" },
      { name: "Meera Desai", phone: "+91 98250 40011", guess: "Client" },
      { name: "Stonecraft Surfaces", phone: "+91 97270 66778", guess: "Vendor" },
    ].filter((c) => !state.db.CONTACTS.some((x) => x.phone === c.phone));
  },
  importContacts(list) {
    if (!can("project", "w")) throw new Error("forbidden");
    list.forEach((c) => state.db.CONTACTS.push({ id: uid(), ...c, by: state.userId, at: TODAY }));
    this.log(`Imported ${list.length} contact${list.length === 1 ? "" : "s"} from phone`, "Contacts");
    persist();
  },
  // Project → category → people, with each person's latest activity. Derived, never stored.
  peopleFolder(projectId) {
    const p = this.project(projectId);
    if (!p) return [];
    const threads = state.db.THREADS.filter((t) => t.projectId === projectId);
    const last = (id) =>
      state.db.MESSAGES.filter((m) => m.by === id && threads.some((t) => t.id === m.threadId)).map((m) => m.at).sort().pop() || "";
    const cat = { Client: [], "Studio team": [], Site: [], Vendors: [] };
    const seen = new Set();
    threads.forEach((t) =>
      t.memberIds.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        const u = user(id);
        if (!u) return;
        const k = u.role === "client" ? "Client" : u.role === "contractor" || u.role === "site_manager" ? "Site" : "Studio team";
        cat[k].push({ id, name: u.name, title: u.title, last: last(id) });
      }),
    );
    state.db.VENDORS.filter((v) => (v.projectIds || []).includes(projectId) || (v.ratings || []).some((r) => r.projectId === projectId)).forEach((v) =>
      cat.Vendors.push({ id: v.id, name: v.name, title: v.trade || "Vendor", last: "" }),
    );
    return Object.entries(cat).map(([name, people]) => ({ name, people: people.sort((a, b) => b.last.localeCompare(a.last)) }));
  },
  brainstorm(projectId) {
    return this.threads().find((t) => t.projectId === projectId && t.kind === "internal") || null;
  },
  // Punch history for one person and month. Late = after the studio cut-off. Hours from in/out.
  punches(userId = state.userId, month = TODAY.slice(0, 7)) {
    if (userId !== state.userId && !can("attendance", "r")) return { rows: [], days: 0, late: 0, hours: 0 };
    const rows = state.db.PUNCHES.filter((x) => x.userId === userId && x.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
    const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
    const hours = rows.reduce((n, r) => n + (r.out ? (mins(r.out) - mins(r.in)) / 60 : 0), 0);
    return { rows, days: rows.length, late: rows.filter((r) => r.late).length, hours: Math.round(hours) };
  },
  // Reviews: partners see all, everyone else sees only their own. Never a public leaderboard.
  reviews(userId) {
    if (!can("review", "r")) return [];
    const mine = state.role === "partner" ? state.db.REVIEWS : state.db.REVIEWS.filter((r) => r.userId === state.userId);
    return mine.filter((r) => !userId || r.userId === userId).sort((a, b) => b.month.localeCompare(a.month));
  },
  saveReview(r) {
    if (!can("review", "w")) throw new Error("forbidden");
    const strengths = (r.strengths || []).map((s) => s.trim()).filter(Boolean);
    if (!(r.score >= 1 && r.score <= 5)) throw new Error("Score must be 1 to 5");
    if (strengths.length < 3) throw new Error("Name three strengths");
    if (!(r.growth || "").trim()) throw new Error("Name one thing to grow");
    if (!(r.reason || "").trim()) throw new Error("Give the reason behind the score");
    if (r.userId === state.userId) throw new Error("You cannot review yourself");
    const rec = { id: uid(), userId: r.userId, by: state.userId, month: r.month || TODAY.slice(0, 7), score: +r.score, strengths, growth: r.growth.trim(), reason: r.reason.trim(), note: "" };
    const i = state.db.REVIEWS.findIndex((x) => x.userId === rec.userId && x.month === rec.month);
    if (i >= 0) state.db.REVIEWS[i] = { ...state.db.REVIEWS[i], ...rec, id: state.db.REVIEWS[i].id };
    else state.db.REVIEWS.unshift(rec);
    this.log(`Review saved · ${user(rec.userId).name} · ${rec.month}`, "Review " + rec.id);
    persist();
    return rec;
  },
  reviewNote(id, note) {
    const r = state.db.REVIEWS.find((x) => x.id === id);
    if (!r || r.userId !== state.userId) throw new Error("forbidden");
    r.note = note.trim();
    persist();
  },
  // Team average for a month: the only comparison anyone but a partner ever sees.
  teamAverage(month) {
    const rows = state.db.REVIEWS.filter((r) => r.month === month);
    return rows.length ? +(rows.reduce((n, r) => n + r.score, 0) / rows.length).toFixed(1) : null;
  },
  connections() {
    return state.db.CONNECTIONS;
  },
  connection(key) {
    const c = state.db.CONNECTIONS.find((x) => x.key === key);
    return c && c.on ? c : null;
  },
  saveConnections(list) {
    if (!can("agency", "w")) throw new Error("forbidden");
    state.db.CONNECTIONS = state.db.CONNECTIONS.map((c) => {
      const n = list.find((x) => x.key === c.key) || {};
      return { ...c, on: !!n.on, url: (n.url || c.url || "").trim() };
    });
    persist();
  },
  // Google Calendar template link. Mock: no OAuth, the person confirms in Google.
  calendarUrl(b) {
    if (!svc.connection("google")) return null;
    const d = b.date.replace(/-/g, "");
    const t = (h) => d + "T" + String(Math.floor(h)).padStart(2, "0") + String(Math.round((h % 1) * 60)).padStart(2, "0") + "00";
    const e = encodeURIComponent;
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + e(b.title) + "&dates=" + t(b.start) + "/" + t(b.end) + "&details=" + e("Booked in Hertz Studio");
  },
  // Mock Meet link for confirmed non-site meetings. Production: Calendar API creates the real one.
  meetUrl(b) {
    if (!svc.connection("google") || b.status === "pending" || b.status === "declined" || b.kind === "site") return null;
    return "https://meet.google.com/arc-" + b.id + "-hz";
  },
  whatsappUrl(text) {
    return svc.connection("whatsapp") ? "https://wa.me/?text=" + encodeURIComponent(text) : null;
  },
  // Temporary web links: no app needed to view. Expiry required, PIN optional, revoke any time.
  shareLinks(projectId) {
    if (!can("share", "r")) return [];
    return state.db.SHARE_LINKS.filter((l) => !projectId || l.projectId === projectId).sort((a, b) => b.at.localeCompare(a.at));
  },
  createShare(s) {
    if (!can("share", "w") || !this.project(s.projectId)) throw new Error("forbidden");
    const days = Math.min(30, Math.max(1, +s.days || 7));
    const exp = new Date(TODAY + "T00:00");
    exp.setDate(exp.getDate() + days);
    const rec = { id: uid(), projectId: s.projectId, path: s.path || "", label: s.label || s.path || "Shared folder", by: state.userId, at: new Date().toISOString().slice(0, 16), expires: exp.toISOString().slice(0, 10), pin: (s.pin || "").trim(), views: 0, status: "active" };
    state.db.SHARE_LINKS.unshift(rec);
    this.log(`Share link created · ${rec.label} · until ${rec.expires}`, "ShareLink " + rec.id);
    persist();
    return rec;
  },
  revokeShare(id) {
    const l = state.db.SHARE_LINKS.find((x) => x.id === id);
    if (!l || !(can("share", "a") || l.by === state.userId)) throw new Error("forbidden");
    l.status = "revoked";
    this.log(`Share link revoked · ${l.label}`, "ShareLink " + id);
    persist();
  },
  shareUrl(l) {
    return `https://${this.cfg().short.toLowerCase()}.app/s/${l.id}`;
  },
  // What an outsider gets on the web: files if the link is live and the PIN matches, a reason otherwise.
  openShare(id, pin = "") {
    const l = state.db.SHARE_LINKS.find((x) => x.id === id);
    if (!l) return { ok: false, why: "This link does not exist." };
    if (l.status !== "active") return { ok: false, why: "This link was revoked by the studio." };
    if (l.expires < TODAY) return { ok: false, why: `This link expired on ${l.expires}.` };
    if (l.pin && l.pin !== pin) return { ok: false, why: "PIN needed.", pin: true };
    l.views += 1;
    persist();
    return { ok: true, link: l, files: this.shareFiles(l) };
  },
  shareFiles(l) {
    const walk = (nodes, path) => nodes.flatMap((n) => (n.dir ? walk(n.c || [], path + "/" + n.p) : [{ name: n.p, size: n.size || "", path }]));
    const root = NAS_TREE.entries.find((e) => (e.map || "").endsWith(l.projectId));
    return walk(root ? root.c || [] : [], "").filter((f) => !l.path || f.path.includes("/" + l.path.split("/").pop()));
  },
  // People away on a date, scoped to a project's members when given.
  away(date = TODAY, projectId) {
    const ids = projectId ? new Set(state.db.THREADS.filter((t) => t.projectId === projectId).flatMap((t) => t.memberIds)) : null;
    const leave = state.db.LEAVES.filter((l) => l.status === "approved" && l.from <= date && l.to >= date && (!ids || ids.has(l.userId))).map((l) => ({ userId: l.userId, why: `${l.type} leave till ${l.to}` }));
    const hol = state.db.HOLIDAYS.find((h) => h.date === date);
    return hol ? [...leave, { userId: null, why: hol.name }] : leave;
  },
  // Leave approval hands open tasks in the window to a stand-in. Audit row per task; nothing silent.
  // Move a person's open tasks that fall due inside a leave window to a stand-in (emergency replacement).
  reassignTasks(fromId, toId, from, to, note = "") {
    if (!can("leave", "a")) throw new Error("forbidden");
    if (!user(toId)) throw new Error("not found");
    const moved = state.db.TASKS.filter((t) => t.owner === fromId && t.status === "open" && t.due && t.due >= from && t.due <= to);
    moved.forEach((t) => {
      t.prevOwner = t.owner;
      t.owner = toId;
      t.handover = note;
    });
    this.log(`${moved.length} task${moved.length === 1 ? "" : "s"} reassigned · ${user(fromId).name} → ${user(toId).name} while on leave`, "Leave " + from);
    persist();
    return moved;
  },
  reassignForLeave(leaveId, toUserId, note = "") {
    if (!can("leave", "a")) throw new Error("forbidden");
    const l = state.db.LEAVES.find((x) => x.id === leaveId);
    if (!l || !user(toUserId)) throw new Error("not found");
    const moved = state.db.TASKS.filter((t) => t.owner === l.userId && t.status === "open" && t.due >= l.from && t.due <= l.to);
    moved.forEach((t) => {
      t.prevOwner = t.owner;
      t.owner = toUserId;
      t.handover = note;
    });
    this.log(`${moved.length} task${moved.length === 1 ? "" : "s"} reassigned · ${user(l.userId).name} → ${user(toUserId).name} while on leave`, "LeaveRequest " + leaveId);
    persist();
    return moved;
  },
  addTask(t) {
    if (!can("task", "w") || !this.project(t.projectId)) throw new Error("forbidden");
    if (!(t.title || "").trim()) throw new Error("Task needs a title");
    const rec = { id: uid(), projectId: t.projectId, title: t.title.trim(), owner: t.owner || state.userId, due: t.due || TODAY, status: "open", critical: !!t.critical, by: state.userId };
    state.db.TASKS.push(rec);
    this.log(`Task added · ${rec.title} → ${user(rec.owner)?.name || rec.owner}`, "Task " + rec.id);
    persist();
    return rec;
  },
  // Open tasks per person, so the scheduler sees load before assigning.
  load(userId) {
    return state.db.TASKS.filter((t) => t.owner === userId && t.status === "open").length;
  },
  drawingIndex(projectId) {
    if (!can("drawing", "r")) return [];
    return state.db.DRAWING_INDEX.filter((d) => d.projectId === projectId);
  },
  // Manual tick needs a reason. Auto tick comes from a client approval record naming the drawing.
  finaliseDrawing(id, reason) {
    if (!can("drawing", "w")) throw new Error("forbidden");
    const d = state.db.DRAWING_INDEX.find((x) => x.id === id);
    if (!d) throw new Error("not found");
    if (!(reason || "").trim()) throw new Error("Say why this is finalised");
    Object.assign(d, { done: true, doneBy: state.userId, doneAt: TODAY, how: "Finalised · " + reason.trim() });
    this.log(`Drawing finalised · ${d.no}`, "Drawing " + d.no);
    persist();
  },
  strikeDrawings(projectId, text, by, how) {
    state.db.DRAWING_INDEX.filter((d) => d.projectId === projectId && !d.done && text && String(text).includes(d.no)).forEach((d) => Object.assign(d, { done: true, doneBy: by, doneAt: TODAY, how }));
  },
  // Mark-up saves a new photo linked to the original; the original never changes.
  markup(feedId, shapes, note = "") {
    if (!can("feed", "w")) throw new Error("forbidden");
    const src = state.db.FEED.find((f) => f.id === feedId);
    if (!src || src.type !== "photo") throw new Error("not found");
    const rec = { id: uid(), siteId: src.siteId, type: "photo", by: state.userId, at: new Date().toISOString().slice(0, 16), text: note || `Marked up · ${src.text}`, tags: [...(src.tags || []), "markup"], hue: src.hue, seed: src.seed, markupOf: feedId, shapes };
    state.db.FEED.unshift(rec);
    persist();
    return rec;
  },
  // Video call card posted to the thread. Meet for the studio, Jitsi when outsiders have no Google account.
  startCall(threadId, provider = "meet") {
    const code = () => Math.random().toString(36).slice(2, 5);
    const url = provider === "jitsi" ? `https://meet.jit.si/${this.cfg().short}-${uid().slice(1)}` : `https://meet.google.com/${code()}-${code()}${code().slice(0, 1)}-${code()}`;
    const id = this.addMessage(threadId, { text: `Video call started`, call: { provider: provider === "jitsi" ? "Jitsi" : "Google Meet", url } });
    return { id, url };
  },
  portfolio() {
    return state.db.PORTFOLIO.filter((p) => p.public !== false);
  },
  togglePortfolio(id) {
    if (!can("agency", "w")) throw new Error("forbidden");
    const p = state.db.PORTFOLIO.find((x) => x.id === id);
    p.public = p.public === false;
    persist();
  },
  clientRefs(projectId) {
    if (!can("ref", "r") || !this.myProjectIds().includes(projectId)) return [];
    return state.db.CLIENT_REFS.filter((r) => r.projectId === projectId).sort((a, b) => b.at.localeCompare(a.at));
  },
  addClientRef(r) {
    if (!can("ref", "w") || !this.myProjectIds().includes(r.projectId)) throw new Error("forbidden");
    if (!(r.url || "").trim()) throw new Error("Paste the link");
    const src = /pinterest|pin\.it/i.test(r.url) ? "Pinterest" : /instagram/i.test(r.url) ? "Instagram" : "Web";
    const rec = { id: uid(), projectId: r.projectId, by: state.userId, src, title: (r.title || "").trim() || src + " reference", url: r.url.trim(), room: (r.room || "").trim(), at: TODAY, promoted: false };
    state.db.CLIENT_REFS.unshift(rec);
    persist();
    return rec;
  },
  promoteRef(id) {
    if (!can("moodboard", "w")) throw new Error("forbidden");
    const r = state.db.CLIENT_REFS.find((x) => x.id === id);
    if (!r || r.promoted) return false;
    state.db.MOODBOARD.push({ id: uid(), projectId: r.projectId, title: r.title, src: r.src, hue: (r.title.length * 37) % 360, seed: r.title.length, refId: r.id });
    r.promoted = true;
    persist();
    return true;
  },
  intake(projectId) {
    if (!can("intake", "r") || !this.myProjectIds().includes(projectId)) return [];
    return state.db.INTAKE.filter((i) => i.projectId === projectId);
  },
  // Ask the client for one item: status moves to requested and the ask lands in the client thread.
  askIntake(id) {
    if (!can("intake", "w")) throw new Error("forbidden");
    const i = state.db.INTAKE.find((x) => x.id === id);
    const t = state.db.THREADS.find((x) => x.projectId === i.projectId && x.kind === "client");
    if (!i || !t) throw new Error("not found");
    this.addMessage(t.id, { text: `Could you share: ${i.item}? You can upload it from Projects in the app.`, intakeId: id });
    Object.assign(i, { status: "requested", at: TODAY });
    persist();
  },
  receiveIntake(id, fileName = "") {
    const i = state.db.INTAKE.find((x) => x.id === id);
    if (!i || !can("intake", "r") || !this.myProjectIds().includes(i.projectId)) throw new Error("forbidden");
    Object.assign(i, { status: "received", at: TODAY, file: fileName });
    this.log(`Intake received · ${i.item}`, "Intake " + id);
    persist();
  },
  addIntake(projectId, item) {
    if (!can("intake", "w") || !(item || "").trim()) throw new Error("forbidden");
    state.db.INTAKE.push({ id: uid(), projectId, item: item.trim(), status: "missing" });
    persist();
  },
  // Dashboard feed, scoped by role. Newest first.
  notifications() {
    return state.db.NOTIFICATIONS.filter((n) => n.roles.includes(effectiveRole())).sort((a, b) => b.at.localeCompare(a.at));
  },
  notify(text, ref, roles = ["partner"]) {
    state.db.NOTIFICATIONS.unshift({ id: uid(), at: new Date().toISOString().slice(0, 16), kind: "app", text, ref, roles });
    persist();
  },
  // Personal checklist on the dashboard. Private to the person and this browser.
  checks() {
    return state.db.CHECKS.filter((c) => c.userId === state.userId);
  },
  addCheck(text) {
    if (!(text || "").trim()) return;
    state.db.CHECKS.push({ id: uid(), userId: state.userId, text: text.trim(), done: false });
    persist();
  },
  toggleCheck(id) {
    const c = state.db.CHECKS.find((x) => x.id === id && x.userId === state.userId);
    if (c) c.done = !c.done;
    persist();
  },
};
// gamification: rate-limited, never self-award from UI, quiet mode respected
export const awardLog = {};
export function award(userId, pts, why) {
  if (state.gamify.optOut) return;
  const k = userId + ":" + why;
  const n = (awardLog[k] || 0) + 1;
  awardLog[k] = n;
  if (n > 3) return; // ponytail: per-session rate limit; production = per-day per-reason cap in the service
  const u = state.db.USERS.find((x) => x.id === userId);
  if (u) u.pts = (u.pts || 0) + pts;
}

// ---------- sync queue (offline-first outbox) ----------
// items: { id, kind, siteId, label, bytes, status: queued|uploading|done|failed, progress, attempts, idem }
export function enqueue(item) {
  state.queue.unshift({
    id: uid(),
    idem: uid() + Date.now(),
    status: "queued",
    progress: 0,
    attempts: 0,
    ...item,
    by: state.userId,
  });
  persist();
  render();
  flushQueue();
}
export let flushing = false;
export function flushQueue() {
  if (!state.online || flushing) return;
  const next = state.queue.find(
    (q) => q.status === "queued" || (q.status === "failed" && q.retry),
  );
  if (!next) return;
  flushing = true;
  next.status = "uploading";
  next.attempts++;
  next.retry = false;
  persist();
  render();
  const step = () => {
    if (!state.online) {
      next.status = "queued";
      next.progress = 0;
      flushing = false;
      persist();
      render();
      return;
    }
    next.progress = Math.min(100, next.progress + 20 + Math.random() * 20);
    if (next.progress >= 100) {
      // idempotent commit: same idem key never creates a second feed item
      if (next.attempts > 1 && Math.random() < 0.0) {
      }
      if (!state.db.FEED.some((f) => f.idem === next.idem)) {
        if (
          next.kind === "photo" ||
          next.kind === "voice" ||
          next.kind === "note"
        )
          state.db.FEED.unshift({
            id: uid(),
            idem: next.idem,
            siteId: next.siteId,
            type: next.kind,
            by: next.by || state.userId,
            at: new Date().toISOString().slice(0, 16),
            text: next.label,
            tags: next.tags || [],
            hue: next.hue || 30,
            seed: next.seed || 1,
            dur: next.dur,
            transcript: next.transcript,
            aiSummary: next.aiSummary,
          });
      }
      next.status = "done";
      flushing = false;
      persist();
      render();
      setTimeout(() => {
        state.queue = state.queue.filter(
          (q) => q.id !== next.id || q.status !== "done",
        );
        persist();
        render();
        flushQueue();
      }, 1800);
      return;
    }
    if (next.attempts === 1 && next.progress > 50 && next.failOnce) {
      next.status = "failed";
      next.error = "Connection dropped";
      flushing = false;
      persist();
      render();
      return;
    }
    setTimeout(step, 350);
  };
  setTimeout(step, 300);
}
export function setOnline(v) {
  state.online = v;
  if (v) {
    state.queue.forEach((q) => {
      if (q.status === "failed") q.retry = true;
    });
    flushQueue();
  }
  render();
}

// ---------- AI provider interface (provider-agnostic; mock impl) ----------
export const AIProvider = {
  name: "mock", // swap: 'ollama' (NAS), 'whisper-local', 'hosted'
  async transcribe(item) {
    return item.transcript || "Transcript unavailable in prototype.";
  },
  async summarize(text) {
    return text.length > 140
      ? text.slice(0, 120).replace(/\s\S*$/, "") + "…"
      : text;
  },
  async extractIssue(item) {
    return item.aiIssue || null;
  },
  async draftReply(thread, lastMsg) {
    const t=svc.thread(thread?.id), m=lastMsg&&svc.assistSource({type:'message',id:lastMsg.id});
    if (!t || !m || m.threadId!==t.id) throw new Error('The source conversation is unavailable.');
    return 'Thanks for the update. Could you confirm the next step and when you need a response?';
  },
  async ask(projectId, question) {
    try {const r=await svc.aiAssist('ask',{projectId,question});return [r.text,...r.conflicts,...r.missing].join('\n\n');}
    catch(error) {return error.message;}
  },
  async suggestResolution(conflict, b) {
    const alt = svc.suggestSlot(b);
    return alt
      ? `${alt.why}: ${alt.roomId !== b.roomId ? state.db.ROOMS.find((r) => r.id === alt.roomId).name + ", " : ""}${hh(alt.start)} to ${hh(alt.end)}`
      : "No free slot today. Try tomorrow morning.";
  },
  // Bill or receipt photo: vendor, amount, GST. Canned; production reads the image on the escalation model (docs/ai-model-costs.html).
  async extractBill(m) {
    const t = (m && (m.text || m.transcript)) || "";
    if (/cement|opc|bags/i.test(t))
      return {
        vendorId: "v4",
        vendor: "Shree Cement Depot",
        amount: 18400,
        gst: 4025,
        date: TODAY,
        items: "40 bags OPC 53 grade",
        conf: 0.93,
      };
    if (/tmt|steel/i.test(t))
      return {
        vendorId: "v4",
        vendor: "Shree Cement Depot",
        amount: 110700,
        gst: 16883,
        date: TODAY,
        items: "TMT 12 mm, 1.8 t",
        conf: 0.9,
      };
    if (/cab|auto|travel|petrol/i.test(t))
      return {
        vendor: "Cash",
        amount: 620,
        gst: 0,
        date: TODAY,
        items: "Travel",
        conf: 0.7,
      };
    return {
      vendor: "Unknown vendor",
      amount: m && m.bill ? m.bill.amount : 2400,
      gst: 0,
      date: TODAY,
      items: "Bill",
      conf: 0.55,
    };
  },
  // Delivery challan photo matched to the open order for that site.
  async matchChallan(m) {
    const t = (m && m.text) || "";
    if (/tmt|steel/i.test(t))
      return {
        item: "TMT 12 mm",
        ordered: 2,
        received: 1.8,
        unit: "t",
        vendorId: "v4",
        short: true,
      };
    if (/gypsum|board/i.test(t))
      return {
        item: "Gypsum board 12.5 mm",
        ordered: 60,
        received: 60,
        unit: "sheets",
        vendorId: "v3",
        short: false,
      };
    return {
      item: "OPC 53 cement",
      ordered: 40,
      received: 40,
      unit: "bags",
      vendorId: "v4",
      short: false,
    };
  },
  // Payment nudge for an overdue fee stage, in the client's language. Partner taps Send.
  async draftNudge(inv, lang = "English") {
    const p = state.db.PROJECTS.find((x) => x.id === inv.projectId) || {};
    const days = Math.round((new Date(TODAY) - new Date(inv.due)) / 864e5);
    if (lang === "Hinglish")
      return `Namaste, ${p.name} ka invoice ${inv.no} (${inr(inv.amount)}) ${days} din se pending hai. Aap convenient ho to is hafte clear kar dijiye. Dhanyavaad.`;
    if (lang === "Gujlish")
      return `Namaste, ${p.name} nu invoice ${inv.no} (${inr(inv.amount)}) ${days} divas thi baaki chhe. Aa athwadiye clear kari shako to saru. Aabhar.`;
    return `Hello, a gentle reminder that invoice ${inv.no} for ${p.name} (${inr(inv.amount)}) is ${days} days past due. Could you clear it this week? Thank you.`;
  },
  // Project facts drafted from an imported chat. Confirmed by a person before saving.
  async projectFacts(group) {
    const g = group || {};
    return {
      client: (g.numbers || []).find((n) => n[2] === "client")?.[1] || "",
      address:
        g.guess === "HA-2502"
          ? "Plot 14, Bopal, Ahmedabad"
          : "See first message",
      phase: g.guess === "HA-2502" ? 4 : 5,
      decisions: [
        "Italian marble dropped for Kota in living, 2025-03",
        "Kitchen moved to north wall after site visit",
      ],
      money:
        g.guess === "HA-2502"
          ? "Stage 3 invoice sent, ₹2.1 L pending"
          : "All stages paid",
      conf: 0.82,
    };
  },
  // Weekly progress card for one project, from the week's photos. Partner approves before the client sees it.
  async weeklyCard(projectId) {
    const p = state.db.PROJECTS.find((x) => x.id === projectId) || {};
    const s = state.db.SITES.find((x) => x.projectId === projectId) || {};
    const wk = state.db.FEED.filter(
      (f) => f.siteId === s.id && f.at >= addDays(TODAY, -6),
    );
    return {
      title: `${p.name}, week to ${fmtD(TODAY)}`,
      photos: wk.length,
      lines: [
        `${s.stage || "On site"}: ${s.progress || 0}% overall`,
        `${wk.length} site updates this week`,
        "Next: " +
          ((p.milestones || []).find((m) => !m.done)?.name || "handover"),
      ],
      askClient: (state.db.DECISIONS_DUE || [])
        .filter((d) => d.projectId === projectId && d.status === "open")
        .map((d) => d.title),
    };
  },
  anomalies() {
    const late = state.db.ATTENDANCE_TODAY.filter((a) => a.mark === "late");
    const out = [];
    const dp = state.db.SALARY.find((s) => s.userId === "u8");
    if (dp && dp.lateMarks >= 4)
      out.push({
        kind: "attendance",
        text: `Dhruv Patel: 4 late marks this month, up from 0 last month. Might be worth a check-in before it becomes a half-day deduction.`,
      });
    if (late.length >= 2)
      out.push({
        kind: "attendance",
        text: `${late.length} late arrivals today. No pattern yet across the week.`,
      });
    const slow = state.db.ISSUES.filter(
      (i) =>
        i.status !== "closed" && new Date(i.due) < new Date(TODAY + "T23:59"),
    );
    if (slow.length)
      out.push({
        kind: "delay",
        text: `${slow.length} site issue${slow.length > 1 ? "s" : ""} due within 24 h: ${slow.map((i) => i.title).join("; ")}.`,
      });
    out.push({
      kind: "delay",
      text: "Sanghvi Office: ceiling grid milestone (22 Sep) at risk if E5 duct clash is not resolved by Thursday.",
    });
    return out;
  },
};

// ---------- router ----------
export function go(route) {
  state.route = route;
  state.sheet = null;
  render();
  if (typeof window !== "undefined") window.__navigate?.(route);
}
export function parseRoute() {
  const [path, qs] = (state.route || "#/home").replace(/^#\/?/, "").split("?");
  const parts = path.split("/");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  return { parts, q };
}
export function toast(msg) {
  state.toast = msg;
  render();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    state.toast = null;
    render();
  }, 2200);
}
export function sheet(kind, data = {}) {
  state.sheet = { kind, ...data };
  render();
}
export function closeSheet() {
  state.sheet = null;
  render();
}

// ---------- placeholder imagery: deterministic "architectural photo" painter ----------
export function paintPh(canvas) {
  // Seeded hues vary per image; fold them into the brand's blue range (196-216) so placeholders
  // match the palette while staying distinguishable from each other.
  const hue = 196 + (((+canvas.dataset.hue || 30) % 360) / 360) * 20,
    seed = +canvas.dataset.seed || 1;
  const w = (canvas.width = 320),
    h = (canvas.height = Math.round(320 / (+canvas.dataset.ar || 1.333)));
  const x = canvas.getContext("2d");
  let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const dark =
    document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  const L = dark ? 22 : 78;
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue} 18% ${L + 8}%)`);
  g.addColorStop(1, `hsl(${hue + 20} 22% ${L - 14}%)`);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // light wash from top-left, planes like walls/slabs
  for (let i = 0; i < 5; i++) {
    x.fillStyle = `hsl(${hue + rnd() * 30 - 15} ${14 + rnd() * 16}% ${L - 24 + rnd() * 34}% / ${0.45 + rnd() * 0.4})`;
    const px = rnd() * w * 0.7,
      py = rnd() * h * 0.6;
    x.fillRect(px, py, rnd() * w * 0.6 + 30, rnd() * h * 0.6 + 20);
  }
  x.fillStyle = `hsl(${hue} 10% ${dark ? 8 : 96}% / .35)`;
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(w * (0.4 + rnd() * 0.3), 0);
  x.lineTo(0, h * (0.5 + rnd() * 0.4));
  x.fill();
  x.strokeStyle = `hsl(${hue} 12% ${dark ? 45 : 30}% / .35)`;
  x.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    const y = rnd() * h;
    x.moveTo(0, y);
    x.lineTo(w, y + (rnd() - 0.5) * 60);
    x.stroke();
  }
}
export function ph(hue, seed, ar = 1.333, cls = "") {
  return `<div class="ph ${cls}"><canvas data-hue="${hue}" data-seed="${seed}" data-ar="${ar}" aria-hidden="true"></canvas></div>`;
}

// Resolve at the action boundary as well as when rendering a conversation.
export function accessibleMessage(id, threads = svc.threads()) {
  return state.db.MESSAGES.find(m => m.id === id && !m.deleted &&
    threads.some(t => t.id === m.threadId)) || null;
}
export function messageAttachment(m) {
  if (!m || m.deleted) return null;
  if (m.file) {
    const title = String(m.file.name || "File");
    // ponytail: dated filenames group shared copies within one thread; an issued
    // drawing link requires a real transmittal ID, never a filename guess.
    const family = name => String(name || "").replace(/_\d{2}\.\d{2}\.\d{2}(?=\.(pdf|dwg)$)/i, "_DATE");
    const dated = /_\d{2}\.\d{2}\.\d{2}\.(pdf|dwg)$/i.test(title);
    const newer = dated ? state.db.MESSAGES.filter(x => x.file && !x.deleted && !x.pending &&
      x.threadId === m.threadId && x.at > m.at && family(x.file.name) === family(title))
      .sort((a, b) => b.at.localeCompare(a.at))[0] : null;
    const drawing = dated || state.filings[m.id]?.kind === "drawing";
    const copy = dated && state.filings[m.id]?.rev;
    return { kind: drawing ? "Drawing" : "File", title,
      detail: [copy ? "Shared copy " + copy : drawing ? "Drawing" : "File",
        newer ? "Older copy" : "", drawing ? "Confirm issue status before site use" : ""].filter(Boolean).join(" · "),
      newerId: newer?.id || null };
  }
  if (m.album) return { kind: "Photos", title: Number(m.album.n) + " photos", detail: "Photo update", newerId: null };
  if (m.photo) return { kind: "Photo", title: "Photo", detail: "Photo update", newerId: null };
  return null;
}
export function messageAttachmentPreview(m) {
  const a = messageAttachment(m);
  if (!a) return "";
  if (m.file) return `<p class="attachment-placeholder">File preview unavailable in this prototype. The original file is not attached.</p>`;
  const media = m.photo || m.album;
  const count = m.album ? Math.max(1, Math.min(Number(m.album.n) || 1, 4)) : 1;
  return `<div class="attachment-images">${Array.from({ length: count }, (_, i) => ph(Number(media.hue) || 30, (Number(media.seed) || 1) + i)).join("")}</div><p class="muted">Demo image${m.album ? "s" : ""}${m.album && m.album.n > 4 ? " · first 4 shown" : ""}; original media is not attached.</p>`;
}

// WhatsApp export parser. iPhone: "\u200e[dd/mm/yy, h:mm:ss\u202fPM] Name: text". Android: "dd/mm/yy, hh:mm - Name: text".
// Handles direction marks, 12 and 24 hour clocks, multi-line messages, "<attached: f>", "image omitted", deleted, edited, @mentions.
export function parseWA(txt) {
  const clean = (x) =>
    x
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/\u202f/g, " ")
      .trim();
  const re =
    /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d\d)(?::\d\d)?\s?([AaPp][Mm])?\]?(?: -)? ([^:]+?): ?(.*)$/;
  const p2 = (n) => String(n).padStart(2, "0");
  const kindOf = (f) =>
    /\.(jpe?g|png|heic|webp|gif)$/i.test(f)
      ? "photo"
      : /\.(mp4|mov)$/i.test(f)
        ? "video"
        : /\.(opus|m4a|mp3|aac)$/i.test(f)
          ? "audio"
          : /\.(pdf|dwg|dxf)$/i.test(f)
            ? "drawing"
            : "doc";
  const rows = [],
    seen = new Set();
  let dup = 0;
  txt
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line) => {
      const c = clean(line);
      const m = c.match(re);
      if (!m) {
        if (c && rows.length && rows[rows.length - 1].text != null)
          rows[rows.length - 1].text += "\n" + c;
        return;
      }
      let h = +m[4];
      if (m[6] && /pm/i.test(m[6]) && h < 12) h += 12;
      if (m[6] && /am/i.test(m[6]) && h === 12) h = 0;
      const yr = m[3].length === 2 ? "20" + m[3] : m[3];
      const row = {
        at: `${yr}-${p2(m[2])}-${p2(m[1])}T${p2(h)}:${m[5]}`,
        who: m[7].trim().replace(/^~\s*/, "") || "Unknown number",
      };
      let body = m[8].trim();
      if (!body) return;
      if (
        /^(This message was deleted\.?|You deleted this message\.?)$/.test(body)
      )
        row.deleted = true;
      else if (
        /created (this )?group|changed the (group|subject)|joined using|added you|changed this group/.test(
          body,
        )
      )
        row.system = true;
      else {
        const att = body.match(/<attached: ([^>]+)>/);
        const om = body.match(
          /^(.*?)\s*(image|video|audio|GIF|sticker|document|Contact card) omitted$/i,
        );
        if (att) {
          const file = att[1].replace(/^\d{8}-/, "");
          if (seen.has(file)) return dup++;
          seen.add(file);
          row.file = file;
          row.kind = kindOf(file);
          const cap = body
            .replace(att[0], "")
            .replace(/\s*•.*$/, "")
            .trim();
          if (cap && cap !== file) row.text = cap;
        } else if (om) {
          const k = om[2].toLowerCase();
          row.kind =
            k === "image" || k === "gif" || k === "sticker"
              ? "photo"
              : k === "document"
                ? "drawing"
                : k === "contact card"
                  ? "doc"
                  : k;
          row.omitted = true;
          const cap = om[1].replace(/\s*•.*$/, "").trim();
          if (/\.[a-z0-9]{2,4}$/i.test(cap)) {
            row.file = cap;
            row.kind = kindOf(cap);
          } else if (cap) row.text = cap;
        } else {
          row.text = body.replace(
            /\s*<This message was edited>$/,
            () => ((row.edited = true), ""),
          );
          const men = [...line.matchAll(/@\u2068([^\u2069]+)\u2069/g)].map(
            (x) => clean(x[1]).replace(/^~\s*/, ""),
          );
          if (!men.length)
            men.push(...[...row.text.matchAll(/@([^\s@]+)/g)].map((x) => x[1]));
          if (men.length) row.mentions = men;
        }
      }
      rows.push(row);
    });
  rows.sort((a, b) => a.at.localeCompare(b.at));
  const senders = [...new Set(rows.filter((r) => !r.system).map((r) => r.who))];
  const n = (f) => rows.filter(f).length;
  return {
    rows,
    dup,
    senders,
    stats: {
      messages: n((r) => r.text != null && !r.file && !r.omitted),
      photos: n((r) => r.kind === "photo"),
      videos: n((r) => r.kind === "video"),
      drawings: n((r) => r.kind === "drawing" || r.kind === "doc"),
      deleted: n((r) => r.deleted),
      mentions: n((r) => r.mentions),
    },
  };
}

// ---------- Reviewed site updates: one source, reusable records ----------
// ponytail: deterministic text extraction demonstrates the review flow; replace
// only this AIProvider method when a real, permission-scoped model is connected.
AIProvider.siteUpdateDraft = function (m) {
  const text = String(m.transcript || m.text || "");
  const head = text.match(/\b(\d+)\s+(?:workers?|labou?rers?|people)\b/i);
  const item = text.match(/\b(tiles?|cement|sand|steel|bricks?|boards?)\b/i);
  const amounts = text.match(/\breceived\s+(\d+(?:\.\d+)?)\s*(?:of|out of|\/)\s*(\d+(?:\.\d+)?)\s*(boxes|bags|tonnes?|sheets|pieces|units)?\b/i);
  const delivery = /\b(deliver\w*|received|short\w*)\b/i.test(text) && (item || amounts);
  const problem = /\b(short\w*|blocked|stopped|leak\w*|crack\w*|mismatch|missing|narrow\w*|issue|problem|confirm|check before)\b/i.test(text);
  return {
    headcount: head ? head[1] : "",
    delivery: delivery ? { item: item?.[0] || "", received: amounts?.[1] || "", ordered: amounts?.[2] || "", unit: amounts?.[3] || (text.match(/\b(boxes|bags|tonnes?|sheets|pieces)\b/i)?.[0] || "units") } : null,
    issueTitle: m.aiIssue?.title || (problem ? text.slice(0, 180) : ""),
  };
};
export function siteUpdateContext(msgId) {
  const message = accessibleMessage(msgId), role = effectiveRole();
  if (!message || message.pending || message.siteAnswer || !["partner", "designer", "site_manager", "contractor"].includes(role)) return null;
  const thread = svc.thread(message.threadId);
  if (!thread || !["site", "internal"].includes(thread.kind)) return null;
  const site = svc.sites().find(s => thread.siteId ? s.id === thread.siteId : s.projectId === thread.projectId);
  if (!site || thread.projectId !== site.projectId || (role === "contractor" && message.by !== state.userId)) return null;
  return { message, thread, site };
}
export function siteWorkflowIssues(context) {
  return state.db.ISSUES.filter(i => i.siteId === context.site.id && i.projectId === context.site.projectId &&
    (effectiveRole() !== "contractor" || i.raisedBy === state.userId));
}
svc.siteUpdateReview = function (msgId) {
  const context = siteUpdateContext(msgId);
  if (!context) return null;
  const m = context.message, date = String(m.at).slice(0, 10), suggestion = AIProvider.siteUpdateDraft(m);
  const words = new Set(String(m.transcript || m.text || "").toLowerCase().match(/[a-z]{4,}/g) || []);
  const stop = new Set(["this", "that", "with", "from", "today", "please", "site", "need", "work", "have", "been"]);
  const relatedIssues = siteWorkflowIssues(context).filter(i => i.status !== "closed").map(i => ({
    id: i.id, title: i.title,
    score: (i.title.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stop.has(w) && words.has(w)).length,
  })).filter(i => i.score > 0).sort((a,b) => b.score-a.score).slice(0,3).map(({id,title}) => ({id,title}));
  return { ...context, suggestion, relatedIssues,
    canAttendance: !m.attendance && !state.db.HEADCOUNT.some(h => h.siteId === context.site.id && h.date === date && h.contractorId === m.by),
    canDelivery: !m.challan && !state.db.GRNS.some(g => g.msgId === m.id),
    canIssue: !m.issueId && can("issue", "w", effectiveRole()),
    applied: m.siteRecords || null,
  };
};
export function saveSiteWorkflow(change) {
  const tables = ["MESSAGES", "HEADCOUNT", "GRNS", "ISSUES", "AUDIT"];
  const before = Object.fromEntries(tables.map(k => [k, clone(state.db[k])]));
  try {
    const result = change();
    if (!persist()) throw new Error("Could not save on this device. Your review is still here; try again.");
    return result;
  } catch (error) {
    tables.forEach(k => { state.db[k] = before[k]; });
    throw error;
  }
}
svc.saveSiteUpdate = function (msgId, patch) {
  const r = this.siteUpdateReview(msgId);
  if (!r) throw new Error("This site update is unavailable or outside your access.");
  if (r.applied) return r.applied; // One confirmed operation per source; retry never duplicates records.
  if (!patch.attendance && !patch.delivery && !patch.issue) throw new Error("Select at least one record to save.");
  const count = Number(patch.headcount), received = Number(patch.received), ordered = Number(patch.ordered);
  const item = String(patch.item || "").trim(), unit = String(patch.unit || "").trim(), title = String(patch.title || "").trim();
  if (patch.attendance && (!r.canAttendance || !String(patch.headcount ?? "").trim() || !Number.isSafeInteger(count) || count < 0 || count > 10000))
    throw new Error("Attendance is already recorded, or the worker count is invalid. Use a whole number from 0 to 10,000.");
  if (patch.delivery && (!r.canDelivery || !item || item.length > 200 || !unit || unit.length > 40 || !String(patch.received ?? "").trim() || !String(patch.ordered ?? "").trim() || !Number.isFinite(received) || !Number.isFinite(ordered) || received < 0 || ordered <= 0))
    throw new Error("Check the item, unit, received quantity and ordered quantity. Leave delivery unselected if these are unknown.");
  const existing = patch.issueId ? siteWorkflowIssues(r).find(i => i.id === patch.issueId && i.status !== "closed") : null;
  if (patch.issue && (!r.canIssue || (patch.issueId && !existing) || (!patch.issueId && (!title || title.length > 240))))
    throw new Error("Choose an accessible open issue, or enter a new issue title (up to 240 characters).");
  return saveSiteWorkflow(() => {
    const {message:m,site} = r, at = new Date().toISOString().slice(0,16), date = String(m.at).slice(0,10);
    const records = { confirmedBy:state.userId, at };
    if (patch.attendance) {
      records.attendanceId = uid();
      state.db.HEADCOUNT.push({ id:records.attendanceId, siteId:site.id, date, contractorId:m.by, count, trades:{}, at:String(m.at).slice(11,16), msgId:m.id, confirmedBy:state.userId });
    }
    if (patch.delivery) {
      records.deliveryId = uid();
      state.db.GRNS.push({ id:records.deliveryId, siteId:site.id, date, item, qty:received, ordered, unit, vendorId:null, by:m.by, status:received < ordered ? "short" : "received", note:"Recorded from reviewed site update", hue:30, seed:1, msgId:m.id, confirmedBy:state.userId });
    }
    if (patch.issue) {
      const issue = existing || { id:uid(), siteId:site.id, projectId:site.projectId, title, type:"Site update", drawing:"", sla:"Not set", raisedBy:m.by, at:m.at, status:"open", assignee:"", due:"", source:m.id, updates:[] };
      if (!existing) state.db.ISSUES.unshift(issue);
      issue.updates ||= [];
      if (!issue.updates.some(u => u.msgId === m.id)) issue.updates.push({by:m.by,at:m.at,text:m.transcript || m.text || "Photo update",msgId:m.id});
      records.issueId = issue.id;
      m.issueId = issue.id;
    }
    m.siteRecords = records;
    this.log("Site update reviewed", "Message " + m.id);
    return records;
  });
};
svc.siteIssueDetails = function (issueId) {
  const issue = state.db.ISSUES.find(i => i.id === issueId);
  if (!issue || !["partner", "designer", "site_manager", "contractor"].includes(effectiveRole()) || !this.site(issue.siteId)) return null;
  if (effectiveRole() === "contractor" && issue.raisedBy !== state.userId) return null;
  const sources = state.db.MESSAGES.filter(m => !m.siteAnswer && (m.issueId === issueId || m.id === issue.source || issue.updates?.some(u => u.msgId === m.id)) && siteUpdateContext(m.id)?.site.id === issue.siteId);
  if (!sources.length) return null;
  const first = sources.find(m => m.id === issue.source) || sources[0];
  const thread = this.thread(first.threadId);
  const answers = state.db.MESSAGES.filter(m => m.siteAnswer?.issueId === issueId && accessibleMessage(m.id));
  const latest = answers.at(-1);
  const covered = latest?.siteAnswer.sourceIds || [latest?.siteAnswer.sourceMessageId];
  const needsAnswer = !latest || latest.siteAnswer.response === "clarification" || sources.some(m => !covered.includes(m.id));
  return {issue,sources,answers,thread,needsAnswer,canAnswer:!!thread && issue.status !== "closed" && ["partner", "designer"].includes(effectiveRole()) && can("issue","w",effectiveRole())};
};
svc.answerSiteIssue = function (issueId, text) {
  const d = this.siteIssueDetails(issueId), answer = String(text || "").trim();
  if (!d?.canAnswer || d.issue.status === "closed") throw new Error("This issue cannot receive an office answer from your role.");
  if (!state.online) throw new Error("Connect before sending an office answer. Your draft is still here.");
  if (!answer || answer.length > 4000) throw new Error("Enter an answer of up to 4,000 characters.");
  return saveSiteWorkflow(() => {
    const id = uid(), at = new Date().toISOString().slice(0,16);
    const source = d.sources.find(m => m.id === d.issue.source) || d.sources[0];
    state.db.MESSAGES.push({id,threadId:d.thread.id,by:state.userId,at,text:answer,siteAnswer:{issueId,sourceMessageId:source.id,sourceIds:d.sources.map(m => m.id),response:null}});
    d.issue.status = "in_review";
    d.issue.updates ||= [];
    d.issue.updates.push({by:state.userId,at,text:answer,msgId:id});
    this.log("Office answer sent for site review", "Issue " + issueId);
    return id;
  });
};
svc.canRespondSiteAnswer = function (message) {
  const m = message && accessibleMessage(message.id);
  if (!m?.siteAnswer || m.by === state.userId || !["site_manager", "contractor"].includes(effectiveRole())) return false;
  const source = accessibleMessage(m.siteAnswer.sourceMessageId), t = source && this.thread(source.threadId);
  return !!source && m.threadId === source.threadId && !!this.site(t.siteId || state.db.SITES.find(s => s.projectId === t.projectId)?.id) && (source.by === state.userId || effectiveRole() === "site_manager");
};
svc.respondToSiteAnswer = function (messageId, response) {
  const m = accessibleMessage(messageId);
  if (!this.canRespondSiteAnswer(m) || !["acknowledged", "clarification"].includes(response)) throw new Error("This answer is unavailable for your response.");
  if (!state.online) throw new Error("Connect before responding. The office has not received a response.");
  if (m.siteAnswer.response === response && m.siteAnswer.respondedBy === state.userId) return m.siteAnswer;
  return saveSiteWorkflow(() => {
    Object.assign(m.siteAnswer,{response,respondedBy:state.userId,respondedAt:new Date().toISOString().slice(0,16)});
    this.log(response === "acknowledged" ? "Site acknowledged office answer" : "Site requested clarification", "Message " + m.id);
    return m.siteAnswer;
  });
};


// Meaningful recorded changes, not a second chat inbox. No AI inference or audit feed.
svc.projectUpdates = function ({ projectId } = {}) {
  const role = effectiveRole(), projects = this.projects().filter(p => !projectId || p.id === projectId);
  const pids = new Set(projects.map(p => p.id)), threads = this.threads().filter(t => pids.has(t.projectId));
  const updates = [], grouped = new Map();
  const add = (key, event) => {
    if (!event.at) return;
    const old = grouped.get(key);
    if (!old || event.at >= old.at) grouped.set(key, event);
  };
  for (const m of state.db.MESSAGES) {
    const t = threads.find(t => t.id === m.threadId);
    if (!t || m.deleted || m.pending) continue;
    if (m.siteAnswer) add('answer:' + m.siteAnswer.issueId, {
      id:'answer:' + m.id, projectId:t.projectId, kind:'answer', title:'Office answer',
      detail:(m.text || '').slice(0, 220), at:m.at,
      source:{type:'message', id:m.id, threadId:t.id}
    });
    // Resolve real approval writers through the readable request, never a private audit row.
    const material = m.approval?.id && this.materials({projectId:t.projectId}).find(x => x.id === m.approval.id);
    const decision = material && ['approved','rejected'].includes(material.status) ?
      {title:'Material ' + (material.status === 'approved' ? 'approved' : 'declined'), detail:material.name, status:material.status, at:material.decidedAt} :
      m.material && ['approved','declined'].includes(m.material.status) ?
      {title:'Material ' + m.material.status, detail:m.material.item, status:m.material.status, at:m.material.decidedAt} :
      m.bill?.status === 'approved' ?
      {title:'Expense approved', detail:'Approval recorded for this expense request', status:'approved', at:m.bill.decidedAt} :
      m.approval?.done || m.approvalRecord ?
      {title:'Approval recorded',detail:m.approvalRecord ? m.text : m.approval.label,status:'approved',at:m.approvalRecord ? m.at : m.approval.doneAt} : null;
    if (decision) add('approval:' + m.id, {
      id:'approval:' + m.id + ':' + decision.status + ':' + (decision.at || ''), projectId:t.projectId, kind:'approval', title:decision.title,
      detail:(decision.detail || 'Confirmed decision') + (decision.at ? '' : ' · date shown is the original request date'),
      at:decision.at || m.at, source:{type:'message', id:m.id, threadId:t.id}
    });
  }
  if (can('drawing', 'r', role)) for (const t of state.db.TRANSMITTALS) {
    if (!pids.has(t.projectId) || (['client','contractor'].includes(role) && (state.previewAsClient || t.to !== state.userId))) continue;
    add('drawing:' + t.projectId + ':' + t.no + ':' + t.to, {
      id:'drawing:' + t.id, projectId:t.projectId, kind:'drawing', title:t.no + ' · ' + t.rev,
      detail:'Sent to ' + user(t.to).name + '. Confirm issue purpose before site use.', at:t.at,
      source:{type:'drawing', id:t.no, transmittalId:t.id}
    });
  }
  if (can('site','r',role)) for (const g of state.db.GRNS) {
    const site = this.site(g.siteId);
    if (!site || !pids.has(site.projectId)) continue;
    // A source-backed record never widens the source conversation's audience.
    if (g.msgId && !accessibleMessage(g.msgId, threads)) continue;
    updates.push({id:'delivery:' + g.id + ':' + g.status + ':' + g.qty, projectId:site.projectId,
      kind:'delivery', title:g.item + ' · ' + (g.status === 'short' ? 'Short delivery' : 'Delivery recorded'),
      detail:g.qty + ' ' + g.unit + (g.ordered != null ? ' received of ' + g.ordered : ' received') + ' · ' + site.name,
      at:g.date, source:g.msgId ? {type:'message',id:g.msgId,threadId:accessibleMessage(g.msgId,threads).threadId} : {type:'delivery',id:g.id,siteId:site.id}});
  }
  return updates.concat([...grouped.values()]).sort((a,b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
};

// Contextual assistant examples. Every fact is projected before crossing the provider seam.
svc.assistKinds = function () {
  const r = effectiveRole();
  return [...(['partner','designer','site_manager','contractor'].includes(r) ? ['daily'] : []),
    ...(['partner','designer'].includes(r) ? ['client','concept'] : []),
    ...(can('task','w',r) ? ['followup'] : []), ...(r !== 'hr' ? ['ask'] : []),
    ...(can('material','r',r) ? ['compare'] : [])];
};
svc.assistSource = function (source) {
  if (!source) return null;
  const r = effectiveRole(), {type,id} = source;
  if (type === 'message') {
    const m = accessibleMessage(id);
    if (!m || m.pending || m.assistDraft) return null;
    const t = this.thread(m.threadId);
    if (!t?.projectId || !this.project(t.projectId)) return null;
    return {type,id,projectId:t.projectId,threadId:t.id,label:t.name + ' · ' + (m.at || 'Date not recorded'),
      text:m.text || m.transcript || (m.photo || m.album ? 'Image shared in conversation; original file is unavailable in this prototype.' : '')};
  }
  if (type === 'material') {
    if (!can('material','r',r)) return null;
    const m = this.materials().find(x=>x.id===id);
    return m ? {type,id,projectId:m.projectId,label:m.name,text:[m.name,m.vendor,m.status].filter(Boolean).join(' · ')} : null;
  }
  if (type === 'project') {
    const p=this.project(id);
    return p ? {type,id,projectId:p.id,label:p.name,text:p.milestones.map(m=>`${m.name} · ${m.done?'done':'pending'} · ${m.date || 'Date not recorded'}`).join('\n')} : null;
  }
  if (type === 'task' || type === 'issue') {
    if (!can(type,'r',r)) return null;
    const x=(type==='task'?this.tasks():this.issues()).find(x=>x.id===id);
    if (!x || !this.project(x.projectId)) return null;
    return {type,id,projectId:x.projectId,label:x.title,text:x.title + ' · ' + x.status + (x.due?' · due '+x.due:' · due date not recorded')};
  }
  if (type === 'attendance' || type === 'delivery') {
    if (!this.assistKinds().includes('daily')) return null;
    const x=state.db[type==='attendance'?'HEADCOUNT':'GRNS'].find(x=>x.id===id), site=x && this.site(x.siteId);
    if (!site || (x.msgId && !this.assistSource({type:'message',id:x.msgId}))) return null;
    if (type==='attendance' && r==='contractor' && x.contractorId!==state.userId && x.by!==state.userId) return null;
    return {type,id,siteId:site.id,projectId:site.projectId,label:site.name + ' · ' + x.date,
      text:type==='attendance'?`${x.count} workers recorded · ${user(x.contractorId || x.by).name}`:`${x.item}: ${x.qty} ${x.unit} received${x.ordered!=null?' of '+x.ordered:''} · ${x.status}`};
  }
  return null;
};
export function assistDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
}
export function assistContext(kind, options = {}) {
  if (!svc.assistKinds().includes(kind)) throw new Error('This assistant is unavailable for your role.');
  const c={kind,title:'',sources:[],missing:[],conflicts:[]}, add=source=>{
    const safe=svc.assistSource(source); if (safe && !c.sources.some(s=>s.type===safe.type&&s.id===safe.id)) c.sources.push(safe); return safe;
  };
  if (kind==='daily') {
    const site=svc.site(options.siteId), date=options.date;
    if (!site || !assistDate(date)) throw new Error('Choose an accessible site and a valid report date.');
    const thread=svc.threads().find(t=>t.kind==='site'&&t.siteId===site.id);
    if (!thread) throw new Error('No permitted site conversation is available.');
    c.title=site.name+' · '+date; c.destinationThreadId=thread.id;
    for (const [type,table] of [['attendance','HEADCOUNT'],['delivery','GRNS']]) {
      for (const row of state.db[table].filter(x=>x.siteId===site.id&&x.date===date)) add({type,id:row.id});
      if (!c.sources.some(s=>s.type===type)) c.missing.push('No confirmed '+type+' record for this date.');
    }
    for (const m of svc.messages(thread.id).filter(m=>m.at?.startsWith(date)&&m.siteRecords)) add({type:'message',id:m.id});
    c.missing.push('Unreported work, weather and completion percentages are unknown.');
  } else if (kind==='client') {
    const t=svc.thread(options.threadId), ids=[...new Set(options.messageIds || [])];
    if (!t || t.kind!=='client' || !ids.length || ids.length>12) throw new Error('Select 1–12 facts from the destination client conversation.');
    for (const id of ids) {
      const source=add({type:'message',id});
      if (!source || source.threadId!==t.id || !source.text) throw new Error('A selected client fact is no longer available in this conversation.');
    }
    c.title='Client update · '+t.name;c.destinationThreadId=t.id;
    c.missing.push('Confirm the wording and whether each selected fact is still current before sending. No new commitments inferred.');
  } else if (kind==='followup') {
    const source=add({type:'message',id:options.messageId}), m=source&&accessibleMessage(source.id), t=source&&svc.thread(source.threadId);
    if (!m || !(m.text || m.transcript)) throw new Error('Select a readable message with text or a transcript.');
    c.title='Suggested follow-up';
    c.proposal={title:source.text.slice(0,180),owner:'',due:'',owners:t.memberIds.map(id=>user(id)).filter(u=>['partner','designer','site_manager'].includes(u.role)).map(u=>({id:u.id,name:u.name}))};
    c.missing.push('Choose the responsible person and needed-by date. The message is not a confirmed commitment.');
  } else if (kind==='ask') {
    const p=svc.project(options.projectId), question=String(options.question||'').trim();
    if (!p || !question || question.length>500) throw new Error('Choose an accessible project and ask a question (up to 500 characters).');
    c.title='Project answer · '+p.name;c.question=question;
    if (options.issueId) {
      const detail=svc.siteIssueDetails(options.issueId);
      if (!detail || detail.issue.projectId!==p.id) throw new Error('This issue is not available in the selected project.');
      c.title='Issue brief · '+detail.issue.title;
      const latestUpdate=detail.sources.at(-1), latestAnswer=detail.answers.at(-1);
      c.issueBrief={status:detail.issue.status,update:(latestUpdate?.transcript || latestUpdate?.text || 'Attachment without recorded text').slice(0,280),answer:(latestAnswer?.text || 'No recorded office answer.').slice(0,280)};

      c.sources=[{type:'issue',id:detail.issue.id},...detail.sources.map(m=>({type:'message',id:m.id})),...detail.answers.map(m=>({type:'message',id:m.id}))].map(ref=>svc.assistSource(ref)).filter(Boolean);
      c.missing.push('Recorded issue history only. An acknowledgement does not establish resolution or construction approval.');
      if (detail.issue.status !== 'closed' && detail.needsAnswer) c.missing.push('An office response is still needed for the recorded site updates.');
      if (!detail.issue.assignee) c.missing.push('Responsible person is not assigned.');
      const history=c.sources.map(s=>s.text).join(' ');
      if (/\b(hold|stop)\b/i.test(history) && /\b(proceed|resume|start)\b/i.test(history)) c.conflicts.push('The history contains hold and proceed wording. Confirm the applicable instruction with the responsible person.');

    } else {

    const tokens=question.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t=>!['what','which','when','where','why','how','does','have','with','about','this','that','the','and','for','are','can','you','please','project','show','tell','recorded','records','still','has','been'].includes(t)) || [];
    const statusWords=['pending','open','waiting','blocked','next','latest','status','delayed','complete','completed'];
    const subjects=tokens.filter(t=>!statusWords.includes(t));
    const statusIntent=tokens.some(t=>statusWords.includes(t));
    const candidates=[...svc.threads().filter(t=>t.projectId===p.id).flatMap(t=>svc.messages(t.id).map(m=>({type:'message',id:m.id}))),
      ...svc.materials({projectId:p.id}).map(m=>({type:'material',id:m.id})),
      ...svc.tasks({projectId:p.id}).map(t=>({type:'task',id:t.id})),...svc.issues({projectId:p.id}).map(i=>({type:'issue',id:i.id})),{type:'project',id:p.id}];
    const subjectMatch=text=>subjects.some(token=>text.toLowerCase().includes(token));
    const statusMatch=text=>/pending|open|waiting|blocked|delayed/i.test(text);
    // ponytail: lexical retrieval over small local fixtures; use ranked semantic retrieval with a real provider.
    c.sources=candidates.map(s=>svc.assistSource(s)).filter(Boolean).map(s=>s.type==='project'&&subjects.length?
      {...s,text:s.text.split('\n').filter(subjectMatch).join('\n')}:s)
      .filter(s=>s.text && (subjects.length?subjectMatch(s.text):statusIntent&&statusMatch(s.text)))
      .map(s=>({s,score:subjects.filter(t=>s.text.toLowerCase().includes(t)).length*10+(statusIntent&&statusMatch(s.text)?1:0)}))
      .sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.s);
    if (!c.sources.length) c.missing.push('No matching recorded evidence is available for this question.');
    else c.missing.push('Only matching recorded facts are shown. Silence in the records does not prove work is complete.');
    if (/\b(why|how)\b/i.test(question) && !c.sources.some(s=>/\b(because|due to|caused by|reason:)\b/i.test(s.text))) c.missing.push('No recorded reason found. The matching facts do not establish a cause.');
    const joined=c.sources.map(s=>s.text).join(' ');
    if (/\b(hold|stop)\b/i.test(joined)&&/\b(proceed|resume|start)\b/i.test(joined)) c.conflicts.push('Sources include both hold and proceed wording. Confirm which instruction applies; this prototype cannot resolve authority.');
    }
  } else if (kind==='compare') {
    const ids=[...new Set(options.materialIds || [])], p=svc.project(options.projectId);
    if (!p || ids.length<2 || ids.length>3) throw new Error('Choose two or three recorded materials from one accessible project.');
    c.title='Material comparison';c.comparisons=[];
    for (const id of ids) {
      const source=add({type:'material',id}), m=svc.materials({projectId:p.id}).find(m=>m.id===id);
      if (!source || !m) throw new Error('A selected material is unavailable for this project.');
      c.comparisons.push({id,name:m.name,vendor:m.vendor || 'Not recorded',status:m.status,price:'Not recorded',leadTime:'Not recorded'});
    }
    c.missing.push('Selected records may describe different applications, not interchangeable alternatives. Price, lead time, performance and installation suitability are not recorded. Confirm with the supplier; no option is automatically recommended.');
  } else if (kind==='concept') {
    const source=add({type:'message',id:options.messageId}), m=source&&accessibleMessage(source.id);
    if (!m || !(m.photo || m.album)) throw new Error('Select a permitted photo update for finish context.');
    c.title='Finish palette examples';
    c.concepts=[{name:'Soft coastal',colors:['#F5EEDD','#84B3CE','#16587B'],note:'Example pairing: merino cream, rock blue, venice blue.'},
      {name:'Quiet contrast',colors:['#E9EEF1','#8FA3AF','#243B4A'],note:'Example pairing: light neutral, cool grey, deep slate blue.'}];
    c.missing.push('Original image unavailable. These are generic palette examples, not image analysis, generated renders, material approval or dimensional proof.');
  }
  return c;
}
AIProvider.contextAssist = async function (context) {
  const c=clone(context);
  return {...c,label:'AI suggestion · demo',text:c.kind==='concept'?c.concepts.map(x=>x.name+': '+x.note).join('\n'):
    c.kind==='compare'?c.comparisons.map(x=>`${x.name} · ${x.vendor} · ${x.status}\nPrice: ${x.price}. Lead time: ${x.leadTime}.`).join('\n\n'):
    c.kind==='followup'?c.proposal.title:
    c.issueBrief?c.title+'\n\nRecorded status: '+c.issueBrief.status+'\nLatest site update (excerpt): '+c.issueBrief.update+'\nLatest office answer (excerpt): '+c.issueBrief.answer:
    c.sources.length?c.title+'\n\n'+c.sources.map(s=>'• '+(c.kind==='daily' ? (s.type==='message'?'Reported update (not a completion confirmation): ':'Recorded '+s.type+': ') : '')+s.text).join('\n'):'No supported answer or report facts are available yet.'};
};
svc.aiAssist = async function (kind, options) {
  const identity=state.userId+':'+effectiveRole(), context=assistContext(kind,options), before=JSON.stringify(context), result=await AIProvider.contextAssist(context);
  if (state.userId+':'+effectiveRole()!==identity || JSON.stringify(assistContext(kind,options))!==before) throw new Error('The source or your access changed. Generate a fresh draft.');
  return result;
};
svc.confirmFollowup = function ({messageId,title,owner,due,reviewedSource}) {
  const c=assistContext('followup',{messageId}), text=String(title || '').trim();
  if (!text || text.length>200 || !c.proposal.owners.some(u=>u.id===owner) || !assistDate(due)) throw new Error('Confirm a title, eligible owner and valid needed-by date.');
  const source=c.sources[0];
  if (!reviewedSource || ['type','id','threadId','projectId','text'].some(key=>source[key]!==reviewedSource[key])) throw new Error('The reviewed source changed or is unavailable. Generate a fresh draft.');
  const existing=state.db.TASKS.find(t=>t.followupSourceId===messageId);
  if (existing) return existing;
  const tasks=clone(state.db.TASKS), audit=clone(state.db.AUDIT);
  const task={id:uid(),projectId:source.projectId,title:text,owner,due,status:'open',followupSourceId:messageId,msgId:messageId,from:state.userId,createdBy:state.userId};
  state.db.TASKS.push(task);this.log('Follow-up confirmed · '+text,'Task '+task.id);
  if (!persist()) {state.db.TASKS=tasks;state.db.AUDIT=audit;throw new Error('Could not save the follow-up. Your draft can be retried.');}
  return task;
};
svc.sendAssist = async function (kind,options,text,reviewedSources) {
  if (!['daily','client'].includes(kind)) throw new Error('This suggestion is not a sendable report.');
  const c=assistContext(kind,options), body=String(text || '').trim();
  if (!body || body.length>12000 || !Array.isArray(reviewedSources) || !reviewedSources.length) throw new Error('Review a sourced draft and enter the message before sending.');
  for (const source of reviewedSources) {
    const current=this.assistSource(source);
    if (!current || current.text!==source.text || !c.sources.some(s=>s.type===source.type&&s.id===source.id)) throw new Error('A reviewed source changed or is unavailable. Generate a fresh draft.');
  }
  if (!state.online || !this.thread(c.destinationThreadId)) throw new Error('Connect and verify the destination before sending.');
  return this.addMessage(c.destinationThreadId,{text:body,assistDraft:{kind,sourceIds:reviewedSources.map(s=>s.type+':'+s.id)}});
};
