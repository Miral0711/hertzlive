import { USERS, PROJECTS, SITES, THREADS, MESSAGES } from './data.js';
// ---------- Feature seeds: timesheets, transmittals, RFIs, changes, invoices, meetings, vendors, headcount, GRN, docs, signatures, photo spots, import fixture ----------
export const HOURLY = { partner: 1800, designer: 900, site_manager: 700, hr: 600 };
export const TIMESHEETS = [
  { id: "ts1", userId: "u5", date: "2026-09-08", projectId: "p1", hours: 5 },
  { id: "ts2", userId: "u5", date: "2026-09-08", projectId: "p2", hours: 3 },
  { id: "ts3", userId: "u6", date: "2026-09-08", projectId: "p1", hours: 6 },
  { id: "ts4", userId: "u6", date: "2026-09-08", projectId: "p3", hours: 2 },
  { id: "ts5", userId: "u7", date: "2026-09-08", projectId: "p2", hours: 8 },
  { id: "ts6", userId: "u9", date: "2026-09-08", projectId: "p1", hours: 7 },
  { id: "ts7", userId: "u5", date: "2026-09-07", projectId: "p1", hours: 8 },
  { id: "ts8", userId: "u6", date: "2026-09-07", projectId: "p3", hours: 8 },
  { id: "ts9", userId: "u8", date: "2026-09-07", projectId: "p1", hours: 4 },
  { id: "ts10", userId: "u8", date: "2026-09-07", projectId: "p4", hours: 4 },
  { id: "ts11", userId: "u10", date: "2026-09-08", projectId: "p1", hours: 8 },
  { id: "ts12", userId: "u1", date: "2026-09-08", projectId: "p1", hours: 2 },
  { id: "ts13", userId: "u1", date: "2026-09-08", projectId: "p2", hours: 3 },
];
export const TRANSMITTALS = [
  { id: "tr1", projectId: "p1", no: "HA-2401-A-101", rev: "R3", to: "x1", at: "2026-08-14T11:20", by: "u6" },
  { id: "tr2", projectId: "p1", no: "HA-2401-A-101", rev: "R4", to: "x1", at: "2026-08-28T16:05", by: "u6" },
  { id: "tr3", projectId: "p1", no: "HA-2401-A-102", rev: "R3", to: "x1", at: "2026-08-21T10:12", by: "u6" },
  { id: "tr4", projectId: "p1", no: "HA-2401-S-301", rev: "R1", to: "x1", at: "2026-09-01T09:40", by: "u8" },
  { id: "tr5", projectId: "p1", no: "HA-2401-A-101", rev: "R4", to: "x2", at: "2026-08-29T09:00", by: "u6" },
];
export const RFIS = [
  { id: "r1", projectId: "p1", no: "RFI-07", title: "Lintel level at kitchen north window after column shift", from: "u10", at: "2026-09-08T09:10", due: "2026-09-10", status: "open", answer: "" },
  { id: "r2", projectId: "p1", no: "RFI-06", title: "Bar bending schedule for slab 2 cantilever", from: "x1", at: "2026-09-02T14:30", due: "2026-09-04", status: "answered", answer: "Use BBS sheet S-301 R1 table 4. Cantilever bars 12 dia at 150 c/c.", by: "u8" },
  { id: "r3", projectId: "p2", no: "RFI-03", title: "Ceiling grid offset from AC diffuser line", from: "u11", at: "2026-09-05T11:00", due: "2026-09-09", status: "open", answer: "" },
];
export const CHANGES = [
  { id: "co1", projectId: "p1", no: "CO-03", title: "Kitchen window narrowed to 1,050 mm and lintel re-detail", cost: 42000, days: 2, head: "Civil & structure", reason: "Column shifted on site; opening reduced to keep structure", status: "awaiting_client", at: "2026-09-08T17:30", by: "u5" },
  { id: "co2", projectId: "p1", no: "CO-02", title: "Upgrade kitchen counter to Dekton", cost: 185000, days: 0, head: "Interiors & joinery", reason: "Client request after sample review", status: "approved", at: "2026-08-20T12:00", by: "u5", signedAt: "2026-08-21T10:14" },
  { id: "co3", projectId: "p2", no: "CO-01", title: "Add two extra meeting pods on level 2", cost: 640000, days: 9, head: "Interiors & joinery", reason: "Headcount grew from 60 to 84", status: "draft", at: "2026-09-07T15:00", by: "u7" },
];
export const FEE_STAGES = [
  { phase: 0, name: "Concept", pct: 15 },
  { phase: 1, name: "Design development", pct: 25 },
  { phase: 2, name: "Approvals", pct: 10 },
  { phase: 3, name: "Execution", pct: 40 },
  { phase: 4, name: "Handover", pct: 10 },
];
export const FEES = { p1: 1480000, p2: 2650000, p3: 960000, p4: 720000 };
export const INVOICES = [
  { id: "in1", projectId: "p1", no: "HA/26-27/014", stage: 0, amount: 222000, status: "paid", issued: "2025-12-22", due: "2026-01-06", paid: "2026-01-03" },
  { id: "in2", projectId: "p1", no: "HA/26-27/021", stage: 1, amount: 370000, status: "paid", issued: "2026-03-16", due: "2026-03-31", paid: "2026-04-02" },
  { id: "in3", projectId: "p1", no: "HA/26-27/029", stage: 2, amount: 148000, status: "overdue", issued: "2026-05-05", due: "2026-05-20", paid: null },
  { id: "in4", projectId: "p2", no: "HA/26-27/018", stage: 0, amount: 397500, status: "paid", issued: "2026-02-10", due: "2026-02-25", paid: "2026-02-24" },
  { id: "in5", projectId: "p2", no: "HA/26-27/031", stage: 1, amount: 662500, status: "sent", issued: "2026-09-01", due: "2026-09-16", paid: null },
  { id: "in6", projectId: "p4", no: "HA/26-27/033", stage: 3, amount: 288000, status: "sent", issued: "2026-08-25", due: "2026-09-09", paid: null },
];
export const MEETINGS = [
  {
    id: "mt1", projectId: "p1", kind: "client", title: "Kitchen review with Jagwanis", at: "2026-09-06T11:00", attendees: ["u5", "u1", "c1"], room: "r1",
    notes: "Walked through I-201 R2 joinery. Client prefers handle-less shutters. Island length agreed at 2,400. Dekton counter confirmed. Window issue explained; client fine with 1,050 if light is not lost.",
    actions: [
      { id: "a1", text: "Issue I-201 R3 with handle-less shutters", owner: "u5", due: "2026-09-11", done: false },
      { id: "a2", text: "Share Dekton colour swatches", owner: "u7", due: "2026-09-09", done: true },
      { id: "a3", text: "Confirm daylight study for 1,050 opening", owner: "u6", due: "2026-09-10", done: false },
    ],
    summary: "We reviewed the kitchen joinery together. You chose handle-less shutters and a 2,400 island. Dekton counter is confirmed. Next: revised kitchen drawing by 11 Sep and a daylight check for the narrower window.",
    approved: false,
  },
  {
    id: "mt2", projectId: "p1", kind: "internal", title: "Site coordination · slab 2", at: "2026-09-04T16:00", attendees: ["u10", "u8", "x1"], room: null,
    notes: "Pour planned 18 Sep. Props at C3 to be re-tightened. BBS clarified via RFI-06. Cement stock 40 bags, need 120 by 15 Sep.",
    actions: [
      { id: "a4", text: "Order 80 bags cement", owner: "u10", due: "2026-09-12", done: false },
      { id: "a5", text: "Re-tighten props at C3", owner: "x1", due: "2026-09-08", done: true },
    ],
    summary: "", approved: false, internal: true,
  },
  {
    id: "mt3", projectId: "p2", kind: "client", title: "Office layout sign-off", at: "2026-08-28T15:00", attendees: ["u7", "u2", "c2"], room: "r2",
    notes: "Layout L2 approved. Client asked for two more pods, raised as CO-01.",
    actions: [{ id: "a6", text: "Price two extra pods", owner: "u7", due: "2026-09-05", done: true }],
    summary: "Level 2 layout is approved. Two extra meeting pods are being priced and will come to you as a change order.",
    approved: true, approvedAt: "2026-08-28T18:20",
  },
];
export const VENDORS = [
  { id: "v1", name: "Om Civil Works", kind: "Contractor", trade: "Civil", phone: "+91 98250 11223", rating: 4, userId: "x1", rates: [{ item: "RCC slab (labour)", rate: 380, unit: "sq ft", at: "2026-08-01" }, { item: "Brickwork 9 in", rate: 62, unit: "sq ft", at: "2026-06-12" }], projects: ["p1"] },
  { id: "v2", name: "Sparkline Electricals", kind: "Contractor", trade: "Electrical", phone: "+91 99090 44556", rating: 5, userId: "x2", rates: [{ item: "Point wiring", rate: 1450, unit: "point", at: "2026-07-20" }], projects: ["p1"] },
  { id: "v3", name: "Woodcraft Joinery", kind: "Contractor", trade: "Joinery", phone: "+91 98795 77889", rating: 4, userId: "x3", rates: [{ item: "Modular kitchen (BWP ply, lam)", rate: 1850, unit: "sq ft", at: "2026-08-15" }, { item: "Wardrobe shutter", rate: 1400, unit: "sq ft", at: "2026-05-02" }], projects: ["p1", "p2"] },
  { id: "v4", name: "Shree Cement Depot", kind: "Supplier", trade: "Cement & steel", phone: "+91 98240 33221", rating: 3, rates: [{ item: "OPC 53 grade", rate: 405, unit: "bag", at: "2026-09-01" }, { item: "TMT 12 mm", rate: 61500, unit: "tonne", at: "2026-08-28" }], projects: ["p1", "p2"] },
  { id: "v5", name: "Stonecraft Surfaces", kind: "Supplier", trade: "Stone & Dekton", phone: "+91 97270 66778", rating: 4, rates: [{ item: "Dekton 20 mm", rate: 1150, unit: "sq ft", at: "2026-08-19" }], projects: ["p1"] },
  { id: "v6", name: "Brightline Glass", kind: "Supplier", trade: "Glazing", phone: "+91 98980 12121", rating: 2, rates: [{ item: "DGU 24 mm", rate: 720, unit: "sq ft", at: "2026-03-10" }], projects: ["p2"] },
];
export const HEADCOUNT = [
  { id: "hc1", siteId: "s1", date: "2026-09-09", contractorId: "x1", count: 14, trades: { Mason: 6, Helper: 6, "Bar bender": 2 }, at: "08:10", hue: 28, seed: 21 },
  { id: "hc2", siteId: "s1", date: "2026-09-09", contractorId: "x2", count: 3, trades: { Electrician: 2, Helper: 1 }, at: "08:35", hue: 40, seed: 22 },
  { id: "hc3", siteId: "s1", date: "2026-09-08", contractorId: "x1", count: 16, trades: { Mason: 7, Helper: 7, "Bar bender": 2 }, at: "08:05", hue: 28, seed: 23 },
  { id: "hc4", siteId: "s1", date: "2026-09-08", contractorId: "x2", count: 2, trades: { Electrician: 2 }, at: "08:40", hue: 40, seed: 24 },
  { id: "hc5", siteId: "s2", date: "2026-09-09", contractorId: "x3", count: 6, trades: { Mason: 3, Helper: 3 }, at: "09:02", hue: 200, seed: 25 },
];
export const GRNS = [
  { id: "g1", siteId: "s1", date: "2026-09-09", item: "OPC 53 cement", qty: 40, unit: "bags", vendorId: "v4", by: "u10", status: "received", hue: 28, seed: 31 },
  { id: "g2", siteId: "s1", date: "2026-09-06", item: "TMT 12 mm", qty: 1.8, unit: "tonne", vendorId: "v4", by: "u10", status: "short", note: "Ordered 2 t, received 1.8 t", hue: 28, seed: 32 },
  { id: "g3", siteId: "s2", date: "2026-09-08", item: "Gypsum board 12.5 mm", qty: 60, unit: "sheets", vendorId: "v3", by: "u11", status: "received", hue: 200, seed: 33 },
];
export const DOCS = [
  { id: "d1", projectId: "p1", name: "Design brief questionnaire", kind: "Brief", at: "2025-11-05", by: "c1", clientVisible: true },
  { id: "d2", projectId: "p1", name: "Site survey and levels", kind: "Survey", at: "2025-11-12", by: "u6", clientVisible: true },
  { id: "d3", projectId: "p1", name: "Fee agreement", kind: "Agreement", at: "2025-11-08", by: "u1", clientVisible: true, signed: "2025-11-09T10:22" },
  { id: "d4", projectId: "p1", name: "VMC plan approval letter", kind: "Approval", at: "2026-05-02", by: "u6", clientVisible: true },
  { id: "d5", projectId: "p1", name: "Structural design note (internal)", kind: "Internal", at: "2026-02-14", by: "u8", clientVisible: false },
  { id: "d6", projectId: "p1", name: "Kitchen appliance warranties", kind: "Warranty", at: "2026-09-03", by: "u5", clientVisible: true },
  { id: "d7", projectId: "p2", name: "Design brief questionnaire", kind: "Brief", at: "2026-01-20", by: "c2", clientVisible: true },
  { id: "d8", projectId: "p2", name: "Fee agreement", kind: "Agreement", at: "2026-01-22", by: "u2", clientVisible: true, signed: null },
  { id: "d9", projectId: "p4", name: "HVAC warranty pack", kind: "Warranty", at: "2026-08-30", by: "u6", clientVisible: true },
  { id: "d10", projectId: "p4", name: "As-built set A-100 series", kind: "As-built", at: "2026-09-01", by: "u6", clientVisible: true },
];
export const BRIEFS = {
  p1: { family: "4 adults, 1 child", rooms: "4 bedrooms, study, pooja", style: ["Warm minimal", "Natural stone"], budget: "1.5 to 2 Cr", timeline: "Move in by Feb 2027" },
};
export const SIGNATURES = [
  { id: "sg1", kind: "change", refId: "co2", by: "c1", at: "2026-08-21T10:14", phone: "4412" },
  { id: "sg2", kind: "doc", refId: "d3", by: "c1", at: "2025-11-09T10:22", phone: "4412" },
];
export const SPOTS = [
  { id: "sp1", siteId: "s1", name: "Kitchen north wall", shots: [{ at: "2026-08-12", hue: 28, seed: 41 }, { at: "2026-08-26", hue: 28, seed: 42 }, { at: "2026-09-09", hue: 28, seed: 43 }] },
  { id: "sp2", siteId: "s1", name: "Slab 2 from grid A", shots: [{ at: "2026-08-19", hue: 30, seed: 44 }, { at: "2026-09-02", hue: 30, seed: 45 }, { at: "2026-09-09", hue: 30, seed: 46 }] },
  { id: "sp3", siteId: "s2", name: "Level 2 ceiling", shots: [{ at: "2026-08-22", hue: 200, seed: 47 }, { at: "2026-09-08", hue: 200, seed: 48 }] },
];
// Real iPhone export shape (redacted, names swapped for seed personas). Direction marks and narrow spaces kept on purpose.
export const WA_SAMPLE = String.raw`[17/01/26, 11:29:45 PM] Harshal Patel: ‎Harshal Patel created this group
‎[25/08/26, 3:35:05 PM] +91 98250 40011: PT-1.4B.dwg ‎document omitted
[25/08/26, 3:36:13 PM] Harshal Patel: Thank you Nitin bhai 🙏🏼@⁨+91 98250 40011⁩
[25/08/26, 3:55:23 PM] Rohan Gandhi: @⁨+91 99090 55123⁩ Please provide with the dimensions and also superimpose them onto the bathroom drawings so that we can determine the exact core-cut locations.
‎[25/08/26, 4:05:50 PM] Harshal Patel: ‎image omitted
‎[25/08/26, 4:05:50 PM] Harshal Patel: ‎image omitted
[25/08/26, 4:13:37 PM] +91 98795 22110: ‎This message was deleted.
[25/08/26, 4:15:28 PM] Harshal Patel: Sahil bhai mera ghar nai hai ye @⁨+91 98795 22110⁩
[25/08/26, 4:22:22 PM] +91 98795 22110: Sorry bhai galte se bhej deya
‎[25/08/26, 6:29:52 PM] Harshal Patel: Jagwani Residence_Staircase civil layout_25.08.26 Model.pdf • ‎1 page ‎document omitted
‎[25/08/26, 6:29:52 PM] Harshal Patel: Jagwani Residence_Staircase civil layout_25.08.26.dwg ‎document omitted
[25/08/26, 6:30:08 PM] Harshal Patel: @⁨+91 97270 11223⁩ for lineouts of staircase
‎[25/08/26, 8:55:52 PM] Harshal Patel: Plz check the levels , it's front elevation @⁨+91 98795 22110⁩ @⁨+91 98240 33221⁩ ‎image omitted
‎[25/08/26, 9:01:20 PM] Harshal Patel: 1 inch error in both the chajja levels ‎image omitted
[25/08/26, 9:01:50 PM] Harshal Patel: I need everything in proper lines , that's the whole point
[26/08/26, 2:03:29 PM] Harshal Patel: Release false ceiling drawing @⁨~Ronak K⁩ 🙏🏼
[26/08/26, 9:40:59 PM] Rohan Gandhi: @⁨+91 99090 55123⁩ any update? ‎<This message was edited>
[26/08/26, 9:48:11 PM] +91 98980 12121: @⁨+91 99090 55123⁩ As discussed we would require the below supply at machines.
1. For all indoor units 1.5 Sq Mm 3 Core wire with 6 AMP MCB and no switch required
2. For 14 Hp ODU-10 Sq MM 4 Core Copper Armoured cable plus 10 Sq MM single core earthing wire with 63 AMP MCCB+ELCB at ODU with M8 ring type lugs
[26/08/26, 9:51:03 PM] Rohan Gandhi: Ye bhi dekh lena ‎<This message was edited>
[26/08/26, 10:06:24 PM] ~: Tomorrow sir
[26/08/26, 11:05:05 PM] Rohan Gandhi: Powder ma cut to cut maap che trap nu ?
[26/08/26, 11:07:31 PM] ~: @⁨+91 99250 78901⁩ shift 6" it towards wc`;

