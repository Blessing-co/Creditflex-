const SUPABASE_URL = "https://dsjuwmtojudcaulfqmyp.supabase.co";
const SUPABASE_KEY = "sb_publishable_pSzeeh2eHthcVfL7ZQzZug_xmdN9t2a";
const RECOVERY = /type=recovery/.test(location.hash);
const HASHERR = ((location.hash.match(/error_description=([^&]+)/) || [])[1] || "").replace(/\+/g, " ");
/* Network layer: every request gets a time limit; reads are retried a couple of times.
   Writes are never retried here (a payment that timed out is queued and re-sent safely
   with its offline_submission_id by the offline queue). */
const CF_NET = { read: 20000, write: 45000, upload: 90000, retries: 2, backoff: 400 };
const cfSleep = ms => new Promise(r => setTimeout(r, ms));
async function cfFetch(url, opts) {
  opts = opts || {};
  const method = String(opts.method || "GET").toUpperCase(), isRead = method === "GET" || method === "HEAD";
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("Failed to fetch (offline)");
  const limit = isRead ? CF_NET.read : (String(url).includes("/storage/v1/") ? CF_NET.upload : CF_NET.write);
  const tries = isRead ? CF_NET.retries + 1 : 1;
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, limit);
    const outer = opts.signal, fwd = () => ctl.abort();
    if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener("abort", fwd, { once: true }); }
    try {
      const res = await fetch(url, { ...opts, signal: ctl.signal });
      clearTimeout(timer);
      if (isRead && res.status >= 500 && i < tries - 1) { await cfSleep(CF_NET.backoff * 2 ** i); continue; }
      return res;
    } catch (e) {
      clearTimeout(timer);
      if (outer && outer.aborted) throw e;
      last = timedOut ? new TypeError("Failed to fetch: the server took too long (timeout)") : e;
      if (isRead && i < tries - 1) { await cfSleep(CF_NET.backoff * 2 ** i); continue; }
    } finally { if (outer) outer.removeEventListener("abort", fwd); }
  }
  throw last;
}
/* Turn any error into a short message a customer-facing agent can understand. */
function cfErr(e) {
  if (!e) return "";
  const m = String(e.message || e), c = String(e.code || ""), n = String(e.name || "");
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|offline/i.test(m)) return "Cannot reach the server. Check your internet and try again.";
  if (/jwt|token.*expired|not authenticated/i.test(m)) return "Your session has expired. Please sign out and sign in again.";
  if (c === "P0001" || /^(Auth|Storage)/.test(n)) return m;
  if (c === "42501" || /row-level security|permission denied/i.test(m)) return "You do not have permission to do that.";
  if (c === "23505") return "That already exists.";
  if (c === "23503") return "That item is linked to other records or no longer exists.";
  if (["23514", "23502", "22P02", "22003", "22007"].includes(c)) return "One of the values is not allowed. Check it and try again.";
  console.warn("Unexpected error", e);
  return "Something went wrong. Please try again, and call us if it keeps happening.";
}
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: "implicit" }, global: { fetch: cfFetch } });

const $app = document.getElementById("app");
const S = { me: null, tab: "collections", signup: false, selPurchase: null, recovery: RECOVERY };

/* ---------- helpers ---------- */
const money = n => "GH₵ " + Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString("en-CA");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = id => document.getElementById(id);
const ic = (n, cls = "") => `<span class="ms ${cls}" aria-hidden="true">${n}</span>`;
const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
const C = {
  h1: "text-headline-xl-mobile text-on-surface",
  card: "bg-surface-container-lowest rounded-xl p-4 shadow-sm",
  lbl: "block text-label-lg text-on-surface mb-1.5",
  inpBase: "w-full h-14 px-4 rounded-xl bg-surface text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container placeholder:text-on-surface-variant/60",
  inp: "w-full h-14 px-4 rounded-xl bg-surface text-on-surface text-body-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container placeholder:text-on-surface-variant/60",
  btn: "w-full min-h-[54px] rounded-xl bg-primary-container text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] hover:bg-primary transition-all disabled:opacity-60",
  btn2: "min-h-[44px] px-4 rounded-xl bg-surface-container-high text-primary text-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all",
  link: "min-h-[44px] px-2 text-primary-container text-label-lg underline",
  stat: "bg-surface-container-low rounded-xl p-3",
  mute: "text-body-md text-on-surface-variant"
};
const loading = `<div class="${C.card} ${C.mute} flex items-center gap-3"><span class="inline-block w-5 h-5 rounded-full border-2 border-primary-container border-t-transparent spin"></span>Loading…</div>`;

const cfDupKey = (r, a, d) => r.purchase_id + "|" + a + "|" + d;
const cfDupAck = (r, a, d) => S.dupAck === cfDupKey(r, a, d);
function cfDupAsk(r, a, d) {
  S.dupAck = cfDupKey(r, a, d);
  const b = $("pb"), sp = b && b.querySelector("span"); if (sp) sp.textContent = "Save anyway";
  say("pm", "Heads up: a payment for " + r.customer_name + " and this item was already recorded today. Tap Save anyway only if the customer is really paying again.");
}
function cfBuzz() { try { if (localStorage.getItem("creditflex-buzz") !== "off" && navigator.vibrate) navigator.vibrate(60); } catch (e) {} }
function say(id, text, ok) {
  const el = $(id); if (!el) return;
  el.innerHTML = text ? (ok
    ? `<div class="bg-primary-container text-on-primary rounded-xl p-4 shadow-md flex items-start gap-3 mt-3">${ic("check_circle", "fill text-[24px] shrink-0")}<span class="text-label-lg flex-1">${esc(text)}</span></div>`
    : `<div class="bg-error-container text-on-error-container rounded-xl p-4 flex items-start gap-3 mt-3">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">${esc(text)}</span></div>`) : "";
}
function busy(btn, on) {
  if (on) { btn._h = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent spin"></span><span>Please wait…</span>`; }
  else { btn.disabled = false; if (btn._h != null) btn.innerHTML = btn._h; }
}

/* ---------- boot ---------- */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { let m; try { m = HASHERR ? decodeURIComponent(HASHERR) + ". Tap Forgot password to get a new link." : undefined; } catch (e) {} if (HASHERR) history.replaceState(null, "", location.pathname); return renderLogin(m); }
  if (S.recovery) return renderNewPassword();
  await loadMe();
}
async function loadMe() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return renderLogin();
  const { data, error } = await sb.from("staff").select("id,full_name,email,phone,role,status,supervisor_id,onboarding_completed_at").eq("id", user.id).maybeSingle();
  if (error || !data) { await sb.auth.signOut(); return renderLogin("Could not load your staff account."); }
  S.me = data;
  if (data.status !== "active") return renderBlocked();
  renderShell();
  if (data.role === "agent" && !data.onboarding_completed_at) setTimeout(() => startCreditflexTour(), 450);
  setTimeout(() => syncCreditflexOfflineQueue(), 700);
}
async function logout() { await sb.auth.signOut(); S.me = null; renderLogin(); }

