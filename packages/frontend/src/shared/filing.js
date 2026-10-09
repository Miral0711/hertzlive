import { state, persist, svc, AIProvider, toast, render, effectiveRole } from "./core.js";
// ---------- AI filing: auto-organise what is shared in chat ----------
// Every message gets a filing record: { msgId, projectId, room, kind, drawing, vendor, conf, status, by }
// status: filing | filed | check | ask.  by: ai | user.  Shared by phone and desktop builds.
export const FILE_KINDS = { photo: "Photo", drawing: "Drawing", decision: "Decision", issue: "Issue", sample: "Sample", link: "Reference", receipt: "Receipt", delivery: "Delivery", spec: "Spec", note: "Note" };
export const ROOM_WORDS = [["kitchen", "Kitchen"], ["living", "Living"], ["master|bedroom", "Master bedroom"], ["bath|toilet", "Bathroom"], ["terrace|roof", "Terrace"], ["reception|lobby", "Reception"], ["facade|elevation|front", "Facade"], ["slab|column|rebar|shutter|footing|lintel|site", "Structure"], ["pantry", "Pantry"], ["false ceiling|ceiling|grid|diffuser", "Ceiling"], ["chajja|chhajja", "Chajja"], ["\\bodu\\b|outdoor unit", "AC outdoor"], ["\\bcq\\b|counter", "Counter"], ["lineout|line out|marking", "Lineouts"]];
// "Mr. Zain Nizami_Kitchen civil layout_07.09.26 Model.pdf" -> { room, kind, date, label }. Pattern seen in both WhatsApp exports.
export function parseDrawingName(name) {
  const parts = String(name || "").replace(/\.(pdf|dwg)$/i, "").split("_");
  if (parts.length < 2) return null;
  const dm = parts[parts.length - 1].match(/(\d{2})\.(\d{2})\.(\d{2})/);
  const words = parts[parts.length - 2].trim().split(/\s+/);
  const room = words[0][0].toUpperCase() + words[0].slice(1).toLowerCase();
  const kind = words.slice(1).join(" ").toLowerCase() || "drawing";
  return { room, kind, date: dm ? `20${dm[3]}-${dm[2]}-${dm[1]}` : null, label: `${room} ${kind}` };
}
// Language of one message, per message not per user: 0 English, 1 Hindi script, 2 Gujarati script, 3 Hinglish, 4 Gujlish. -1 = cannot tell (photo, name, number).
// ponytail: script by Unicode block, Latin by a short romanised word list scored per word (CMI-style); a real langid model replaces this behind the same seam.
export const ROMAN_HI = /\b(hai|hain|nahi|nahin|kya|kyu|kyun|karo|kar|kiya|karna|hoga|gaya|gayi|raha|rahi|abhi|aaj|kal|bhai|bhejo|dekho|theek|thik|chahiye|wala|wali|mein|ko|se|ka|ki|ke|aur|par|toh|bhi|ho|hua)\b/g;
export const ROMAN_GU = /\b(chhe|che|nathi|nath|karo|karyu|karvu|thai|thayu|thashe|aave|aavo|tame|ame|mane|tamne|kem|su|shu|ane|pan|maate|mate|ma|ni|nu|no|na|joi|joie|jovu|ahin|ahiya|thoda|thodu|badhu|saru|kharab|hato|hati|hatu)\b/g;
export function detectLang(text) {
  const t = String(text || "").trim();
  if (!t) return -1;
  if (/[\u0A80-\u0AFF]/.test(t)) return 2;
  if (/[\u0900-\u097F]/.test(t)) return 1;
  const words = (t.toLowerCase().match(/[a-z]+/g) || []);
  if (words.length < 2) return -1;
  const hi = (t.toLowerCase().match(ROMAN_HI) || []).length, gu = (t.toLowerCase().match(ROMAN_GU) || []).length;
  if (!hi && !gu) return 0;
  return gu > hi ? 4 : 3;
}
export const filingRules = {}; // "senderId|threadId" -> projectId, learned from corrections
state.filings = state.filings || {};