// ---------- agency (white-label): seeded with Hertz values, all editable in Settings ----------
export const AGENCY = {
  name: "Hertz Architects",
  short: "Hertz",
  accent: "#b1552f",
  paletteVersion: 1,
  // Supplied studio assets stay local/private; never package the source portfolio.
  brand: {
    name: "Hertz Architects",
    short: "Hertz",
    logo: "../../local/hertz/ui-assets/wordmark.svg",
    projects: {
      p1: { src: "../../local/hertz/ui-assets/jagwani-residence.jpg", alt: "Jagwani Residence living room from the studio portfolio", caption: "Studio portfolio · reference image" },
    },
  },
  wa: "+91 98250 12345",
  address: "Navrangpura, Ahmedabad",
  hours: { start: 9, end: 18 },
  booking: { buffer: 0.25, approve: true, remind: ["Day before", "1 hour before"], days: 14 },
  sources: ["web", "whatsapp", "phone"],
  // GST invoice format. sac 9983 = architectural and engineering services. Series resets each financial year.
  gstin: "24AABCH1234F1Z5",
  state: "Gujarat",
  sac: "9983",
  series: "HA/26-27/",
};
// Labour trades for the morning hajri. Editable in Settings; contractors tap a count per trade.
export const TRADES = ["Mason", "Helper", "Carpenter", "Bar bender", "Electrician", "Plumber", "Painter", "Tiler"];
// Statutory approvals per project. Checklist seeded per city ("*" = any city), editable in Settings.
export const STATUTORY_TEMPLATES = [
  { city: "*", items: ["Building use (BU) permission", "Fire NOC", "Water and drainage connection"] },
  { city: "Vadodara", items: ["VMC plan approval", "Building use (BU) permission", "Fire NOC", "GUDA NOC (if outside VMC limits)"] },
  { city: "Ahmedabad", items: ["AMC plan approval", "Building use (BU) permission", "Fire NOC", "RERA registration (flat sale)", "TDR certificate"] },
];
export const STATUTORY = [
  { id: "sa1", projectId: "p1", name: "VMC plan approval", authority: "Vadodara Municipal Corporation", ownerId: "u5", submitted: "2026-04-10", due: "2026-05-02", followUp: null, status: "granted" },
  { id: "sa2", projectId: "p1", name: "Fire NOC", authority: "Vadodara Fire and Emergency Services", ownerId: "u5", submitted: "2026-08-20", due: "2026-10-05", followUp: "2026-09-12", status: "submitted" },
  { id: "sa3", projectId: "p1", name: "Building use (BU) permission", authority: "Vadodara Municipal Corporation", ownerId: "u5", submitted: null, due: "2027-01-20", followUp: null, status: "todo" },
  { id: "sa4", projectId: "p2", name: "AMC plan approval", authority: "Ahmedabad Municipal Corporation", ownerId: "u2", submitted: "2026-01-12", due: "2026-02-05", followUp: null, status: "granted" },
  { id: "sa5", projectId: "p2", name: "RERA registration (flat sale)", authority: "GujRERA", ownerId: "u2", submitted: "2026-08-28", due: "2026-09-30", followUp: "2026-09-10", status: "submitted" },
  { id: "sa6", projectId: "p2", name: "Fire NOC", authority: "AMC Fire Department", ownerId: "u2", submitted: null, due: "2026-12-15", followUp: null, status: "todo" },
];
export const SERVICE_TYPES = [
  { id: "architecture", name: "Architecture" },
  { id: "interior", name: "Interior" },
  { id: "landscape", name: "Landscape" },
  { id: "commercial", name: "Commercial" },
  { id: "office", name: "Office" },
  { id: "cafe", name: "Cafe" },
];
// mode: pool (round robin among role) · person (one user) · reject (not eligible). typeId "*" = default.
export const ROUTING_RULES = [
  { id: "rr0", typeId: "*", mode: "pool", to: "partner" },
  { id: "rr1", typeId: "cafe", mode: "person", to: "u3" },
];
export const ENQUIRIES = [
  {
    id: "e1",
    name: "Kavita Desai",
    phone: "+91 98790 22110",
    email: "kavita.d@gmail.com",
    typeId: "interior",
    source: "web",
    city: "Ahmedabad",
    msg: "3BHK at Iscon Ambli, possession Nov. Want full interior, budget 35-40L.",
    at: "2026-09-10T08:40:00",
    status: "new",
    assignee: "u2",
  },
  {
    id: "e2",
    name: "Rahul Bhatt",
    phone: "+91 99090 55671",
    typeId: "cafe",
    source: "whatsapp",
    city: "Surat",
    msg: "Opening a 1200 sqft cafe in Vesu. Saw Curators on Instagram.",
    at: "2026-09-10T09:15:00",
    status: "new",
    assignee: "u3",
  },
  {
    id: "e3",
    name: "Nilesh Trivedi",
    phone: "+91 98240 77812",
    typeId: "architecture",
    source: "phone",
    city: "Gandhinagar",
    msg: "Plot 300 sq yd, wants G+1 bungalow. Called office, spoke to Bhavna.",
    at: "2026-09-09T11:20:00",
    status: "accepted",
    assignee: "u1",
    clientId: "c3",
  },
  {
    id: "e4",
    name: "Sameer Khan",
    phone: "+91 97250 10022",
    typeId: "landscape",
    source: "web",
    city: "Mumbai",
    msg: "Terrace garden 400 sqft.",
    at: "2026-09-08T16:05:00",
    status: "not_eligible",
    assignee: "u4",
    note: "Out of city, too small",
  },
];