/* ---------- auth screens ---------- */
function brand() {
  return `<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-md">${ic("payments", "fill text-[26px]")}</div><div class="leading-tight"><div class="text-headline-lg text-on-surface">Creditflex</div><div class="text-label-md text-on-surface-variant uppercase">Agent portal</div></div></div>`;
}
function renderLogin(note) {
  $app.innerHTML = `
  <main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">
    ${brand()}
    <section class="${C.card} p-5 shadow-lg">
      <h1 class="text-headline-lg-mobile text-on-surface">Creditflex Agents</h1>
      <p class="${C.mute} mt-1 mb-4">${S.signup ? "Create your staff account. An admin must approve it before you can log in." : "Sign in with your staff email and password."}</p>
      <form id="authForm" class="space-y-3.5">
        ${S.signup ? `<div><label class="${C.lbl}" for="fn">Full name</label><input id="fn" class="${C.inp}" required minlength="2" autocomplete="name"></div>
        <div><label class="${C.lbl}" for="ph">Phone</label><input id="ph" class="${C.inp}" inputmode="tel" autocomplete="tel"></div>` : ""}
        <div><label class="${C.lbl}" for="em">Email</label><input id="em" class="${C.inp}" type="email" autocomplete="email" required></div>
        <div><label class="${C.lbl}" for="pw">Password</label><input id="pw" class="${C.inp}" type="password" autocomplete="${S.signup ? "new-password" : "current-password"}" required minlength="8"></div>
        <button class="${C.btn}" id="authBtn">${S.signup ? "Sign up" : "Sign in"}</button>
      </form>
      <div id="authMsg">${note ? `<div class="bg-error-container text-on-error-container rounded-xl p-4 flex items-start gap-3 mt-3">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">${esc(note)}</span></div>` : ""}</div>
      ${S.signup ? "" : `<div class="text-center -mt-1"><button class="${C.link}" id="fp" type="button">Forgot password?</button></div>`}
      <div class="text-center -mt-2"><button class="${C.link}" id="lg" type="button">Privacy &amp; terms</button></div>
      <div class="text-center mt-2"><button class="${C.link}" id="swap" type="button">${S.signup ? "I already have an account" : "New staff? Sign up"}</button></div>
    </section>
  </main>`;
  $("swap").onclick = () => { S.signup = !S.signup; renderLogin(); };
  $("lg").onclick = () => cfOpenLegal();
  if ($("fp")) $("fp").onclick = async () => {
    const email = $("em").value.trim();
    if (!email) return say("authMsg", "Type your email above first, then tap Forgot password.");
    const b = $("fp"); busy(b, true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    busy(b, false);
    if (error) return say("authMsg", error.message);
    say("authMsg", "If that email has an account, a reset link is on its way. Open it on this phone.", true);
  };
  $("authForm").onsubmit = async e => {
    e.preventDefault();
    const b = $("authBtn"); busy(b, true);
    const email = $("em").value.trim(), password = $("pw").value;
    if (S.signup) {
      const pwIssue = cfPwIssue(password);
      if (pwIssue) { busy(b, false); return say("authMsg", pwIssue); }
      const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: $("fn").value.trim(), phone: $("ph").value.trim() } } });
      busy(b, false);
      if (error) return say("authMsg", error.message);
      S.signup = false;
      return renderLogin("Account created. Ask an admin to approve it, then sign in.");
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(b, false);
    if (error) return say("authMsg", error.message);
    await loadMe();
  };
}
function renderNewPassword() {
  $app.innerHTML = `<main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">${brand()}
    <section class="${C.card} p-5 shadow-lg">
      <h1 class="text-headline-lg-mobile text-on-surface">Choose a new password</h1>
      <p class="${C.mute} mt-1 mb-4">At least 6 characters.</p>
      <form id="npForm" class="space-y-3.5">
        <div><label class="${C.lbl}" for="np1">New password</label><input id="np1" class="${C.inp}" type="password" autocomplete="new-password" required minlength="8"></div>
        <div><label class="${C.lbl}" for="np2">Repeat password</label><input id="np2" class="${C.inp}" type="password" autocomplete="new-password" required minlength="8"></div>
        <button class="${C.btn}" id="npBtn">Save password</button>
      </form><div id="npMsg"></div>
    </section></main>`;
  $("npForm").onsubmit = async e => {
    e.preventDefault();
    if ($("np1").value !== $("np2").value) return say("npMsg", "The two passwords do not match.");
    { const pwIssue = cfPwIssue($("np1").value); if (pwIssue) return say("npMsg", pwIssue); }
    const b = $("npBtn"); busy(b, true);
    const { error } = await sb.auth.updateUser({ password: $("np1").value });
    busy(b, false);
    if (error) return say("npMsg", error.message);
    S.recovery = false; history.replaceState(null, "", location.pathname);
    await loadMe();
  };
}
function renderBlocked() {
  const pend = S.me.status === "pending";
  $app.innerHTML = `<main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">${brand()}
    <section class="${C.card} p-6 text-center shadow-lg">
      <div class="w-16 h-16 mx-auto rounded-full ${pend ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"} flex items-center justify-center">${ic(pend ? "hourglass_top" : "block", "text-[32px]")}</div>
      <h1 class="text-headline-lg-mobile mt-4">${pend ? "Waiting for approval" : "Account disabled"}</h1>
      <p class="${C.mute} mt-1">${pend ? "An admin needs to approve your account before you can use the app." : "Please contact your admin."}</p>
      <button class="${C.btn2} w-full mt-5" id="lo" type="button">Sign out</button>
    </section></main>`;
  $("lo").onclick = logout;
}

/* ---------- password rules ---------- */
const CF_WEAK = ["password","12345678","123456789","1234567890","qwertyui","qwerty123","iloveyou","creditflex","password1","11111111","00000000","abcd1234","admin123"];
function cfPwIssue(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain both letters and numbers.";
  if (CF_WEAK.includes(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return "That password is too easy to guess. Choose a different one.";
  return null;
}
/* ---------- csv helper ---------- */
function cfCsvDownload(name, rows) {
  const cell = v => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const body = rows.map(r => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* Reads EVERY row, 1000 at a time (Supabase silently stops at 1000 per request). */
async function cfFetchAll(table, select, order, filter) {
  const orders = [].concat(order); let all = [], from = 0;
  for (;;) {
    let q = sb.from(table).select(select);
    if (filter) q = filter(q);
    orders.forEach(o => { q = q.order(o, { ascending: true }); });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < 1000) return all;
    from += 1000;
  }
}
/* Same, but returns { data, error } like a normal query and never throws. */
async function cfLoadAll(table, select, order, filter) {
  try { return { data: await cfFetchAll(table, select, order, filter), error: null }; }
  catch (error) { return { data: null, error }; }
}

/* ---------- shell ---------- */
const MORE_ALL = [["learn", "How it works", "school", "Plain-language guide for newcomers"], ["analytics", "Analytics", "query_stats", "Collections, trends and top agents"], ["settings", "Settings", "settings", "Theme, colours, offline payments, training"], ["account", "Account", "manage_accounts", "Your details and password"], ["credit", "Credit", "info", "Who built this and how to reach us"], ["privacy", "Privacy & terms", "policy", "How we handle data and the rules of use"]];
const MORE_ADMIN = [["staff", "Staff", "group", "Approve and manage agents"], ["financial", "Financial", "receipt_long", "Review and reverse payments"], ["export", "Export data", "download", "Download payments, customers and purchases"]];
const MORE_KEYS = [...MORE_ALL, ...MORE_ADMIN].map(x => x[0]);
const MAIN_TABS = [["collections", "Collections", "account_balance_wallet"], ["pay", "Record payment", "payments"], ["register", "Customers", "person_search"], ["catalogue", "Catalogue", "grid_view"]];
function renderShell() {
  const admin = S.me.role === "admin";
  const items = [...MAIN_TABS, ...(admin ? MORE_ADMIN : []).map(x => [x[0], x[1], x[2]]), ...MORE_ALL.map(x => [x[0], x[1], x[2]])];
  const row = ([k, l, i]) => { const on = S.tab === k; return `<button data-t="${k}" type="button" role="menuitem" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left ${on ? "bg-primary-fixed text-on-primary-fixed font-extrabold" : "text-on-surface font-semibold"} active:bg-surface-container-high">${ic(i, "text-[22px] " + (on ? "fill" : ""))}<span class="text-label-lg">${l}</span></button>`; };
  $app.innerHTML = `
  <header class="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
    <div class="h-16 max-w-2xl mx-auto px-4 flex items-center justify-between gap-2 relative">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">${ic("payments", "fill text-[22px]")}</div>
        <div class="min-w-0 leading-tight"><div class="text-label-lg text-on-surface">Creditflex</div><div class="text-label-md text-on-surface-variant truncate">${esc(S.me.full_name)} · ${esc(S.me.role)}</div></div>
      </div>
      <button id="menuBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open menu" class="min-h-[48px] min-w-[48px] px-3 flex items-center justify-center gap-1 rounded-xl bg-primary-fixed text-on-primary-fixed active:scale-95">${ic("menu", "text-[24px]")}<span class="text-label-md">Menu</span></button>
      <nav id="menuPanel" role="menu" class="hidden absolute right-4 top-[60px] w-64 max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto rounded-2xl bg-surface shadow-xl border border-outline-variant/50 py-2 z-50">
        ${items.map(row).join("")}
        <div class="my-1 border-t border-outline-variant/50"></div>
        <button id="lo" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-error active:bg-error-container/50" type="button">${ic("logout", "text-[22px]")}<span class="text-label-lg">Sign out</span></button>
      </nav>
    </div>
  </header>
  <main id="view" class="max-w-2xl mx-auto px-4 pt-20 pb-10 space-y-4"></main>`;
  const panel = $("menuPanel"), mb = $("menuBtn");
  const close = () => { panel.classList.add("hidden"); mb.setAttribute("aria-expanded", "false"); };
  mb.onclick = e => { e.stopPropagation(); const open = panel.classList.toggle("hidden") === false; mb.setAttribute("aria-expanded", String(open)); };
  panel.onclick = e => e.stopPropagation();
  if (window.cfMenuClose) document.removeEventListener("click", window.cfMenuClose);
  window.cfMenuClose = close; document.addEventListener("click", close);
  $("lo").onclick = logout;
  panel.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => { S.tab = b.dataset.t; renderShell(); window.scrollTo(0, 0); });
  ({ collections: viewCollections, pay: viewPay, register: viewRegister, catalogue: viewCatalogue, staff: viewStaff, analytics: viewCreditflexAnalytics, settings: viewCreditflexSettings, account: viewCreditflexAccount, financial: viewCreditflexFinancial, credit: viewCreditflexCredit, export: viewCreditflexExport, learn: viewCreditflexLearn, bulk: viewCreditflexBulk, privacy: viewCreditflexPrivacy })[S.tab]();
}

