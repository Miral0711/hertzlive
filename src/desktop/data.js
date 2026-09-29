import { state, clone } from "../shared/core.js";
import { P, days } from "./helpers.js";
// ---------- Desktop studio: focused work with contextual conversation ----------
// Shared layer (data.js, data2.js, core.js, filing.js) is read-only here. Extra seeds live below.
export const PERSONAS = [
  ["u1", "Harshal Patel · Partner"],
  ["u5", "Priya Shah · Designer"],
  ["u10", "Rohan Gandhi · Site manager"],
  ["u12", "Bhavna Rao · HR"],
  ["c1", "Anjali Jagwani · Client"],
  ["x1", "Om Civil Works · Contractor"],
];
export const FINISHES = [
  {
    id: "fn1",
    projectId: "p1",
    room: "Kitchen",
    item: "Counter",
    spec: "Dekton Laurent 20 mm",
    vendorId: "v5",
    status: "Ordered",
    cost: 285000,
  },
  {
    id: "fn2",
    projectId: "p1",
    room: "Kitchen",
    item: "Shutters",
    spec: "Handle-less, matte laminate, BWP ply",
    vendorId: "v3",
    status: "Sample",
    cost: 410000,
  },
  {
    id: "fn3",
    projectId: "p1",
    room: "Kitchen",
    item: "Island top",
    spec: "Terrazzo, brass inlay",
    vendorId: "v5",
    status: "Selected",
    cost: 96000,
  },
  {
    id: "fn4",
    projectId: "p1",
    room: "Living",
    item: "Flooring",
    spec: "Kota stone, leather finish 600×600",
    vendorId: "v5",
    status: "Sample",
    cost: 520000,
  },
  {
    id: "fn5",
    projectId: "p1",
    room: "Master bedroom",
    item: "Wardrobe",
    spec: "Veneer, walnut, PU matte",
    vendorId: "v3",
    status: "Selected",
    cost: 380000,
  },
  {
    id: "fn6",
    projectId: "p1",
    room: "Bathroom",
    item: "Sanitaryware",
    spec: "Kohler, matte black",
    vendorId: null,
    status: "Installed",
    cost: 240000,
  },
  {
    id: "fn7",
    projectId: "p2",
    room: "Reception",
    item: "Ceiling",
    spec: "Acoustic baffles, 600 c/c",
    vendorId: "v3",
    status: "Ordered",
    cost: 610000,
  },
];
export const SELECTIONS = [
  {
    id: "sl1",
    projectId: "p1",
    item: "Kitchen counter",
    options: ["Dekton Laurent", "Dekton Kelya"],
    chosen: "Dekton Laurent",
    clientStatus: "approved",
    po: {
      no: "PO-2401-07",
      vendorId: "v5",
      amount: 285000,
      status: "ordered",
      eta: "2026-09-28",
    },
  },
  {
    id: "sl2",
    projectId: "p1",
    item: "Living floor",
    options: ["Kota leather", "Jaisalmer honed"],
    chosen: null,
    clientStatus: "pending",
    po: null,
  },
  {
    id: "sl3",
    projectId: "p1",
    item: "Wardrobe veneer",
    options: ["Walnut", "Teak", "Oak"],
    chosen: "Walnut",
    clientStatus: "approved",
    po: {
      no: "PO-2401-08",
      vendorId: "v3",
      amount: 380000,
      status: "draft",
      eta: null,
    },
  },
  {
    id: "sl4",
    projectId: "p2",
    item: "Reception baffles",
    options: ["Oak veneer", "Fabric wrapped"],
    chosen: "Oak veneer",
    clientStatus: "approved",
    po: {
      no: "PO-2402-03",
      vendorId: "v3",
      amount: 610000,
      status: "delivered",
      eta: "2026-09-04",
    },
  },
];
export const SAMPLES = [
  {
    id: "sm1",
    name: "Dekton Laurent",
    material: "Sintered stone",
    vendorId: "v5",
    shelf: "A2",
    projectIds: ["p1"],
    hue: 30,
    seed: 61,
    out: "Client, Jagwani",
  },
  {
    id: "sm2",
    name: "Kota leather 600×600",
    material: "Natural stone",
    vendorId: "v5",
    shelf: "A4",
    projectIds: ["p1"],
    hue: 90,
    seed: 62,
    out: null,
  },
  {
    id: "sm3",
    name: "Walnut veneer, PU matte",
    material: "Veneer",
    vendorId: "v3",
    shelf: "B1",
    projectIds: ["p1"],
    hue: 20,
    seed: 63,
    out: null,
  },
  {
    id: "sm4",
    name: "Oak baffle 100×40",
    material: "Timber",
    vendorId: "v3",
    shelf: "B3",
    projectIds: ["p2"],
    hue: 40,
    seed: 64,
    out: "Site, Sanghvi",
  },
  {
    id: "sm5",
    name: "Terrazzo, white chips",
    material: "Terrazzo",
    vendorId: "v5",
    shelf: "A1",
    projectIds: ["p1", "p3"],
    hue: 200,
    seed: 65,
    out: null,
  },
];
export const CHECKLISTS = [
  {
    id: "ck1",
    siteId: "s1",
    stage: "Before slab 2 pour",
    due: "2026-09-17",
    items: [
      ["Shuttering level checked", true, "u10"],
      ["Rebar cover blocks in place", true, "u10"],
      ["Column C4 rebar as per S-301 R1", false, null],
      ["Electrical conduits laid", false, null],
      ["Props re-tightened at C3", true, "x1"],
    ],
  },
  {
    id: "ck2",
    siteId: "s1",
    stage: "Before plaster, first floor",
    due: "2026-10-05",
    items: [
      ["Chasing done for all points", false, null],
      ["Window frames fixed and plumb", false, null],
      ["Waterproofing at toilets tested 48 h", false, null],
    ],
  },
  {
    id: "ck3",
    siteId: "s2",
    stage: "Before ceiling close",
    due: "2026-09-20",
    items: [
      ["AC ducts pressure tested", true, "u11"],
      ["E5 duct clash resolved", false, null],
      ["Sprinkler drops marked", true, "u11"],
    ],
  },
];
export const PROPOSALS = [
  {
    id: "pr1",
    client: "Mehta family",
    kind: "Residential · Bungalow",
    area: "6,200 sq ft",
    fee: 2100000,
    basis: "3.2% of estimated cost",
    status: "sent",
    at: "2026-09-02",
    owner: "u1",
  },
  {
    id: "pr2",
    client: "Trivedi Textiles",
    kind: "Commercial · Showroom",
    area: "3,000 sq ft",
    fee: 780000,
    basis: "Lump sum by stage",
    status: "draft",
    at: "2026-09-08",
    owner: "u2",
  },
  {
    id: "pr3",
    client: "Curators Hospitality",
    kind: "Commercial · Office",
    area: "12,000 sq ft",
    fee: 2650000,
    basis: "2.8% of estimated cost",
    status: "won",
    at: "2026-01-15",
    owner: "u2",
  },
  {
    id: "pr4",
    client: "Patel Hospitality",
    kind: "Hospitality · Café",
    area: "1,800 sq ft",
    fee: 520000,
    basis: "Lump sum",
    status: "lost",
    at: "2026-07-20",
    owner: "u3",
  },
];
export const RESOURCE = [
  {
    userId: "u5",
    weeks: [
      { p1: 30, p2: 10 },
      { p1: 32, p2: 8 },
      { p1: 20, p3: 16 },
      { p1: 24 },
    ],
  },
  {
    userId: "u6",
    weeks: [{ p1: 24, p3: 16 }, { p1: 40, p3: 8 }, { p3: 32 }, { p3: 24 }],
  },
  { userId: "u7", weeks: [{ p2: 40 }, { p2: 40 }, { p2: 36 }, { p2: 20 }] },
  { userId: "u8", weeks: [{ p1: 16, p4: 16 }, { p1: 24 }, { p1: 8 }, {}] },
  {
    userId: "u9",
    weeks: [{ p1: 36 }, { p1: 36 }, { p1: 40, p2: 8 }, { p1: 32 }],
  },
];
export const INVOICE_MS = {};
export function msFor(i) {
  const ms = P(i.projectId).milestones || [];
  if (!ms.length) return null;
  if (INVOICE_MS[i.id]) return ms.find((m) => m.id === INVOICE_MS[i.id]);
  return ms.reduce((best, m) =>
    Math.abs(days(m.date, i.issued)) < Math.abs(days(best.date, i.issued))
      ? m
      : best,
  );
}
export const TEMPLATES = [
  {
    kind: "Project",
    name: "Residential villa",
    desc: "5 phases, 14 milestones, 32 standard drawings, client-visible defaults set",
    items: 46,
  },
  {
    kind: "Project",
    name: "Commercial office fit-out",
    desc: "4 phases, 9 milestones, 21 drawings, MEP coordination tasks",
    items: 34,
  },
  {
    kind: "Checklist",
    name: "Before slab pour",
    desc: "12 checks, photo required on 4",
    items: 12,
  },
  {
    kind: "Checklist",
    name: "Before handover",
    desc: "28 checks by room, snag walk",
    items: 28,
  },
  {
    kind: "Message",
    name: "Weekly client update",
    desc: "Progress, decisions taken, what we need from you, next visit",
    items: 4,
  },
  {
    kind: "Message",
    name: "Drawing issued to site",
    desc: "Drawing number, revision, what changed, supersedes",
    items: 4,
  },
  {
    kind: "Document",
    name: "Fee proposal",
    desc: "Scope, stages, fee basis, exclusions, terms",
    items: 6,
  },
];
export const REMINDERS = [
  {
    id: "rm1",
    text: "Chase the overdue invoice with Jagwanis",
    when: "2026-09-10T10:00",
    who: "u1",
    ref: "#/money",
  },
  {
    id: "rm2",
    text: "Reply to RFI-07 lintel level",
    when: "2026-09-10T09:30",
    who: "u5",
    ref: "#/projects/p1?tab=changes",
  },
  {
    id: "rm3",
    text: "Order 80 bags cement before 12 Sep",
    when: "2026-09-11T09:00",
    who: "u10",
    ref: "#/sites/s1?tab=deliveries",
  },
  {
    id: "rm4",
    text: "Follow up: Kota vs Jaisalmer decision from client",
    when: "2026-09-12T11:00",
    who: "u5",
    ref: "#/samples",
  },
];
export const DAILYLOG = [
  {
    siteId: "s1",
    date: "2026-09-09",
    weather: "Clear, 33°C",
    labour: { Civil: 14, Electrical: 3, Plumbing: 0 },
    equipment: ["Mixer", "Vibrator ×2", "Bar bender"],
    delays: "None",
    by: "u10",
  },
  {
    siteId: "s1",
    date: "2026-09-08",
    weather: "Light rain 14:00 to 15:30, 29°C",
    labour: { Civil: 16, Electrical: 2, Plumbing: 0 },
    equipment: ["Mixer", "Vibrator ×2"],
    delays: "Rain stopped shuttering for 90 min",
    by: "u10",
  },
  {
    siteId: "s1",
    date: "2026-09-07",
    weather: "Overcast, 30°C",
    labour: { Civil: 12, Electrical: 0, Plumbing: 2 },
    equipment: ["Mixer"],
    delays: "TMT short by 0.2 t, bar bending paused",
    by: "u10",
  },
  {
    siteId: "s2",
    date: "2026-09-09",
    weather: "Clear, 34°C",
    labour: { Joinery: 6, HVAC: 4 },
    equipment: ["Scissor lift"],
    delays: "E5 duct clash, ceiling grid at E5 on hold",
    by: "u11",
  },
];
export const ANNOUNCEMENTS = [
  {
    id: "an1",
    by: "u1",
    at: "2026-09-08T18:00",
    text: "Studio closed Monday 14 Sep for Ganesh Visarjan. Site teams on as usual.",
    pinned: true,
  },
  {
    id: "an2",
    by: "u12",
    at: "2026-09-05T11:00",
    text: "Expense claims for August close on 12 Sep. Attach bills as photos in your DM to HR.",
    pinned: false,
  },
];
export const DM_THREADS = [
  {
    id: "d1",
    kind: "dm",
    name: "Priya Shah",
    memberIds: ["u5", "u1"],
    projectId: null,
  },
  {
    id: "d2",
    kind: "group",
    name: "Slab 2 pour crew",
    memberIds: ["u10", "u8", "u6", "u1"],
    projectId: "p1",
  },
  {
    id: "d3",
    kind: "dm",
    name: "Bhavna Rao",
    memberIds: ["u12", "u10", "u1", "u5"],
    projectId: null,
  },
];
export const DM_MESSAGES = [
  {
    id: "dm1",
    threadId: "d1",
    by: "u1",
    at: "2026-09-09T09:12",
    text: "Can you bring the Dekton sample to the 11:00 review? Jagwanis may join on call.",
  },
  {
    id: "dm2",
    threadId: "d1",
    by: "u5",
    at: "2026-09-09T09:15",
    text: "Yes. Also drawing I-201 R3 draft is ready, handle-less shutters as agreed.",
  },
  {
    id: "dm3",
    threadId: "d2",
    by: "u10",
    at: "2026-09-09T08:30",
    text: "Pour still on for 18 Sep. Cement 40 bags on site, ordering 80 more today.",
  },
  {
    id: "dm4",
    threadId: "d2",
    by: "u8",
    at: "2026-09-09T08:41",
    text: "C4 rebar check tomorrow 10:00. Bring S-301 R1 print.",
  },
  {
    id: "dm5",
    threadId: "d3",
    by: "u10",
    at: "2026-09-08T17:20",
    text: "Cab bill for VMC trip, ₹1,240. Receipt attached.",
  },
];
export const DEFERRED = [
  "Contractor RA bills and measurement book",
  "BOQ and tender comparison",
  "Statutory approvals tracker",
  "Consultant role",
  "Smaller items: read receipts, message edit, scheduled send",
];
export const STAGE_TEMPLATE = TEMPLATES[0];

export function seedDesk() {
  DM_THREADS.forEach((t) => {
    if (!state.db.THREADS.find((x) => x.id === t.id))
      state.db.THREADS.push(clone(t));
  });
  DM_MESSAGES.forEach((m) => {
    if (!state.db.MESSAGES.find((x) => x.id === m.id))
      state.db.MESSAGES.push(clone(m));
  });
  state.desk = state.desk || {
    thread: null,
    hi: null,
    chatList: true,
    chatHidden: true,
    markup: [],
    fileView: "list",
  };
  state.desk.shares = state.desk.shares || clone(SHARES_SEED);
  state.desk.checklists = state.desk.checklists || clone(CHECKLISTS);
  state.desk.selections = state.desk.selections || clone(SELECTIONS);
  state.desk.reminders = state.desk.reminders || clone(REMINDERS);
}

export const SHARES_SEED = [
  {
    id: "sh1",
    path: "Projects/HA-2401 Jagwani Residence/02 DD/HA-2401-I-201_R2.pdf",
    by: "u5",
    to: "Anjali Jagwani",
    at: "2026-09-10T11:20",
    expires: "2026-09-17",
  },
];