// ---------- project lifecycle, import, day-to-day (added 2026-09-11) ----------
// Every project carries status "active" or "finished". Only a partner flips it. Finished projects vanish from the phone.
PROJECTS.forEach((p) => { p.status = p.status || "active"; });
// p5: a finished project so the hide rule is visible. Cloned from p2 so every field the UI reads exists.
PROJECTS.push({ ...JSON.parse(JSON.stringify(PROJECTS[1])), id: "p5", code: "HA-2311", name: "Trivedi Farmhouse", kind: "Residential · Farmhouse", area: "6,200 sq ft", city: "Waghodia Road, Vadodara", clientId: "c3", siteId: "s5", phase: 5, hue: 120, budget: 21000000, actual: 20650000, start: "2025-04-01", handover: "2026-08-20", status: "finished", finishedAt: "2026-08-20", finishedBy: "u1", teamIds: ["u1", "u5", "u10"] });
USERS.find((u) => u.id === "c3").projectIds = ["p5"];
SITES.push({ id: "s5", projectId: "p5", name: "Trivedi Farmhouse site", managerId: "u10", contractorIds: ["x1"], progress: 100, hue: 120, stage: "Handed over", lastVisit: "2026-08-18" });
THREADS.push(
  { id: "t7", projectId: "p5", name: "Trivedi Farmhouse · Client", kind: "client", memberIds: ["u1", "u5", "c3"] },
  { id: "t8", projectId: "p5", name: "Trivedi Farmhouse · Site", kind: "site", siteId: "s5", memberIds: ["u1", "u5", "u10", "x1"] },
);
MESSAGES.push(
  { id: "fm1", threadId: "t7", by: "c3", at: "2026-08-19T18:10", text: "Keys received. Thank you team, the verandah came out better than the render." },
  { id: "fm2", threadId: "t7", by: "u1", at: "2026-08-19T18:25", text: "Pleasure working with you. Handover pack is in Documents, warranty contacts inside." },
  { id: "fm3", threadId: "t8", by: "u10", at: "2026-08-18T16:40", text: "Snag walk done, 0 open. Site closed.", photo: { hue: 120, seed: 41 } },
);
// Imported history keeps its origin so the UI can label it.
MESSAGES.push({ id: "im1", threadId: "t7", by: "c3", at: "2025-06-02T10:12", text: "Hi Harshal, sharing the plot survey and our brief. Budget around 2 crore.", imported: "WhatsApp export 2025-06-02" });