/* ---------- collections ---------- */
async function viewCollections() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Collections</h1>
    <section class="${C.card}">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${C.lbl}" for="df">From</label><input type="date" id="df" class="${C.inp}" value="${today()}"></div>
        <div><label class="${C.lbl}" for="dt">To</label><input type="date" id="dt" class="${C.inp}" value="${today()}"></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4"><button class="${C.btn}" id="go">Show</button><button class="${C.btn2}" id="csv">Export CSV</button></div><div id="cm"></div>
    </section>
    <div id="out"></div><div id="nc"></div><div id="port"></div>`;
  let exportRows=[];
  const load = async () => {
    const f = $("df").value, t = $("dt").value;
    $("out").innerHTML = loading;
    const { data, error } = await sb.rpc("collection_summary", { p_from: f, p_to: t });
    if (error) { $("out").innerHTML = ""; return say("cm", cfErr(error)); }
    exportRows=data||[];
    say("cm", "");
    const total = data.reduce((a, r) => a + Number(r.total), 0), cnt = data.reduce((a, r) => a + r.payments_count, 0);
    $("out").innerHTML = `<section class="bg-primary-container text-on-primary rounded-xl p-4 shadow-md">
        <div class="text-label-md uppercase opacity-80">Collected</div>
        <div class="text-currency-display break-words">${money(total)}</div>
        <div class="mt-2 inline-flex items-center gap-2 bg-on-primary/15 rounded-full px-3 py-1 text-label-md"><span>Payments</span><span class="text-label-lg">${cnt}</span></div>
      </section>
      <section class="${C.card} mt-4">
      ${data.length ? `<div class="flex justify-between text-label-md text-on-surface-variant uppercase pb-2"><span>Date · Agent</span><span>Count · Total</span></div><div class="divide-y divide-outline-variant/40">
      ${data.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.agent_name)}</div><div class="${C.mute}">${esc(r.paid_on)}</div></div><div class="text-right shrink-0"><div class="text-currency-item">${money(r.total)}</div><div class="${C.mute}">${r.payments_count} payment${r.payments_count == 1 ? "" : "s"}</div></div></div>`).join("")}</div>`
      : `<div class="text-center py-4"><div class="w-12 h-12 mx-auto rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">${ic("inventory_2", "text-[26px]")}</div><p class="${C.mute} mt-2">No payments in this range.</p></div>`}
      </section>`;
  };
  const loadNew = async () => {
    const f = $("df").value, t = $("dt").value;
    $("nc").innerHTML = "";
    const [c, st] = await Promise.all([
      sb.from("customers").select("id,full_name,phone,location,registered_by,created_at").gte("created_at", f + "T00:00:00").lte("created_at", t + "T23:59:59.999").order("created_at", { ascending: false }).limit(200),
      sb.from("staff").select("id,full_name")
    ]);
    if (c.error || !c.data) return;
    const names = {}; (st.data || []).forEach(x => names[x.id] = x.full_name);
    const rows = c.data;
    $("nc").innerHTML = `<section class="${C.card} mt-4"><div class="flex items-center justify-between mb-2"><h2 class="text-title-md flex items-center gap-2">${ic("person_add", "text-[22px] text-primary")}New customers</h2><span class="text-label-lg bg-primary-fixed text-on-surface rounded-full px-3 py-1">${rows.length}</span></div>
      ${rows.length ? `<div class="divide-y divide-outline-variant/40">${rows.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.full_name)}</div><div class="${C.mute} truncate">${esc(r.phone || "No phone")}${r.location ? " · " + esc(r.location) : ""}</div></div><div class="text-right shrink-0"><div class="text-label-lg">${esc(names[r.registered_by] || "Agent")}</div><div class="${C.mute}">${esc(String(r.created_at).slice(0, 10))}</div></div></div>`).join("")}</div>` : `<p class="${C.mute} py-2">No new customers in this range.</p>`}
    </section>`;
  };
  $("go").onclick = () => { load(); loadNew(); };
  $("csv").onclick=()=>{if(!exportRows.length)return say("cm","There are no collection rows to export for this date range.");const cell=v=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"' + s.replace(/"/g,'""') + '"';};const lines=[["Date","Agent","Payments","Total (GHS)"],...exportRows.map(r=>[r.paid_on,r.agent_name,r.payments_count,r.total])].map(row=>row.map(cell).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\ufeff"+lines],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="creditflex-collections-"+$("df").value+"-to-"+$("dt").value+".csv";a.click();URL.revokeObjectURL(url);};
  load(); loadNew();
  const { data: port } = await sb.rpc("portfolio_summary");
  if (port && port.length) {
    const out = port.reduce((a, r) => a + Number(r.outstanding), 0);
    $("port").innerHTML = `<section class="${C.card}"><h2 class="text-title-md mb-3">Money still owed</h2>
      <div class="grid grid-cols-2 gap-3">
        <div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Outstanding</div><div class="text-currency-item text-tertiary-container break-words">${money(out)}</div></div>
        <div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Active purchases</div><div class="text-currency-item">${port.reduce((a, r) => a + r.active_purchases, 0)}</div></div>
      </div>
      <div class="flex justify-between text-label-md text-on-surface-variant uppercase pt-4 pb-1"><span>Agent · Active</span><span>Owed</span></div>
      <div class="divide-y divide-outline-variant/40">${port.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.agent_name)}</div><div class="${C.mute}">${r.active_purchases} active</div></div><div class="text-currency-item shrink-0">${money(r.outstanding)}</div></div>`).join("")}</div></section>`;
  }
}

