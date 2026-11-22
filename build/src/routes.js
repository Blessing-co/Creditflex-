/* ROUTES: the table of pages, like the URL rules in a Flask app.
   Each page says: its name in the menu, its icon, whether it sits in the menu, who may open it (admin only?),
   which page is its parent (the Back bar returns there), and which controller draws it.
   To add a page: write its controller in controllers/, then add one line here. */
const ROUTES = {
  /* ----- main menu (7 tabs for agents, 8 for admin) ----- */
  collections: { label: "Collections",    icon: "account_balance_wallet", menu: true, view: () => viewCollections() },
  pay:         { label: "Record payment", icon: "payments",               menu: true, view: () => viewPay() },
  register:    { label: "Customers",      icon: "person_search",          menu: true, view: () => viewRegister() },
  catalogue:   { label: "Catalogue",      icon: "grid_view",              menu: true, view: () => viewCatalogue() },
  analytics:   { label: "Analytics",      icon: "query_stats",            menu: true, view: () => viewCreditflexAnalytics() },
  help:        { label: "Help",           icon: "school",                 menu: true, hub: [
    ["learn",   "How it works",    "school", "Plain-language guide for newcomers"],
    ["tour",    "Guided tour",     "info",   "Walk through the app step by step", () => startCreditflexTour()],
    ["privacy", "Privacy & terms", "policy", "How we handle data and the rules of use"],
    ["credit",  "Credit & contact","call",   "Who built this and how to reach us"] ] },
  settings:    { label: "Settings",       icon: "settings",               menu: true, view: () => { viewCreditflexSettings(); cfSettingsLinks(); } },
  manage:      { label: "Manage",         icon: "group",                  menu: true, admin: true, hub: [
    ["staff",     "Staff",              "group",        "Approve and manage agents"],
    ["financial", "Financial",          "receipt_long", "Review and reverse payments"],
    ["export",    "Export data",        "download",     "Download payments, customers and purchases"],
    ["announce",  "Announcements",      "campaign",     "Send messages to your agents"],
    ["bulk",      "Add many products",  "upload_file",  "Upload products from a list or CSV"] ] },

  /* ----- pages reached from somewhere else (not in the menu) ----- */
  learn:     { parent: "help",        view: () => viewCreditflexLearn() },
  privacy:   { parent: "help",        view: () => viewCreditflexPrivacy() },
  credit:    { parent: "help",        view: () => viewCreditflexCredit() },
  account:   { parent: "settings",    view: () => viewCreditflexAccount() },
  inbox:     { parent: "collections", view: () => viewCreditflexInbox() },
  staff:     { parent: "manage",      admin: true, view: () => viewStaff() },
  financial: { parent: "manage",      admin: true, view: () => viewCreditflexFinancial() },
  export:    { parent: "manage",      admin: true, view: () => viewCreditflexExport() },
  announce:  { parent: "manage",      admin: true, view: () => viewCreditflexAnnounce() },
  bulk:      { parent: "catalogue",   admin: true, view: () => viewCreditflexBulk() }
};

const HOME = "collections";
const menuRoutes = admin => Object.entries(ROUTES).filter(([, r]) => r.menu && (!r.admin || admin));
const parentOf = key => (ROUTES[key] || {}).parent || null;

/* ----- the router: open a page, and keep the phone's Back button in step ----- */
function go(key) {                       // open a page (adds it to the Back history)
  S.tab = ROUTES[key] ? key : HOME;
  renderShell();
  window.scrollTo(0, 0);
}
function goBack(parent) {                // the on-screen Back bar: use real history when it matches
  if (history.state && history.state.prev === parent) history.back(); else go(parent);
}
function syncHistory() {                 // called every time a page is drawn
  if (S._popping) return;
  const st = history.state;
  if (!st || !st.cf) history.replaceState({ cf: 1, tab: S.tab, prev: null }, "");
  else if (st.tab !== S.tab) history.pushState({ cf: 1, tab: S.tab, prev: st.tab }, "");
}
window.addEventListener("popstate", e => {   // phone/browser Back or Forward
  if (!S.me) return;
  const t = e.state && e.state.cf ? e.state.tab : HOME;
  S.tab = ROUTES[t] ? t : HOME;
  S._popping = true; try { renderShell(); } finally { S._popping = false; }
  window.scrollTo(0, 0);
});
function drawRoute() {                   // draw the current page inside the shell
  let r = ROUTES[S.tab];
  if (!r || (r.admin && S.me.role !== "admin")) { S.tab = HOME; r = ROUTES[HOME]; }
  if (r.hub) return viewHub(S.tab);
  r.view();
}