// Bills and expenses: raised from a chat photo or the phone Plus menu, approved on desktop by a partner.
// paidBy: "cash" draws down the site petty cash float; "own" is the person's pocket, reimbursed with salary.
export const EXPENSES = [
  { id: "ex1", userId: "u10", projectId: "p1", kind: "Travel", amount: 1240, date: "2026-09-08", status: "pending", paidBy: "own", note: "Site to VMC office and back, cab" },
  { id: "ex2", userId: "u5", projectId: "p1", kind: "Samples", amount: 3600, date: "2026-09-05", status: "approved", paidBy: "own", note: "Dekton swatches, courier" },
  { id: "ex3", userId: "u7", projectId: "p2", kind: "Printing", amount: 2150, date: "2026-09-03", status: "paid", paidBy: "own", note: "A1 prints for layout sign-off" },
  { id: "ex4", userId: "u11", projectId: "p2", kind: "Travel", amount: 860, date: "2026-09-09", status: "pending", paidBy: "own", note: "Vasna site, two trips" },
  { id: "ex5", userId: "u10", projectId: "p1", kind: "Material", amount: 18400, date: "2026-09-09", status: "pending", paidBy: "cash", note: "Shree Cement Depot, 40 bags OPC 53, GST 28%", vendorId: "v4", gst: 4025, msgId: "pm13", ai: true },
];
// Site check-ins: one tap, GPS plus a photo. Desktop shows who is on which site today.
export const SITE_CHECKINS = [
  { id: "sc1", userId: "u10", siteId: "s1", at: "2026-09-09T08:20", gps: "22.3072, 73.1812", hue: 28, seed: 51 },
  { id: "sc2", userId: "x1", siteId: "s1", at: "2026-09-09T08:05", gps: "22.3071, 73.1810", hue: 28, seed: 52 },
  { id: "sc3", userId: "u11", siteId: "s2", at: "2026-09-09T09:02", gps: "23.0120, 72.5108", hue: 200, seed: 53 },
];
// Follow-ups: long-press any message, "Remind me". Lands in the studio chat at that time.
export const FOLLOWUPS = [
  { id: "fu1", msgId: "pm12", userId: "u5", at: "2026-09-10T09:00", done: false },
  { id: "fu2", msgId: "m3", userId: "u1", at: "2026-09-09T10:00", done: false },
];
// Client decisions with a deadline. Chip in the client thread, reminder before due, escalates to a partner after.
export const DECISIONS_DUE = [
  { id: "dd1", projectId: "p1", threadId: "t1", title: "Pick kitchen counter: Dekton vs Kota", due: "2026-09-12", status: "open", askedBy: "u5" },
  { id: "dd2", projectId: "p1", threadId: "t1", title: "Approve pantry door sample, fluted oak", due: "2026-09-10", status: "open", askedBy: "u5" },
  { id: "dd3", projectId: "p2", threadId: "t3", title: "Confirm café signage colour", due: "2026-09-05", status: "open", askedBy: "u7" },
];
// Vendor ratings per project and trade. Asked once a project is finished.
VENDORS.forEach((v) => { v.ratings = v.ratings || []; });
VENDORS.find((v) => v.id === "v1").ratings.push({ projectId: "p5", stars: 4, by: "u10", at: "2026-08-20", note: "On time, tidy site, slow on snags" });
// Bulk import fixtures: what the desktop wizard previews. Real files would be parsed by the proxy.
export const IMPORT_SHEET = `code,name,client,phone,city,status,start,handover
HA-2205,Desai Penthouse,Meera Desai,+91 98250 40011,Alkapuri Vadodara,finished,2022-05-10,2023-11-30
HA-2308,Oberoi Clinic,Dr Kunal Oberoi,+91 99090 55123,Satellite Ahmedabad,finished,2023-08-01,2024-09-15
HA-2502,Parekh Villa,Rina Parekh,+91 98795 22110,Bopal Ahmedabad,active,2025-02-14,2026-12-20`;
export const IMPORT_GROUPS = [
  { file: "WhatsApp Chat with Desai Penthouse.txt", msgs: 1842, photos: 312, dup: 41, guess: "HA-2205", numbers: [["+91 98250 40011", "Meera Desai", "client"], ["+91 98240 33221", "Shree Cement Depot", "vendor v4"], ["+91 97000 11888", "unknown", ""]] },
  { file: "WhatsApp Chat with Oberoi Clinic site.txt", msgs: 960, photos: 205, dup: 12, guess: "HA-2308", numbers: [["+91 99090 55123", "Dr Kunal Oberoi", "client"], ["+91 98250 11223", "Om Civil Works", "vendor v1"]] },
  { file: "WhatsApp Chat with Parekh Villa.txt", msgs: 2210, photos: 488, dup: 97, guess: "HA-2502", numbers: [["+91 98795 22110", "Rina Parekh", "client"], ["+91 97270 66778", "Stonecraft Surfaces", "vendor v5"], ["+91 96000 22777", "unknown", ""]] },
];
// ---------- Hertz meeting, 23 Sep 2026 (research/hertz/meeting-2026-09-23.html) ----------
// Connections to tools the studio already uses. Each one switches features on inside the app instead of a link list.
// google: Meet links on confirmed meetings, Add to Google Calendar, Drive archive folder per project.
// nas: Open on NAS from project Files. whatsapp: Send approved updates or share links on WhatsApp.
// canva: concept deck per project. autocad: Open DWG in AutoCAD Web from the drawing index.
export const CONNECTIONS = [
  { id: "cn1", key: "google", name: "Google Workspace", on: true, url: "https://drive.google.com", note: "Meet on meetings, Add to Calendar, Drive archive per project" },
  { id: "cn2", key: "nas", name: "QNAP File Station", on: true, url: "https://nas.local:8080", note: "Open on NAS from project Files" },
  { id: "cn3", key: "whatsapp", name: "WhatsApp", on: true, url: "https://wa.me", note: "Send share links and approved client updates" },
  { id: "cn4", key: "canva", name: "Canva", on: true, url: "https://www.canva.com", note: "Concept deck per project" },
  { id: "cn5", key: "autocad", name: "AutoCAD Web", on: true, url: "https://web.autocad.com", note: "Open DWG from the drawing index" },
];
// Temporary share links. Viewer on the web needs no app. Expiry and optional PIN; revoke any time.
export const SHARE_LINKS = [
  { id: "sl1", projectId: "p1", path: "04 Execution/Drawings", label: "Jagwani · issued drawings", by: "u5", at: "2026-09-06T11:20", expires: "2026-09-13", pin: "4821", views: 3, status: "active" },
  { id: "sl2", projectId: "p2", path: "01 Concept", label: "Café · concept board", by: "u7", at: "2026-08-28T16:05", expires: "2026-09-04", pin: "", views: 9, status: "active" },
];
// Manager reviews: private to the manager, the person and partners. Reason required, score 1–5, three strengths, one growth point.
export const REVIEWS = [
  { id: "rv1", userId: "u5", by: "u1", month: "2026-08", score: 4, strengths: ["Client updates on time", "Clean drawing sets", "Mentors Sana well"], growth: "Close snags faster after site visits", reason: "Two client compliments, one late RFI", note: "" },
  { id: "rv2", userId: "u10", by: "u4", month: "2026-08", score: 5, strengths: ["Daily site photos without asking", "Zero safety incidents", "Contractors respect deadlines"], growth: "Log material deliveries on the day", reason: "Best site discipline this quarter", note: "Thanks. Will log GRNs same day." },
  { id: "rv3", userId: "u7", by: "u3", month: "2026-08", score: 3, strengths: ["Fast on mood boards", "Good with client references", "Asks early"], growth: "Check dimensions before issuing", reason: "One reissue on café signage", note: "" },
];
// Punch in/out history for the month. Time plus optional site photo; late after the agency cut-off.
export const PUNCHES = [
  { userId: "u5", date: "2026-09-08", in: "09:12", out: "18:40", site: "Office" },
  { userId: "u5", date: "2026-09-07", in: "09:38", out: "18:05", site: "Office", late: true },
  { userId: "u5", date: "2026-09-04", in: "09:05", out: "19:10", site: "Jagwani Residence" },
  { userId: "u10", date: "2026-09-08", in: "08:20", out: "18:55", site: "Jagwani Residence", photo: true },
  { userId: "u10", date: "2026-09-07", in: "08:25", out: "18:30", site: "Jagwani Residence", photo: true },
  { userId: "u10", date: "2026-09-04", in: "08:15", out: "17:50", site: "Jagwani Residence", photo: true },
  { userId: "u7", date: "2026-09-08", in: "09:45", out: "18:10", site: "Office", late: true },
  { userId: "u7", date: "2026-09-07", in: "09:20", out: "18:00", site: "Office" },
];
// Drawing index per stage. Rows strike through when a client approval record or a Finalise action lands.
export const DRAWING_INDEX = [
  { id: "di1", projectId: "p1", stage: "Execution", no: "HA-2401-A-101", name: "Ground floor plan", dwg: "https://web.autocad.com/drawing/HA-2401-A-101", done: true, doneBy: "c1", doneAt: "2026-08-28", how: "Client approval" },
  { id: "di2", projectId: "p1", stage: "Execution", no: "HA-2401-A-102", name: "First floor plan", dwg: "https://web.autocad.com/drawing/HA-2401-A-102", done: true, doneBy: "u5", doneAt: "2026-08-30", how: "Finalised · issued R3" },
  { id: "di3", projectId: "p1", stage: "Execution", no: "HA-2401-A-201", name: "Kitchen elevations", done: false },
  { id: "di4", projectId: "p1", stage: "Execution", no: "HA-2401-E-301", name: "Electrical layout", done: false },
  { id: "di5", projectId: "p1", stage: "Execution", no: "HA-2401-I-401", name: "Wardrobe details", done: false },
  { id: "di6", projectId: "p2", stage: "Concept", no: "HA-2506-C-001", name: "Café layout options", done: true, doneBy: "c2", doneAt: "2026-08-22", how: "Client approval" },
  { id: "di7", projectId: "p2", stage: "Design development", no: "HA-2506-A-101", name: "Seating plan", done: false },
  { id: "di8", projectId: "p2", stage: "Design development", no: "HA-2506-A-201", name: "Counter and signage", done: false },
];
// Client data intake checklist. Received, requested or missing; the client can upload in the portal when asked.
export const INTAKE = [
  { id: "in1", projectId: "p1", item: "Site survey / measured drawing", status: "received", at: "2026-03-02" },
  { id: "in2", projectId: "p1", item: "Society NOC and sanctioned plan", status: "received", at: "2026-03-10" },
  { id: "in3", projectId: "p1", item: "Family brief and room list", status: "received", at: "2026-03-02" },
  { id: "in4", projectId: "p1", item: "Electrical load letter", status: "requested", at: "2026-09-05" },
  { id: "in5", projectId: "p1", item: "Appliance list with sizes", status: "missing" },
  { id: "in6", projectId: "p2", item: "Lease plan and landlord rules", status: "received", at: "2026-07-14" },
  { id: "in7", projectId: "p2", item: "Brand guide and logo files", status: "requested", at: "2026-09-01" },
  { id: "in8", projectId: "p2", item: "Kitchen equipment list", status: "missing" },
];
// Studio portfolio shown to clients. Partners choose which finished projects are public.
export const PORTFOLIO = [
  { id: "pf1", name: "Desai Penthouse", year: 2023, type: "Residence · 4,200 sq ft", city: "Vadodara", blurb: "Terrazzo, brass and a double-height living room.", hue: 24 },
  { id: "pf2", name: "Oberoi Clinic", year: 2024, type: "Healthcare · 1,800 sq ft", city: "Ahmedabad", blurb: "Calm waiting room, oak and lime plaster.", hue: 150 },
  { id: "pf3", name: "Mehta Farmhouse", year: 2022, type: "Weekend home · 6,000 sq ft", city: "Sanand", blurb: "Exposed brick, courtyard plan, rain-fed pond.", hue: 350 },
];
// Client references board: Pinterest and Instagram saves the client adds. Designers promote picks to the moodboard.
export const CLIENT_REFS = [
  { id: "cr1", projectId: "p1", by: "c1", src: "Pinterest", title: "Warm minimalist kitchen", url: "https://pin.it/3kQ9x", room: "Kitchen", at: "2026-09-06", promoted: false },
  { id: "cr2", projectId: "p1", by: "c1", src: "Instagram", title: "Cane wardrobe shutters", url: "https://www.instagram.com/p/C9abc/", room: "Master bedroom", at: "2026-09-03", promoted: true },
  { id: "cr3", projectId: "p2", by: "c2", src: "Instagram", title: "Terracotta café counter", url: "https://www.instagram.com/p/C8xyz/", room: "Counter", at: "2026-08-30", promoted: false },
];
// Live notifications for the desktop dashboard. Seeded; svc.notify() appends at runtime.
export const NOTIFICATIONS = [
  { id: "n1", at: "2026-09-09T09:05", kind: "site", text: "Rohan posted 4 photos · Jagwani Residence slab 2", ref: "#/sites/s1", roles: ["partner", "designer", "site_manager"] },
  { id: "n2", at: "2026-09-09T08:50", kind: "client", text: "Anjali Jagwani added a Pinterest reference · Kitchen", ref: "#/projects/p1?tab=moodboard", roles: ["partner", "designer"] },
  { id: "n3", at: "2026-09-09T08:41", kind: "enquiry", text: "New Instagram enquiry · Farhan Shaikh, 2BHK Bopal", ref: "#/enquiries", roles: ["partner"] },
  { id: "n4", at: "2026-09-09T08:30", kind: "people", text: "Sana Pathan punched in late · 09:45", ref: "#/people?tab=attendance", roles: ["partner", "hr"] },
  { id: "n5", at: "2026-09-08T18:20", kind: "approval", text: "Kitchen counter decision still open · due 12 Sep", ref: "#/projects/p1?tab=decisions", roles: ["partner", "designer", "client"] },
  { id: "n6", at: "2026-09-08T17:10", kind: "site", text: "Material delivery confirmed · 40 bags OPC", ref: "#/sites/s1?tab=materials", roles: ["partner", "site_manager", "contractor"] },
];
// Instagram and Facebook enquiries arrive from the studio inbox; Source filter on the desktop Enquiries page.
ENQUIRIES.push(
  { id: "e7", name: "Farhan Shaikh", phone: "+91 98980 41120", email: "", typeId: "interior", source: "instagram", city: "Ahmedabad", msg: "Saw your Desai penthouse reel. 2BHK at Bopal, want similar kitchen.", at: "2026-09-09T08:41:00", status: "new", assignee: "u3" },
  { id: "e8", name: "Neha Trivedi", phone: "+91 97120 33450", email: "neha.t@outlook.com", typeId: "architecture", source: "facebook", city: "Gandhinagar", msg: "Plot 300 sq yd in Sargasan. Need full architecture plus interior.", at: "2026-09-08T21:15:00", status: "new", assignee: "u2" },
);
// Brainstorm rooms: one private internal thread per project for ideas that never reach the client.
THREADS.push(
);
MESSAGES.push(
  { id: "bm1", threadId: "t2", by: "u9", at: "2026-09-08T15:10", text: "Idea: fluted glass on the pantry door instead of oak. Cheaper and lets light through." },
  { id: "bm2", threadId: "t2", by: "u5", at: "2026-09-08T15:22", text: "Keep it here till we have a sample. Client already leaning oak." },
  { id: "bm3", threadId: "t4", by: "u7", at: "2026-09-07T11:05", text: "Signage in terracotta letters? Rough sketch attached.", photo: { hue: 18, seed: 61 } },
);