/* ---------- record payment ---------- */
async function viewPay() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Record a payment</h1><div id="top"></div>
    <section class="${C.card}">
      <label class="${C.lbl} flex items-center gap-1.5" for="q">${ic("search", "text-[18px] text-primary")}Find customer</label>
      <div class="relative">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">${ic("person_search", "text-[22px]")}</span>
        <input id="q" type="search" autocomplete="off" class="${C.inp} pl-12 pr-12" placeholder="Type a name or phone">
        <button id="qc" type="button" title="Clear" class="hidden absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-lg text-on-surface-variant flex">${ic("cancel", "text-[20px]")}</button>
      </div>
    </section>
    <section id="list" class="space-y-2">${loading}</section><div id="form"></div>`;
  let data=[], cfRecent=[];
  if(navigator.onLine){
    const result=await cfLoadAll("purchase_ledger","purchase_id,customer_id,customer_name,customer_phone,product_id,product_name,plan_name,total_price,installment_amount,amount_paid,balance,payments_made,status",["customer_name","purchase_id"],q=>q.eq("status","active"));
    if(!result.error){data=result.data||[];try{await cfCacheLedger(data);}catch(e){console.warn("Could not cache purchase list",e);}}
    else {const cached=await cfCachedLedger().catch(()=>null);if(cached&&Array.isArray(cached.rows)){data=cached.rows.filter(x=>x.status==="active");say("top","Live data could not be reached. Showing the last saved customer list from this device.",false);}else return $("list").innerHTML='<div class="bg-error-container rounded-xl p-4">Could not load purchases. Connect to the internet and try again.</div>';}
    try{
      const since=new Date(new Date().setHours(0,0,0,0)).toISOString();
      const paysRes=await sb.from("payments").select("purchase_id,created_at").eq("collected_by",S.me.id).gte("created_at",since).is("voided_at",null);
      const ids=[...new Set((paysRes.data||[]).map(p=>p.purchase_id))];let histRows=[],histErr=null;
      for(let i=0;i<ids.length&&!histErr;i+=80){const h=await sb.from("purchase_ledger").select("purchase_id,customer_id,product_id").in("purchase_id",ids.slice(i,i+80));if(h.error)histErr=h.error;else histRows=histRows.concat(h.data||[]);}
      const hist={data:histRows,error:histErr},pays=paysRes;
      if(!hist.error&&!pays.error){const map=new Map((hist.data||[]).map(x=>[String(x.purchase_id),x]));cfRecent=(pays.data||[]).map(p=>({...map.get(String(p.purchase_id)),created_at:p.created_at})).filter(x=>x.customer_id&&x.product_id);await cfCacheRecent(cfRecent);}
      else {const cached=await cfCachedRecent().catch(()=>null);cfRecent=cached?.rows||[];}
    }catch(e){const cached=await cfCachedRecent().catch(()=>null);cfRecent=cached?.rows||[];}
  }else{
    const cached=await cfCachedLedger().catch(()=>null);
    if(!cached||!Array.isArray(cached.rows))return $("list").innerHTML='<div class="bg-error-container rounded-xl p-4">No customer list is saved on this phone yet. Connect to the internet once, open Record payment, and try again.</div>';
    data=cached.rows.filter(x=>x.status==="active");
    const recent=await cfCachedRecent().catch(()=>null);cfRecent=recent?.rows||[];
    say("top","Offline mode: showing saved customer balances from "+new Date(cached.cached_at).toLocaleString()+". Confirm the balance when you reconnect. Payments remain pending until synced.",false);
  }
  const draw = () => {
    const q = $("q").value.trim().toLowerCase();
    $("qc").classList.toggle("hidden", !q);
    const rows = data.filter(r => !q || (r.customer_name || "").toLowerCase().includes(q) || (r.customer_phone || "").includes(q));
    $("list").innerHTML = rows.length ? rows.map(r => { const sel = S.selPurchase === r.purchase_id; return `
      <button type="button" data-id="${r.purchase_id}" class="pick w-full text-left bg-surface-container-lowest rounded-xl p-3.5 flex items-center justify-between gap-3 relative overflow-hidden ${sel ? "shadow-md" : "shadow-sm"} active:scale-[0.99] transition-all">
        ${sel ? `<span class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container"></span>` : ""}
        <span class="flex items-center gap-3 min-w-0">
          <span class="w-11 h-11 rounded-full ${sel ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface"} flex items-center justify-center text-title-md shrink-0">${esc(initials(r.customer_name))}</span>
          <span class="min-w-0"><span class="flex items-center gap-1.5"><b class="text-title-md text-on-surface truncate">${esc(r.customer_name)}</b>${sel ? ic("check_circle", "fill text-[18px] text-primary-container") : ""}</span>
          <span class="block text-body-md text-on-surface-variant truncate">${esc(r.product_name)} · ${esc(r.plan_name)}</span></span>
        </span>
        <span class="text-right shrink-0"><b class="block text-currency-item ${sel ? "text-tertiary-container" : "text-on-surface"}">${money(r.balance)}</b><span class="block text-label-md text-on-surface-variant uppercase">balance</span></span>
      </button>`; }).join("")
      : `<div class="bg-surface-container-low rounded-xl p-5 text-center"><div class="w-12 h-12 mx-auto rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">${ic("inventory_2", "text-[26px]")}</div><p class="text-title-md mt-2">No active purchases found.</p></div>`;
    $("list").querySelectorAll(".pick").forEach(el => el.onclick = () => { S.selPurchase = Number(el.dataset.id); S.dupAck = null; draw(); form(); });
  };
  const form = () => {
    const r = data.find(x => x.purchase_id === S.selPurchase);
    if (!r) { $("form").innerHTML = ""; return; }
    const bal = Number(r.balance), def = Math.min(Number(r.installment_amount), bal);
    const pct = Number(r.total_price) > 0 ? Math.min(100, Math.round(Number(r.amount_paid) / Number(r.total_price) * 100)) : 0;
    $("form").innerHTML = `<section class="${C.card} shadow-lg space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><h2 class="text-headline-lg-mobile text-on-surface truncate">${esc(r.customer_name)}</h2><p class="${C.mute} mt-0.5 truncate">${esc(r.product_name)} · ${esc(r.plan_name)}</p></div>
        ${r.customer_phone ? `<a href="tel:${esc(r.customer_phone)}" title="Call customer" class="w-11 h-11 rounded-full bg-surface-container-high text-primary flex items-center justify-center shrink-0 active:scale-95 transition-transform">${ic("call", "text-[20px]")}</a>` : ""}
      </div>
      <div class="bg-surface-container-low rounded-xl p-3 space-y-2">
        <div class="flex justify-between text-label-lg"><span>${r.payments_made} payments</span><span class="text-primary-container">${pct}% paid</span></div>
        <div class="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${pct}%"></div></div>
        <div class="flex items-end justify-between gap-2"><span class="${C.mute}">Paid ${money(r.amount_paid)}<br>of ${money(r.total_price)}</span><b class="text-currency-item text-tertiary-container text-right">${money(r.balance)} left</b></div>
      </div>
      <div id="dup"></div>
      <form id="pf" class="space-y-3.5">
        <div>
          <div class="flex items-center justify-between mb-1.5"><label class="text-label-lg text-on-surface" for="amt">Amount (GH₵)</label><span class="text-label-md text-primary-container">Installment: ${money(r.installment_amount)}</span></div>
          <div class="relative"><span class="absolute left-4 top-1/2 -translate-y-1/2 text-title-md font-extrabold pointer-events-none">GH₵</span>
          <input id="amt" type="number" inputmode="decimal" step="0.01" min="0.01" max="${bal}" value="${def}" required class="${C.inpBase} pl-[4.5rem] text-headline-lg-mobile font-extrabold"></div>
          <div class="grid grid-cols-2 gap-2 pt-2">
            <button type="button" id="cInst" class="min-h-[52px] rounded-lg bg-surface-container-high text-on-surface flex flex-col items-center justify-center leading-tight active:scale-95 transition-all"><span class="text-label-md opacity-80">Installment</span><span class="text-label-lg">${money(def)}</span></button>
            <button type="button" id="cFull" class="min-h-[52px] rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex flex-col items-center justify-center leading-tight active:scale-95 transition-all"><span class="text-label-md opacity-80">Full balance</span><span class="text-label-lg">${money(bal)}</span></button>
          </div>
        </div>
        <div><label class="${C.lbl}" for="pd">Date</label><input id="pd" type="date" class="${C.inp}" value="${today()}" required></div>
        <button class="${C.btn}" id="pb">${ic("verified", "fill text-[24px]")}<span>Save payment</span></button>
      </form><div id="pm"></div></section>`;
    (async () => { let d = false; try { if (navigator.onLine) { const x = await sb.rpc("check_recent_payment_duplicate", { p_customer_id: r.customer_id, p_product_id: r.product_id }); d = !x.error && x.data === true; } else d = cfIsRecentDuplicate(r, cfRecent) || await cfHasQueuedDuplicate(r); } catch (e) {}
      const el = $("dup"); if (d && el && S.selPurchase === r.purchase_id) el.innerHTML = `<div class="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl p-3 flex items-start gap-2">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">Already paid today: a payment for this customer and item was recorded earlier today. Check before saving another.</span></div>`; })();
    $("form").scrollIntoView({ behavior: "smooth" });
    $("cInst").onclick = () => { $("amt").value = def; };
    $("cFull").onclick = () => { $("amt").value = bal; };
    $("pf").onsubmit = async e => {
      e.preventDefault(); const b = $("pb"); busy(b, true);
      const amount = Number($("amt").value);
      const paymentDate = $("pd").value;
      if (!navigator.onLine) {
        if((cfIsRecentDuplicate(r,cfRecent)||await cfHasQueuedDuplicate(r))&&!cfDupAck(r,amount,paymentDate)){busy(b,false);return cfDupAsk(r,amount,paymentDate);}
        const queued = await queueCreditflexPayment({ purchase_id: r.purchase_id, customer_id:r.customer_id, product_id:r.product_id, amount, paid_on: paymentDate, collected_by: S.me.id, customer_name: r.customer_name, product_name: r.product_name });
        busy(b, false);
        if (!queued) return say("pm", "Could not save this payment on this device. Keep the app open and try again.");
        const who = r.customer_name;
        S.selPurchase = null; await viewPay();
        say("top", "Payment queued on this phone. It is NOT yet recorded on the server. It will sync when internet returns.", true);
        return;
      }
      const duplicateCheck=await sb.rpc("check_recent_payment_duplicate",{p_customer_id:r.customer_id,p_product_id:r.product_id});
      if(duplicateCheck.error){busy(b,false);return say("pm",cfErr(duplicateCheck.error));}
      if(duplicateCheck.data&&!cfDupAck(r,amount,paymentDate)){busy(b,false);return cfDupAsk(r,amount,paymentDate);}
      const offlineId = crypto.randomUUID();
      let { error } = await sb.from("payments").insert({ purchase_id: r.purchase_id, amount, paid_on: paymentDate, collected_by: S.me.id, offline_submission_id: offlineId });
      if (error && /offline_submission_id|column/i.test(error.message || "")) {
        ({ error } = await sb.from("payments").insert({ purchase_id: r.purchase_id, amount, paid_on: paymentDate, collected_by: S.me.id }));
      }
      busy(b, false);
      if (error) {
        const networkFailure = !navigator.onLine || /failed to fetch|network|load failed|timeout|connection/i.test(error.message || "");
        if (networkFailure) {
          const queued = await queueCreditflexPayment({ purchase_id: r.purchase_id, customer_id:r.customer_id, product_id:r.product_id, amount, paid_on: paymentDate, collected_by: S.me.id, customer_name: r.customer_name, product_name: r.product_name });
          if (queued) {
            const who = r.customer_name;
            S.selPurchase = null; await viewPay();
            say("top", "Connection failed. Payment queued on this phone; it is NOT yet recorded on the server. It will sync when internet returns.", true);
            return;
          }
        }
        return say("pm", cfErr(error));
      }
      const who = r.customer_name;
      S.selPurchase = null; await viewPay();
      say("top", `Payment of ${money(amount)} from ${who} saved.`, true); cfBuzz();
    };
  };
  $("q").oninput = draw;
  $("qc").onclick = () => { $("q").value = ""; draw(); $("q").focus(); };
  draw(); form();
}