export function classifySync(m, thread) {
  const t = (m.text || "") + " " + (m.transcript || "") + " " + (m.link?.title || "");
  const low = t.toLowerCase();
  let kind = "note";
  if (m.voice) kind = "note";
  if (m.photo) kind = "photo";
  if (m.link) kind = "link";
  if (m.decision || /^decision:/i.test(t)) kind = "decision";
  if (m.sample || /sample|swatch|veneer|laminate|tile/.test(low)) kind = "sample";
  if (/deliver|received|reached site|truck|grn/.test(low)) kind = "delivery";
  if (/bill|invoice|receipt|paid|₹/.test(low) && !m.link) kind = "receipt";
  if (/short|crack|leak|mismatch|not match|blocked|stuck|wrong|urgent|issue|problem/.test(low)) kind = "issue";
  if (/r\d\b|drawing|a-\d{3}|i-\d{3}|s-\d{3}|revision/.test(low) && kind === "note") kind = "drawing";
  // Hinglish / Gujarati / site shorthand seen in real groups
  if (/bulge|hatao|galat|tut ?gaya|nathi|kharab|inch error|level off|off level|leak thai/.test(low)) kind = "issue";
  if (!m.photo && !m.link && (t.match(/^\s*\d+[.)]\s/gm) || []).length >= 3) kind = "spec";
  let room = (ROOM_WORDS.find(([re]) => new RegExp(re).test(low)) || [null, null])[1];
  let drawing = (t.match(/\b(?:HA-\d{4}-)?[AIS]-\d{3}(?:\s?R\d)?/i) || [null])[0];
  let rev = null;
  const fd = m.file && parseDrawingName(m.file.name);
  if (fd) {
    kind = "drawing"; room = fd.room; drawing = null;
    const earlier = state.db.MESSAGES.filter((x) => x.file && x.threadId === m.threadId && x.at < m.at && parseDrawingName(x.file.name)?.label === fd.label);
    rev = earlier.length + 1;
    earlier.forEach((x) => { if (state.filings[x.id]) state.filings[x.id].superseded = true; });
  }
  const rule = filingRules[m.by + "|" + m.threadId];
  let projectId = thread?.projectId || rule || null;
  let conf = thread?.projectId ? 0.9 : rule ? 0.75 : 0.35;
  if (!thread?.projectId) {
    const hit = state.db.PROJECTS.find((p) => low.includes(p.name.split(" ")[0].toLowerCase()));
    if (hit) { projectId = hit.id; conf = 0.85; }
  }
  if (kind === "note" && !room) conf -= 0.15;
  // wrong-group guard: text names another project while thread is pinned to one
  let wrong = null;
  if (thread?.projectId) {
    const other = state.db.PROJECTS.find((p) => p.id !== thread.projectId && low.includes(p.name.split(" ")[0].toLowerCase()));
    if (other) { wrong = other.id; conf = 0.5; }
  }
  return { msgId: m.id, projectId, room, kind, drawing, rev, wrong, conf: Math.round(conf * 100) / 100 };
}
export const filingStatus = (f) => (f.conf >= 0.8 ? "filed" : f.conf >= 0.5 ? "check" : "ask");
AIProvider.classify = async function (m, thread) {
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 900)); // free model queue, off the hot path
  const f = classifySync(m, thread);
  return { ...f, status: filingStatus(f), by: "ai" };
};
export function seedFilings() {
  state.db.MESSAGES.forEach((m) => {
    if (state.filings[m.id]) return;
    const f = classifySync(m, state.db.THREADS.find((t) => t.id === m.threadId));
    state.filings[m.id] = { ...f, status: filingStatus(f), by: "ai" };
  });
}
export function filingLabel(f) {
  if (!f) return "";
  const p = f.projectId && state.db.PROJECTS.find((x) => x.id === f.projectId);
  const ord = (n) => n + (["th", "st", "nd", "rd"][n % 10 < 4 && (n < 10 || n > 20) ? n % 10 : 0]);
  return [p ? p.name.split(" ")[0] : null, f.room, FILE_KINDS[f.kind], f.drawing, f.rev > 1 ? ord(f.rev) + " revision" : null, f.superseded ? "superseded" : null].filter(Boolean).join(" · ");
}
svc.recordChatDecision = function (message, option) {
  if (!message || message.deleted || !option) return null;
  message.decision = option;
  message.options = [];
  let id;
  try { id = this.addMessage(message.threadId, { text: `Decision: ${option}`, decision: true }); }
  catch (_) { return null; }
  seedFilings();
  toast("Decision recorded.");
  render();
  return id;
};
svc.decideBill = function (message, ok) {
  if (effectiveRole() !== "partner" || !message?.bill) return false;
  if (ok) {
    message.bill.status = "approved";
    message.bill.decidedAt = new Date().toISOString();
    message.bill.by = state.userId;
    this.log("Approved expense ₹" + message.bill.amount, "Message " + message.id);
    if (!persist()) return false;
    toast("Approved. Reimburse with salary.");
  } else {
    message.bill.status = "query";
    try { this.addMessage(message.threadId, { text: "Send the bill photo please, then I approve." }); }
    catch (_) { return false; }
    toast("Asked for the bill.");
  }
  render();
  return true;
};
svc.approveChatMessage = function (message) {
  if (!message?.approval || message.approval.done || effectiveRole() !== "client") return false;
  message.approval.done = true;
  message.approval.doneAt = new Date().toISOString().slice(0, 16);
  this.log("Approved in chat · " + message.approval.label, "Message " + message.id);
  try { this.addMessage(message.threadId, { text: `Approved: ${message.approval.label}` }); }
  catch (_) { return false; }
  seedFilings();
  toast("Approved. The studio has been told.");
  render();
  return true;
};
svc.fileMessage = function (msgId, patch) {
  const m = state.db.MESSAGES.find((x) => x.id === msgId);
  if (!m) return null;
  const previous = state.filings[msgId];
  const ruleKey = m.by + "|" + m.threadId;
  const previousRule = filingRules[ruleKey];
  const wasFiled = m.filed;
  const previousBoard = state.db.MOODBOARD.map((item) => ({ ...item }));
  const auditLength = state.db.AUDIT.length;
  const f = { ...(previous || classifySync(m, this.thread(m.threadId))) };
  Object.assign(f, patch, { status: "filed", by: "user", conf: 1 });
  state.filings[msgId] = f;
  if (patch.projectId) filingRules[ruleKey] = patch.projectId;
  if (f.kind === "link" && m.link) this.fileToMoodboard(msgId, false);
  this.log("Filing corrected · " + filingLabel(f), "Message " + msgId);
  if (!persist()) {
    if (previous) state.filings[msgId] = previous;
    else delete state.filings[msgId];
    if (previousRule === undefined) delete filingRules[ruleKey];
    else filingRules[ruleKey] = previousRule;
    m.filed = wasFiled;
    state.db.MOODBOARD.splice(0, state.db.MOODBOARD.length, ...previousBoard);
    state.db.AUDIT.splice(0, state.db.AUDIT.length - auditLength);
    return null;
  }
  return f;
};
svc.filed = function (f = {}) {
  return Object.values(state.filings).filter((x) => x.status !== "ask" && (!f.projectId || x.projectId === f.projectId) && (!f.kind || x.kind === f.kind)).map((x) => ({ ...x, msg: state.db.MESSAGES.find((m) => m.id === x.msgId) })).filter((x) => x.msg);
};
