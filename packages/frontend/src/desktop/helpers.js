import { state, user, effectiveRole, can } from "../shared/core.js";

// Small lookups shared by every desktop page.
export const P = (id) => state.db.PROJECTS.find((p) => p.id === id);
export const V = (id) => state.db.VENDORS.find((v) => v.id === id) || { name: "—" };
export const name = (id) => user(id).name;
export const first = (id) => name(id).split(" ")[0];
export const role = () => effectiveRole();
export const staff = () => !["client", "contractor"].includes(role());
export const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

export const NAV = [
  ["dashboard", "Dashboard", "bell"],
  ["chats", "Chats", "chat"],
  ["tasks", "All tasks", "check"],
  ["enquiries", "Enquiries", "enquiries"],
  ["projects", "Projects", "projects"],
  ["sites", "Sites", "sites"],
  ["schedule", "Schedule", "schedule"],
  ["people", "People", "people"],
  ["money", "Money", "money"],
  ["vendors", "Vendors", "vendors"],
  ["samples", "Samples", "samples"],
  ["templates", "Templates", "templates"],
  ["files", "Files", "folder"],
  ["import", "Import", "import"],
  ["settings", "Settings", "settings"],
];
export const NAV_GROUPS = [
  ["Workspace", ["dashboard", "tasks", "projects", "sites", "chats", "schedule"]],
  ["Studio", ["enquiries", "people", "money"]],
  ["Resources", ["files", "vendors", "samples", "templates", "import", "settings"]],
];
export const navFor = () => {
  const r = role();
  if (r === "client")
    return NAV.filter(
      ([k]) =>
        ["dashboard", "chats", "projects", "money", "samples", "settings"].includes(k) &&
        (k !== "money" || can("budget", "r", role())),
    );
  if (r === "contractor")
    return NAV.filter(([k]) => ["dashboard", "chats", "sites", "settings"].includes(k));
  return NAV.filter(
    ([k]) =>
      (k !== "enquiries" || can("enquiry", "r")) &&
      (k !== "money" || can("budget", "r", role())) &&
      (k !== "import" || ["partner", "hr"].includes(r)) &&
      (k !== "tasks" || r === "partner"),
  );
};