/* ---------- register customer ---------- */
async function viewRegister() {
  const v = $("view"), mode = S.cmode || "find";
  v.innerHTML = `<h1 class="${C.h1}">Customers</h1>
    <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface-container-high" role="tablist">
      ${[["find", "Find & statement"], ["new", "New customer"]].map(([k, l]) => `<button type="button" role="tab" data-cm="${k}" aria-selected="${mode === k}" class="min-h-[44px] rounded-xl text-label-lg ${mode === k ? "bg-primary-container text-on-primary font-extrabold" : "text-on-surface-variant font-semibold"}">${l}</button>`).join("")}
    </div><div id="cbody" class="space-y-4"></div>`;
  v.querySelectorAll("[data-cm]").forEach(b => b.onclick = () => { S.cmode = b.dataset.cm; viewRegister(); });
  return mode === "find" ? cfStatements() : cfRegisterForm();
}
async function cfRegisterForm() {
  const v = $("cbody");
  v.innerHTML = `<h1 class="${C.h1}">New customer</h1>${loading}`;
  const [{ data: prods }, { data: plans }] = await Promise.all([
    sb.from("products").select("id,name,price").eq("in_stock", true).order("name"),
    sb.from("payment_plans").select("id,name,frequency,installments").order("id")
  ]);
  if (!prods || !prods.length) return v.innerHTML = `<h1 class="${C.h1}">New customer</h1><div class="bg-surface-container-low rounded-xl p-5 text-center"><div class="w-12 h-12 mx-auto rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">${ic("inventory_2", "text-[26px]")}</div><p class="${C.mute} mt-2">No products are in stock yet. An admin needs to add products in the Catalogue tab first.</p></div>`;
  v.innerHTML = `<h1 class="${C.h1}">Register a new customer</h1>
    <section class="${C.card}"><form id="rf" class="space-y-3.5">
      <div><label class="${C.lbl}" for="n">Full name</label><input id="n" class="${C.inp}" required minlength="2" autocomplete="off"></div>
      <div><label class="${C.lbl}" for="p">Phone</label><input id="p" class="${C.inp}" inputmode="tel" placeholder="0241234567"></div>
      <div><label class="${C.lbl}" for="l">Location</label><input id="l" class="${C.inp}" placeholder="Market, area or landmark"></div>
      <div><label class="${C.lbl}" for="pr">Product</label><select id="pr" class="${C.inp}">${prods.map(p => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)}</option>`).join("")}</select></div>
      <div><label class="${C.lbl}" for="pl">Payment plan</label><select id="pl" class="${C.inp}">${plans.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
      <div id="pv" class="bg-primary-fixed text-on-primary-fixed rounded-xl p-3 text-label-lg"></div>
      <button class="${C.btn}" id="rb">${ic("person_add", "text-[22px]")}<span>Register customer</span></button>
    </form><div id="rm"></div></section>`;
  const preview = () => {
    const p = prods.find(x => x.id == $("pr").value), pl = plans.find(x => x.id == $("pl").value);
    $("pv").textContent = `Pays ${money(p.price / pl.installments)} ${pl.frequency}, ${pl.installments} times.`;
  };
  $("pr").onchange = preview; $("pl").onchange = preview; preview();
  $("rf").onsubmit = async e => {
    e.preventDefault(); const b = $("rb"); busy(b, true);
    const { error } = await sb.rpc("register_customer", { p_full_name: $("n").value, p_phone: $("p").value, p_location: $("l").value, p_product_id: Number($("pr").value), p_plan_id: Number($("pl").value) });
    busy(b, false);
    if (error) return say("rm", cfErr(error));
    $("rf").reset(); preview(); say("rm", "Customer registered. You can now record their payments.", true);
  };
}


/* ---------- customer statement ---------- */
async function cfStatements() {
  const v = $("cbody");
  if (!navigator.onLine) return v.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">Customer statements need an internet connection. Reconnect and try again.</div>`;
  v.innerHTML = loading;
  const { data, error } = await cfLoadAll("customers", "id,full_name,phone,location", ["full_name", "id"]);
  if (error) return v.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  const all = data || [];
  v.innerHTML = `<section class="${C.card}"><label class="${C.lbl} flex items-center gap-1.5" for="sq">${ic("search", "text-[18px] text-primary")}Find a customer</label>
    <input id="sq" type="search" autocomplete="off" class="${C.inp}" placeholder="Type a name or phone"></section>
    <section id="slist" class="space-y-2"></section><div id="sbox"></div>`;
  const list = () => {
    const q = $("sq").value.trim().toLowerCase();
    const rows = all.filter(c => !q || (c.full_name || "").toLowerCase().includes(q) || (c.phone || "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))).slice(0, 40);
    $("slist").innerHTML = rows.length ? rows.map(c => `<button type="button" data-c="${c.id}" class="${C.card} w-full text-left flex items-center justify-between gap-3 min-h-[56px] active:scale-[0.99]"><span class="min-w-0"><b class="block text-body-lg truncate">${esc(c.full_name)}</b><span class="block ${C.mute} truncate">${esc(c.phone || "No phone")}${c.location ? " · " + esc(c.location) : ""}</span></span>${ic("receipt_long", "text-[22px] text-primary shrink-0")}</button>`).join("") : `<div class="bg-surface-container-low rounded-xl p-5 text-center ${C.mute}">${all.length ? "No customer matches that search." : "No customers yet."}</div>`;
    $("slist").querySelectorAll("[data-c]").forEach(b => b.onclick = () => cfStatement(all.find(c => String(c.id) === b.dataset.c)));
  };
  $("sq").oninput = list; list();
}
async function cfStatement(c) {
  const box = $("sbox"); box.innerHTML = loading; box.scrollIntoView({ behavior: "smooth", block: "start" });
  const led = await sb.from("purchase_ledger").select("purchase_id,product_name,plan_name,agent_name,total_price,installment_amount,amount_paid,balance,status,created_at").eq("customer_id", c.id).order("created_at", { ascending: false });
  if (led.error) return box.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(led.error))}</div>`;
  const purchases = led.data || [], ids = purchases.map(x => x.purchase_id);
  let pays = [];
  if (ids.length) {
    const r = await sb.from("payments").select("id,purchase_id,amount,paid_on,voided_at").in("purchase_id", ids).is("voided_at", null).order("paid_on", { ascending: true });
    if (r.error) return box.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(r.error))}</div>`;
    pays = r.data || [];
  }
  const tot = purchases.reduce((a, x) => a + Number(x.total_price), 0), paid = purchases.reduce((a, x) => a + Number(x.amount_paid), 0), bal = purchases.reduce((a, x) => a + Number(x.balance), 0);
  const text = () => ["Creditflex statement for " + c.full_name, ...purchases.map(x => "• " + x.product_name + ": paid " + money(x.amount_paid) + " of " + money(x.total_price) + ", balance " + money(x.balance)), "Total paid: " + money(paid), "Balance owed: " + money(bal), "Thank you."].join("\n");
  const wa = () => { let n = String(c.phone || "").replace(/[^0-9]/g, ""); if (n.startsWith("0")) n = "233" + n.slice(1); return "https://wa.me/" + n + "?text=" + encodeURIComponent(text()); };
  box.innerHTML = `<section class="${C.card} space-y-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h2 class="text-title-md truncate">${esc(c.full_name)}</h2><p class="${C.mute}">${esc(c.phone || "No phone")}${c.location ? " · " + esc(c.location) : ""}</p></div></div>
      <div class="grid grid-cols-3 gap-2 text-center"><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Price</div><div class="text-label-lg break-words">${money(tot)}</div></div><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Paid</div><div class="text-label-lg break-words">${money(paid)}</div></div><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Owes</div><div class="text-label-lg text-tertiary-container break-words">${money(bal)}</div></div></div>
      ${purchases.length ? purchases.map(x => { const mine = pays.filter(p => p.purchase_id === x.purchase_id), pct = Number(x.total_price) ? Math.min(100, Math.round(Number(x.amount_paid) / Number(x.total_price) * 100)) : 0;
        return `<div class="rounded-xl bg-surface-container-low p-3"><div class="flex justify-between gap-2"><b class="text-body-lg">${esc(x.product_name)}</b><span class="text-label-md rounded-full px-2.5 py-0.5 ${x.status === "active" ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}">${esc(x.status)}</span></div>
        <div class="${C.mute}">${esc(x.plan_name)} · installment ${money(x.installment_amount)} · agent ${esc(x.agent_name)}</div>
        <div class="h-2 rounded-full bg-surface-container-high mt-2 overflow-hidden"><div class="h-full bg-primary-container" style="width:${pct}%"></div></div><div class="${C.mute} mt-1">${pct}% paid · balance ${money(x.balance)}</div>
        <div class="divide-y divide-outline-variant/40 mt-2">${mine.length ? mine.map(p => `<div class="flex justify-between py-1.5 text-body-md"><span>${esc(p.paid_on)}</span><b>${money(p.amount)}</b></div>`).join("") : `<div class="${C.mute} py-1.5">No payments yet.</div>`}</div></div>`; }).join("") : `<p class="${C.mute}">This customer has no purchases yet.</p>`}
      <div class="grid grid-cols-2 gap-2"><a id="swa" class="${C.btn} text-center no-underline" href="${wa()}" target="_blank" rel="noopener">${ic("call", "text-[20px]")}<span>WhatsApp</span></a><button id="scsv" type="button" class="${C.btn2}">${ic("download", "text-[20px]")}<span>CSV</span></button></div></section>`;
  $("scsv").onclick = () => cfCsvDownload("statement-" + c.full_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + today() + ".csv", [["Customer", "Product", "Date", "Amount (GHS)", "Price (GHS)", "Balance (GHS)"], ...pays.map(p => { const x = purchases.find(y => y.purchase_id === p.purchase_id) || {}; return [c.full_name, x.product_name, p.paid_on, p.amount, x.total_price, x.balance]; })]);
}

/* ---------- catalogue ---------- */
async function viewCatalogue() {
  const v = $("view"), admin = S.me.role === "admin";
  v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1>${loading}`;
  const { data, error } = await cfLoadAll("products", "id,name,price,image_url,in_stock", ["name", "id"]);
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1>
    ${admin ? `<section class="${C.card}"><div class="grid grid-cols-2 gap-2"><button class="${C.btn}" id="add" type="button"><span>+ Add product</span></button><button class="${C.btn} !bg-secondary-container !text-on-secondary-container !shadow-none" id="addmany" type="button">${ic("photo_library", "text-[20px]")}<span>Add many</span></button></div><div id="pf"></div></section>` : ""}
    <div class="grid grid-cols-2 gap-3">${data.map(p => `<article class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" class="w-full aspect-square object-cover bg-surface-container-high">` : `<div class="w-full aspect-square bg-surface-container-high text-on-surface-variant flex flex-col items-center justify-center gap-1">${ic("image", "text-[32px]")}<span class="text-label-md">No photo</span></div>`}
      <div class="p-3 flex flex-col gap-1 flex-1"><b class="text-body-lg text-on-surface leading-tight">${esc(p.name)}</b><div class="text-currency-item text-primary-container">${money(p.price)}</div>
      ${p.in_stock ? "" : `<span class="self-start text-label-md bg-error-container text-on-error-container rounded-full px-2.5 py-0.5">Out of stock</span>`}
      ${admin ? `<button type="button" data-e="${p.id}" class="${C.btn2} mt-2 w-full">${ic("edit", "text-[18px]")}Edit</button>` : ""}</div></article>`).join("") || `<div class="col-span-2 bg-surface-container-low rounded-xl p-5 text-center ${C.mute}">No products yet.</div>`}</div>`;
  if (!admin) return;
  const open = p => {
    $("pf").innerHTML = `<form id="f" class="space-y-3.5 mt-4"><h3 class="text-title-md">${p ? "Edit product" : "New product"}</h3>
      <div><label class="${C.lbl}" for="pn">Name</label><input id="pn" class="${C.inp}" required value="${esc(p?.name)}"></div>
      <div><label class="${C.lbl}" for="pp">Price (GH₵)</label><input id="pp" class="${C.inp}" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${p ? p.price : ""}"></div>
      <div><label class="${C.lbl}" for="pi">Photo (JPG/PNG/WebP, max 2 MB)</label><input id="pi" type="file" accept="image/jpeg,image/png,image/webp" class="w-full text-body-md file:mr-3 file:rounded-lg file:border-0 file:bg-primary-fixed file:text-on-primary-fixed file:px-4 file:py-3 file:text-label-lg"></div>
      <label class="flex items-center gap-3 text-label-lg min-h-[44px]"><input type="checkbox" id="ps" class="w-6 h-6 accent-primary" ${!p || p.in_stock ? "checked" : ""}> In stock</label>
      <button class="${C.btn}" id="sv">Save</button></form><div id="fm"></div>`;
    $("f").onsubmit = async e => {
      e.preventDefault(); const b = $("sv"); busy(b, true);
      let image_url = p?.image_url ?? null;
      const file = $("pi").files[0];
      if (file) {
        if (file.size > 2097152) { busy(b, false); return say("fm", "Photo is bigger than 2 MB."); }
        const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
        const up = await sb.storage.from("product-images").upload(path, file, { contentType: file.type });
        if (up.error) { busy(b, false); return say("fm", cfErr(up.error)); }
        image_url = sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const row = { name: $("pn").value.trim(), price: Number($("pp").value), in_stock: $("ps").checked, image_url };
      const { error } = p ? await sb.from("products").update(row).eq("id", p.id) : await sb.from("products").insert(row);
      busy(b, false);
      if (error) return say("fm", cfErr(error));
      viewCatalogue();
    };
  };
  $("add").onclick = () => open(null);
  $("addmany").onclick = () => { S.tab = "bulk"; renderShell(); window.scrollTo(0, 0); };
  v.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { open(data.find(x => x.id == b.dataset.e)); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

/* ---------- staff (admin) ---------- */
async function viewStaff() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Staff</h1>${loading}`;
  const { data: raw, error } = await cfLoadAll("staff", "id,full_name,email,phone,role,status,supervisor_id,created_at", ["status","full_name","id"]);
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Staff</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  const rank = { pending: 0, active: 1, disabled: 2 };
  const data = [...raw].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const pending = data.filter(s => s.status === "pending").length;
  const sups = data.filter(s => s.status === "active" && ["supervisor", "admin"].includes(s.role));
  const sel = `${C.inp} !h-12`;
  v.innerHTML = `<h1 class="${C.h1}">Staff</h1><div id="sm"></div>
    ${pending ? `<div class="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl p-3 text-label-lg flex items-center gap-2">${ic("hourglass_top", "text-[20px]")}${pending} waiting for approval</div>` : ""}
    ${data.map(s => `<section class="${C.card} space-y-3" data-s="${s.id}">
      <div class="flex items-start justify-between gap-2"><div class="min-w-0 flex items-center gap-3"><span class="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-title-md shrink-0">${esc(initials(s.full_name))}</span><div class="min-w-0"><b class="block text-title-md truncate">${esc(s.full_name)}</b><span class="block ${C.mute} truncate">${esc(s.email || "")} ${esc(s.phone || "")}</span></div></div>
      <span class="shrink-0 text-label-md rounded-full px-2.5 py-1 ${s.status === "pending" ? "bg-tertiary-fixed text-on-tertiary-fixed" : s.status === "active" ? "bg-primary-fixed text-on-primary-fixed" : "bg-error-container text-on-error-container"}">${esc(s.status)}</span></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${C.lbl}">Status</label><select class="st ${sel}"><option value="pending">Pending</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
        <div><label class="${C.lbl}">Role</label><select class="ro ${sel}"><option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
      </div>
      <div><label class="${C.lbl}">Supervisor</label><select class="su ${sel}"><option value="">No supervisor</option>${sups.filter(x => x.id !== s.id).map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join("")}</select></div>
      <button class="${C.btn} sv" type="button">Save</button></section>`).join("")}`;
  v.querySelectorAll("[data-s]").forEach(el => {
    const s = data.find(x => x.id === el.dataset.s);
    el.querySelector(".st").value = s.status; el.querySelector(".ro").value = s.role; el.querySelector(".su").value = s.supervisor_id || "";
    el.querySelector(".sv").onclick = async () => {
      const { error } = await sb.rpc("admin_update_staff", { p_staff_id: s.id, p_status: el.querySelector(".st").value, p_role: el.querySelector(".ro").value, p_supervisor_id: el.querySelector(".su").value || null });
      say("sm", error ? cfErr(error) : `${s.full_name} updated.`, !error);
      if (!error) window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") { S.me = null; } if (ev === "PASSWORD_RECOVERY") { S.recovery = true; renderNewPassword(); } });
window.addEventListener("load", () => {
  try { document.fonts.load('24px "Material Symbols Outlined"', "payments").then(f => { if (f && f.length) document.documentElement.classList.add("icons"); }); } catch (e) {}
});
document.addEventListener("DOMContentLoaded", boot);
