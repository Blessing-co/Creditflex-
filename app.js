/* ===== core/config.js ===== */
/* Settings that never change while the app runs. */
const APP_BUILD = "2026-11-22 14:54";   // filled in by build.js
const SUPABASE_URL = "https://dsjuwmtojudcaulfqmyp.supabase.co";
const SUPABASE_KEY = "sb_publishable_pSzeeh2eHthcVfL7ZQzZug_xmdN9t2a";
const RECOVERY = /type=recovery/.test(location.hash);
const HASHERR = ((location.hash.match(/error_description=([^&]+)/) || [])[1] || "").replace(/\+/g, " ");
/* Network layer: every request gets a time limit; reads are retried a couple of times.
   Writes are never retried here (a payment that timed out is queued and re-sent safely
   with its offline_submission_id by the offline queue). */

;
/* ===== core/errors.js ===== */
/* Remembers the last few error messages so "Report a problem" can attach them. Nothing is sent unless the person sends a report. */
const CF_ERRORS = [];
function cfPushErr(s) { CF_ERRORS.push(new Date().toISOString().slice(11, 19) + " " + String(s).slice(0, 200)); if (CF_ERRORS.length > 5) CF_ERRORS.shift(); }
window.addEventListener("error", e => cfPushErr((e.message || "error") + " @" + String(e.filename || "").split("/").pop() + ":" + (e.lineno || 0)));
window.addEventListener("unhandledrejection", e => cfPushErr("promise: " + String((e.reason && e.reason.message) || e.reason)));

;
/* ===== core/net.js ===== */
/* Network layer: timeouts, retries, friendly error messages. */
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

;
/* ===== core/client.js ===== */
/* The one Supabase client the whole app shares. */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: "implicit" }, global: { fetch: cfFetch } });

const $app = document.getElementById("app");

;
/* ===== core/state.js ===== */
/* The app's shared state (who is signed in, which page is open). */
const S = { me: null, tab: "collections", signup: false, selPurchase: null, recovery: RECOVERY };

/* ---------- helpers ---------- */

;
/* ===== core/ui.js ===== */
/* Small helpers every screen uses: formatting, icons, messages, buttons, CSV download. */
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
function cfCsvDownload(name, rows) {
  const cell = v => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const body = rows.map(r => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* Reads EVERY row, 1000 at a time (Supabase silently stops at 1000 per request). */
function cfStaleNote(at) { return at ? `<div class="bg-surface-container-high text-on-surface-variant rounded-xl px-3 py-2 text-label-md flex items-center gap-2">${ic("info", "text-[18px]")}<span>Saved copy from ${esc(new Date(at).toLocaleString())}. It updates when you are online.</span></div>` : ""; }

/* ---------- shell ---------- */
/* Menu: 7 tabs for agents, 8 for admin. Everything else lives one tap deeper in Help, Manage or Settings. */

;
/* ===== core/security.js ===== */
/* Password rules. */
const CF_WEAK = ["password","12345678","123456789","1234567890","qwertyui","qwerty123","iloveyou","creditflex","password1","11111111","00000000","abcd1234","admin123"];
function cfPwIssue(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain both letters and numbers.";
  if (CF_WEAK.includes(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return "That password is too easy to guess. Choose a different one.";
  return null;
}
/* ---------- csv helper ---------- */

;
/* ===== core/pwa.js ===== */
/* Installable-app plumbing: icon font check and service worker registration. */
window.addEventListener("load", () => {
  try { document.fonts.load('24px "Material Symbols Outlined"', "payments").then(f => { if (f && f.length) document.documentElement.classList.add("icons"); }); } catch (e) {}
});
window.addEventListener("load",()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(e=>console.warn("Offline app shell unavailable",e));});

;
/* ===== core/eye.js ===== */
/* Show/hide eye on every password box (sign-in, sign-up, new password, change password). Add data-noeye to opt out. */
function cfEyeAttach(inp) {
  if (inp.dataset.eye || inp.dataset.noeye) return;
  inp.dataset.eye = "1";
  const wrap = document.createElement("div"); wrap.className = "relative";
  inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp); inp.classList.add("pr-12");
  const b = document.createElement("button");
  b.type = "button"; b.className = "cf-eye absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant";
  b.setAttribute("aria-label", "Show password"); b.innerHTML = ic("visibility", "text-[22px]");
  b.onclick = () => {
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.innerHTML = ic(show ? "visibility_off" : "visibility", "text-[22px]");
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    inp.focus();
  };
  wrap.appendChild(b);
}
(function () {
  const scan = () => document.querySelectorAll("input[type=password]:not([data-eye]):not([data-noeye])").forEach(cfEyeAttach);
  const start = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();

;
/* ===== models/data.js ===== */
/* MODEL: reading lists from the database (paging) and saved copies for offline reading. */
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
  const run = async () => { try { return { data: await cfFetchAll(table, select, order, filter), error: null }; } catch (error) { return { data: null, error }; } };
  return filter ? run() : cfRead("all:" + table + ":" + select, run);
}
function cfUuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);(window.crypto||{getRandomValues:a=>a.forEach((_,i)=>a[i]=Math.random()*256)}).getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);}
/* read-through cache: fresh data when online (and saved), the saved copy when the network fails */
async function cfRead(key,run){
 const k="read:"+(S.me?S.me.id:"x")+":"+key;
 if(!navigator.onLine){try{const c=await cfCacheGet(k);if(c&&c.data){window.cfStaleAt=c.cached_at;return {data:c.data,error:null,stale:c.cached_at};}}catch(x){}}
 const res=await run();
 if(!res.error){try{await cfCachePut(k,{data:res.data,cached_at:new Date().toISOString()});}catch(x){}return res;}
 try{const c=await cfCacheGet(k);if(c&&c.data){window.cfStaleAt=c.cached_at;return {data:c.data,error:null,stale:c.cached_at};}}catch(x){}
 return res;
}

;
/* ===== models/ledger.js ===== */
/* MODEL: running balance calculation. */
function cfRunning(pays, priceOf) {
  const sorted = [...pays].sort((x, y) => String(x.created_at || x.paid_on).localeCompare(String(y.created_at || y.paid_on)) || Number(x.id) - Number(y.id));
  const paid = {}, out = new Map();
  sorted.forEach(p => {
    const k = p.purchase_id, price = Number(priceOf(k) || 0);
    if (p.voided_at) { out.set(p.id, null); return; }
    paid[k] = Math.round(((paid[k] || 0) + Number(p.amount)) * 100) / 100;
    out.set(p.id, { paid: paid[k], balance: Math.round((price - paid[k]) * 100) / 100 });
  });
  return out;
}

/* ---------- SMS receipt (sent by a server function; the SMS key never reaches the phone) ---------- */

;
/* ===== models/auth.js ===== */
/* MODEL: sign-in, sessions and passwords (Supabase Auth). */
const Auth = {
  getSession: () => sb.auth.getSession(),
  getUser: () => sb.auth.getUser(),
  signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
  signUp: (email, password, fullName, phone) => sb.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } }),
  signOut: () => sb.auth.signOut(),
  sendResetLink: (email, redirectTo) => sb.auth.resetPasswordForEmail(email, { redirectTo }),
  setPassword: password => sb.auth.updateUser({ password }),
  onChange: fn => sb.auth.onAuthStateChange(fn)
};

;
/* ===== models/staff.js ===== */
/* MODEL: staff (admins and agents). Every function returns Supabase's { data, error }. */
const Staff = {
  me: id => sb.from("staff").select("id,full_name,email,phone,role,status,supervisor_id,onboarding_completed_at").eq("id", id).maybeSingle(),
  all: () => cfLoadAll("staff", "id,full_name,email,phone,role,status,supervisor_id,created_at", ["status","full_name","id"]),
  names: () => cfLoadAll("staff", "id,full_name", "id"),
  namesList: async () => (await cfFetchAll("staff", "id,full_name", "full_name")),
  namesIn: ids => sb.from("staff").select("id,full_name").in("id", ids),
  everyone: () => sb.from("staff").select("id,full_name"),
  activeAgents: () => sb.from("staff").select("id,full_name").eq("role", "agent").eq("status", "active").order("full_name"),
  adminUpdate: (id, status, role, supervisorId) => sb.rpc("admin_update_staff", { p_staff_id: id, p_status: status, p_role: role, p_supervisor_id: supervisorId || null }),
  completeOnboarding: () => sb.rpc("complete_agent_onboarding")
};

;
/* ===== models/products.js ===== */
/* MODEL: the product catalogue and product photos. */
const Products = {
  all: () => cfLoadAll("products", "id,name,price,image_url,in_stock", ["name", "id"]),
  allForBulk: () => cfLoadAll("products", "id,name,price,in_stock,image_url", ["name", "id"]),
  inStock: () => cfRead("reg:products", () => sb.from("products").select("id,name,price").eq("in_stock", true).order("name")),
  save: (row, id) => id ? sb.from("products").update(row).eq("id", id) : sb.from("products").insert(row),
  insertMany: rows => sb.from("products").insert(rows),
  insertOne: row => sb.from("products").insert(row),
  update: (id, patch) => sb.from("products").update(patch).eq("id", id),
  uploadPhoto: (path, file, type) => sb.storage.from("product-images").upload(path, file, { contentType: type }),
  photoUrl: path => sb.storage.from("product-images").getPublicUrl(path).data.publicUrl
};

;
/* ===== models/plans.js ===== */
/* MODEL: payment plans (daily, weekly ...). */
const Plans = {
  all: () => cfRead("reg:plans", () => sb.from("payment_plans").select("id,name,frequency,installments").order("id"))
};

;
/* ===== models/customers.js ===== */
/* MODEL: customers. */
const Customers = {
  all: () => cfLoadAll("customers", "id,full_name,phone,location", ["full_name", "id"]),
  registeredBetween: (from, to) => sb.from("customers").select("id,full_name,phone,location,registered_by,created_at").gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59.999").order("created_at", { ascending: false }).limit(200),
  register: (args, submissionId) => sb.rpc("register_customer", { ...args, p_submission_id: submissionId }),
  exportAll: () => cfFetchAll("customers", "id,full_name,phone,location,registered_by,created_at", "id")
};

;
/* ===== models/payments.js ===== */
/* MODEL: payments: recording, reviewing, reversing and listing. */
const Payments = {
  record: (row, withOfflineId) => sb.from("payments").insert(withOfflineId ? row : { purchase_id: row.purchase_id, amount: row.amount, paid_on: row.paid_on, collected_by: row.collected_by }).select("id").maybeSingle(),
  insertRaw: payload => sb.from("payments").insert(payload),
  findByOfflineId: id => sb.from("payments").select("id").eq("offline_submission_id", id).maybeSingle(),
  duplicateToday: (customerId, productId) => sb.rpc("check_recent_payment_duplicate", { p_customer_id: customerId, p_product_id: productId }),
  mineSince: (agentId, since) => sb.from("payments").select("purchase_id,created_at").eq("collected_by", agentId).gte("created_at", since).is("voided_at", null),
  forStatement: (customerId, ids) => cfRead("stmtp:" + customerId, () => sb.from("payments").select("id,purchase_id,amount,paid_on,created_at,voided_at").in("purchase_id", ids).is("voided_at", null).order("paid_on", { ascending: true })),
  recent: () => sb.from("payments").select("id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason").order("created_at", { ascending: false }).limit(150),
  auditLog: () => sb.from("payment_audit_log").select("*").order("event_at", { ascending: false }).limit(150),
  reverse: (paymentId, reason) => sb.rpc("void_payment", { p_payment_id: paymentId, p_reason: reason }),
  between: (from, to) => cfLoadAll("payments", "id,amount,paid_on,collected_by", ["paid_on", "id"], q => q.gte("paid_on", from).lte("paid_on", to).is("voided_at", null)),
  exportAll: () => cfFetchAll("payments", "id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason", "id"),
  sendSms: paymentId => sb.functions.invoke("send-payment-sms", { body: { payment_id: paymentId } })
};

;
/* ===== models/purchases.js ===== */
/* MODEL: purchases and what is still owed (the purchase_ledger view). */
const Purchases = {
  active: () => cfLoadAll("purchase_ledger", "purchase_id,customer_id,customer_name,customer_phone,product_id,product_name,plan_name,total_price,installment_amount,amount_paid,balance,payments_made,status", ["customer_name", "purchase_id"], q => q.eq("status", "active")),
  forCustomer: customerId => cfRead("stmt:" + customerId, () => sb.from("purchase_ledger").select("purchase_id,product_name,plan_name,agent_name,total_price,installment_amount,amount_paid,balance,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false })),
  historyFor: ids => sb.from("purchase_ledger").select("purchase_id,customer_id,product_id").in("purchase_id", ids),
  forReview: () => cfLoadAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,agent_name", "purchase_id"),
  exportPaymentsLedger: () => cfFetchAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,total_price", "purchase_id"),
  exportAll: () => cfFetchAll("purchase_ledger", "*", "purchase_id")
};

;
/* ===== models/summary.js ===== */
/* MODEL: totals for the Collections and Analytics pages. */
const Summary = {
  collections: (from, to) => sb.rpc("collection_summary", { p_from: from, p_to: to }),
  portfolio: () => sb.rpc("portfolio_summary")
};

;
/* ===== models/reports.js ===== */
/* MODEL: problem reports sent by agents to the admin. */
const Reports = {
  send: row => sb.from("problem_reports").insert(row),
  mine: staffId => sb.from("problem_reports").select("id,message,status,created_at").eq("reporter_id", staffId).order("created_at", { ascending: false }).limit(10),
  all: () => sb.from("problem_reports").select("*").order("created_at", { ascending: false }).limit(100),
  setStatus: (id, status) => sb.from("problem_reports").update({ status }).eq("id", id)
};

;
/* ===== models/announcements.js ===== */
/* MODEL: announcements, read receipts and phone-notification subscriptions. */
const Announcements = {
  listMine: () => cfRead("notices", () => sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(40)),
  myReads: staffId => cfRead("notice-reads", () => sb.from("announcement_reads").select("announcement_id").eq("staff_id", staffId)),
  listSent: () => sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(30),
  allReads: () => sb.from("announcement_reads").select("announcement_id,staff_id"),
  send: row => sb.from("announcements").insert(row).select("id").maybeSingle(),
  archive: id => sb.from("announcements").update({ archived_at: new Date().toISOString() }).eq("id", id),
  markRead: (ids, staffId) => sb.from("announcement_reads").upsert(ids.map(id => ({ announcement_id: id, staff_id: staffId })), { onConflict: "announcement_id,staff_id", ignoreDuplicates: true }),
  pushKey: () => sb.functions.invoke("push", { body: { action: "key" } }),
  pushSend: id => sb.functions.invoke("push", { body: { action: "send", announcement_id: id } }),
  saveSubscription: (endpoint, p256dh, auth, userAgent) => sb.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: userAgent }),
  removeSubscription: endpoint => sb.rpc("remove_push_subscription", { p_endpoint: endpoint })
};

;
/* ===== models/offline.js ===== */
/* MODEL: phone storage (IndexedDB), the offline queue and syncing it when the network returns. */
const cfDBName="creditflex-offline-v1",cfStore="pending-payments";
function cfOpenDB(){return new Promise((resolve,reject)=>{if(!("indexedDB" in window))return reject(Error("Offline storage is not supported on this browser."));const req=indexedDB.open(cfDBName,2);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(cfStore))db.createObjectStore(cfStore,{keyPath:"id"});if(!db.objectStoreNames.contains("purchase-cache"))db.createObjectStore("purchase-cache",{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function cfAll(){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const q=db.transaction(cfStore,"readonly").objectStore(cfStore).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
async function cfPut(row){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction(cfStore,"readwrite");tx.objectStore(cfStore).put(row);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfDelete(id){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction(cfStore,"readwrite");tx.objectStore(cfStore).delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfCachePut(id,value){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const tx=db.transaction("purchase-cache","readwrite");tx.objectStore("purchase-cache").put({id,...value});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
async function cfCacheGet(id){const db=await cfOpenDB();return new Promise((resolve,reject)=>{const q=db.transaction("purchase-cache","readonly").objectStore("purchase-cache").get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});}
async function cfCacheLedger(rows){if(!S.me)return;await cfCachePut("ledger:"+S.me.id,{rows,cached_at:new Date().toISOString()});}
async function cfCachedLedger(){return S.me?cfCacheGet("ledger:"+S.me.id):null;}
async function cfCacheRecent(rows){if(!S.me)return;await cfCachePut("recent:"+S.me.id,{rows,cached_at:new Date().toISOString()});}
async function cfCachedRecent(){return S.me?cfCacheGet("recent:"+S.me.id):null;}
function cfIsRecentDuplicate(row,recent){const day=today();return (recent||[]).some(p=>Number(p.customer_id)===Number(row.customer_id)&&Number(p.product_id)===Number(row.product_id)&&new Date(p.created_at).toLocaleDateString("en-CA")===day);}
async function cfHasQueuedDuplicate(row){const rows=await cfAll();return rows.some(p=>p.collected_by===S.me.id&&Number(p.customer_id)===Number(row.customer_id)&&Number(p.product_id)===Number(row.product_id)&&new Date(p.queued_at).toLocaleDateString("en-CA")===today());}
Object.assign(window,{cfRead,cfUuid,cfCacheLedger,cfCachedLedger,cfCacheRecent,cfCachedRecent,cfIsRecentDuplicate,cfHasQueuedDuplicate,cfAll});
window.queueCreditflexRegistration=async function(row){try{await cfPut({id:cfUuid(),kind:"register",owner:S.me.id,...row,queued_at:new Date().toISOString(),status:"pending"});return true;}catch(x){console.error("Offline queue error",x);return false;}};
window.queueCreditflexPayment=async function(row){try{await cfPut({id:cfUuid(),...row,queued_at:new Date().toISOString(),status:"pending"});return true;}catch(e){console.error("Offline queue error",e);return false;}};
async function cfSyncInner(){
 if(!navigator.onLine||!S.me)return;
 let rows;try{rows=await cfAll();}catch(e){return;}
 for(const row of rows){
  if(row.kind==="register"){
   if(row.owner!==S.me.id||row.status==="needs-attention")continue;
   try{
    const r=await Customers.register({p_full_name:row.p_full_name,p_phone:row.p_phone,p_location:row.p_location,p_product_id:row.p_product_id,p_plan_id:row.p_plan_id},row.id);
    if(!r.error){await cfDelete(row.id);continue;}
    const m=String(r.error.message||"");
    if(/failed to fetch|network|load failed|timeout|connection/i.test(m))break;
    await cfPut({...row,status:"needs-attention",last_error:m});
   }catch(x){break;}
   continue;
  }
  if(row.collected_by!==S.me.id)continue;
  try{
   const existing=await Payments.findByOfflineId(row.id);
   if(existing.data){await cfDelete(row.id);continue;}
   const payload={purchase_id:row.purchase_id,amount:row.amount,paid_on:row.paid_on,collected_by:row.collected_by,offline_submission_id:row.id};
   const result=await Payments.insertRaw(payload);
   if(!result.error){await cfDelete(row.id);continue;}
   const msg=String(result.error.message||"");
   if(/duplicate key|unique constraint/i.test(msg)){
    const check=await Payments.findByOfflineId(row.id);
    if(check.data){await cfDelete(row.id);continue;}
   }
   if(/failed to fetch|network|load failed|timeout|connection/i.test(msg))break;
   await cfPut({...row,status:"needs-attention",last_error:msg});
  }catch(e){break;}
 }
 try{localStorage.setItem("creditflex-last-sync",new Date().toISOString());}catch(e){}
 if(typeof window.refreshCreditflexQueueCount==="function")window.refreshCreditflexQueueCount();
}
let cfSyncBusy=false;
window.syncCreditflexOfflineQueue=async function(){if(cfSyncBusy)return;cfSyncBusy=true;try{await cfSyncInner();}finally{cfSyncBusy=false;}};
async function cfClearCache(){const db=await cfOpenDB();return new Promise((res,rej)=>{const tx=db.transaction("purchase-cache","readwrite");tx.objectStore("purchase-cache").clear();tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error);});}
window.addEventListener("online",()=>setTimeout(()=>syncCreditflexOfflineQueue(),500));

;
/* ===== routes.js ===== */
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
    ["credit",  "Credit & contact","call",   "Who built this and how to reach us"],
    ["report",  "Report a problem","bug_report","Tell the admin something is not working"] ] },
  settings:    { label: "Settings",       icon: "settings",               menu: true, view: () => { viewCreditflexSettings(); cfSettingsLinks(); } },
  manage:      { label: "Manage",         icon: "group",                  menu: true, admin: true, hub: [
    ["staff",     "Staff",              "group",        "Approve and manage agents"],
    ["financial", "Financial",          "receipt_long", "Review and reverse payments"],
    ["export",    "Export data",        "download",     "Download payments, customers and purchases"],
    ["announce",  "Announcements",      "campaign",     "Send messages to your agents"],
    ["reports",   "Problem reports",    "bug_report",   "Problems your agents have reported"],
    ["bulk",      "Add many products",  "upload_file",  "Upload products from a list or CSV"] ] },

  /* ----- pages reached from somewhere else (not in the menu) ----- */
  learn:     { parent: "help",        view: () => viewCreditflexLearn() },
  privacy:   { parent: "help",        view: () => viewCreditflexPrivacy() },
  credit:    { parent: "help",        view: () => viewCreditflexCredit() },
  report:    { parent: "help",        view: () => viewCreditflexReport() },
  reports:   { parent: "manage",      admin: true, view: () => viewCreditflexReports() },
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

;
/* ===== views/shell.js ===== */
/* VIEW: the page frame: header, bell, Menu button and menu, Back bar, and the area where the current page is drawn. */
function renderShell() {
  syncHistory();
  if (window.cfIdleStart) cfIdleStart();
  const admin = S.me.role === "admin";
  const items = menuRoutes(admin).map(([k, r]) => [k, r.label, r.icon]), par = parentOf(S.tab), cur = par || S.tab;
  const row = ([k, l, i]) => { const on = cur === k; return `<button data-t="${k}" type="button" role="menuitem" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left ${on ? "bg-primary-fixed text-on-primary-fixed font-extrabold" : "text-on-surface font-semibold"} active:bg-surface-container-high">${ic(i, "text-[22px] " + (on ? "fill" : ""))}<span class="text-label-lg">${l}</span></button>`; };
  $app.innerHTML = `
  <header class="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
    <div class="h-16 max-w-2xl mx-auto px-4 flex items-center justify-between gap-2 relative">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">${ic("payments", "fill text-[22px]")}</div>
        <div class="min-w-0 leading-tight"><div class="text-label-lg text-on-surface">Creditflex</div><div class="text-label-md text-on-surface-variant truncate">${esc(S.me.full_name)} · ${esc(S.me.role)}</div></div>
      </div>
      <div class="flex items-center gap-2">${admin ? "" : `<button id="bellBtn" type="button" aria-label="Announcements" class="relative min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface active:scale-95">${ic("notifications", "text-[24px]")}<span id="bellBadge" class="hidden absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center"></span></button>`}
      <button id="menuBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open menu" class="min-h-[48px] min-w-[48px] px-3 flex items-center justify-center gap-1 rounded-xl bg-primary-fixed text-on-primary-fixed active:scale-95">${ic("menu", "text-[24px]")}<span class="text-label-md">Menu</span></button></div>
      <nav id="menuPanel" role="menu" class="hidden absolute right-4 top-[60px] w-64 max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto rounded-2xl bg-surface shadow-xl border border-outline-variant/50 py-2 z-50">
        ${items.map(row).join("")}
        <div class="my-1 border-t border-outline-variant/50"></div>
        <button id="lo" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-error active:bg-error-container/50" type="button">${ic("logout", "text-[22px]")}<span class="text-label-lg">Sign out</span></button>
      </nav>
    </div>
  </header>
  <div id="backbar" class="max-w-2xl mx-auto px-4 pt-20"></div><main id="view" class="max-w-2xl mx-auto px-4 pt-2 pb-10 space-y-4"></main>`;
  if (par) { const pl = (ROUTES[par] || {}).label || "Back"; $("backbar").innerHTML = `<button id="back" type="button" class="min-h-[44px] flex items-center gap-1 text-label-lg text-primary">${ic("arrow_back", "text-[20px]")}<span>${pl}</span></button>`; $("back").onclick = () => goBack(par); } else $("backbar").style.paddingTop = "4.5rem";
  const panel = $("menuPanel"), mb = $("menuBtn");
  const close = () => { panel.classList.add("hidden"); mb.setAttribute("aria-expanded", "false"); };
  mb.onclick = e => { e.stopPropagation(); const open = panel.classList.toggle("hidden") === false; mb.setAttribute("aria-expanded", String(open)); };
  panel.onclick = e => e.stopPropagation();
  if (window.cfMenuClose) document.removeEventListener("click", window.cfMenuClose);
  window.cfMenuClose = close; document.addEventListener("click", close);
  $("lo").onclick = logout;
  if ($("bellBtn")) { $("bellBtn").onclick = () => go("inbox"); if (window.cfBellRefresh) cfBellRefresh(); }
  panel.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => go(b.dataset.t));
  drawRoute();
}

;
/* ===== views/hub.js ===== */
/* VIEW: a hub page (Help, Manage): a list of links to the pages inside it. */
function viewHub(key) {
  const r = ROUTES[key];
  $("view").innerHTML = `<h1 class="${C.h1}">${r.label}</h1><section class="${C.card} divide-y divide-outline-variant/40">${r.hub.map(([k, l, i, d]) => `<button type="button" data-go="${k}" class="w-full flex items-center gap-3 py-3 text-left min-h-[56px] active:bg-surface-container-high">${ic(i, "text-[24px] text-primary")}<span class="min-w-0 flex-1"><span class="block text-label-lg">${l}</span><span class="block text-label-md text-on-surface-variant">${d}</span></span></button>`).join("")}</section>`;
  $("view").querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const item = r.hub.find(x => x[0] === b.dataset.go); if (item && item[4]) return item[4](); go(b.dataset.go); });
}

;
/* ===== views/auth.js ===== */
/* VIEW: sign-in, new password and blocked-account screens. */
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
    const { error } = await Auth.sendResetLink(email, location.origin + location.pathname);
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
      const { error } = await Auth.signUp(email, password, $("fn").value.trim(), $("ph").value.trim());
      busy(b, false);
      if (error) return say("authMsg", error.message);
      S.signup = false;
      return renderLogin("Account created. Ask an admin to approve it, then sign in.");
    }
    const { error } = await Auth.signIn(email, password);
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
    const { error } = await Auth.setPassword($("np1").value);
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
  $("lo").onclick = () => logout();
}

/* ---------- password rules ---------- */

;
/* ===== controllers/session.js ===== */
/* CONTROLLER: start-up, loading the signed-in person, sign-out. */
async function boot() {
  const { data: { session } } = await Auth.getSession();
  if (!session) { let m; try { m = HASHERR ? decodeURIComponent(HASHERR) + ". Tap Forgot password to get a new link." : undefined; } catch (e) {} if (HASHERR) history.replaceState(null, "", location.pathname); return renderLogin(m); }
  if (S.recovery) return renderNewPassword();
  await loadMe();
}
async function loadMe() {
  const { data: { user } } = await Auth.getUser();
  if (!user) return renderLogin();
  const { data, error } = await Staff.me(user.id);
  if (error || !data) { await Auth.signOut(); return renderLogin("Could not load your staff account."); }
  S.me = data;
  if (data.status !== "active") return renderBlocked();
  renderShell();
  if (data.role === "agent" && !data.onboarding_completed_at) setTimeout(() => startCreditflexTour(), 450);
  setTimeout(() => syncCreditflexOfflineQueue(), 700);
}
async function logout(note) { try { if (window.cfPushSignOutCleanup) await cfPushSignOutCleanup(); } catch (e) {} try { await Auth.signOut(); } catch (e) {} S.me = null; if (window.cfIdleStop) cfIdleStop(); renderLogin(typeof note === "string" ? note : undefined); }

/* ---------- auth screens ---------- */

;
/* ===== controllers/collections.js ===== */
/* CONTROLLER: Collections page. */
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
    const { data, error } = await Summary.collections(f, t);
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
      Customers.registeredBetween(f, t),
      Staff.everyone()
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
  const { data: port } = await Summary.portfolio();
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

;
/* ===== controllers/pay.js ===== */
/* CONTROLLER: Record payment page (and SMS receipt button). */
const cfDupKey = (r, a, d) => r.purchase_id + "|" + a + "|" + d;
const cfDupAck = (r, a, d) => S.dupAck === cfDupKey(r, a, d);
function cfDupAsk(r, a, d) {
  S.dupAck = cfDupKey(r, a, d);
  const b = $("pb"), sp = b && b.querySelector("span"); if (sp) sp.textContent = "Save anyway";
  say("pm", "Heads up: a payment for " + r.customer_name + " and this item was already recorded today. Tap Save anyway only if the customer is really paying again.");
}
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
    const result=await Purchases.active();
    if(!result.error){data=result.data||[];try{await cfCacheLedger(data);}catch(e){console.warn("Could not cache purchase list",e);}}
    else {const cached=await cfCachedLedger().catch(()=>null);if(cached&&Array.isArray(cached.rows)){data=cached.rows.filter(x=>x.status==="active");say("top","Live data could not be reached. Showing the last saved customer list from this device.",false);}else return $("list").innerHTML='<div class="bg-error-container rounded-xl p-4">Could not load purchases. Connect to the internet and try again.</div>';}
    try{
      const since=new Date(new Date().setHours(0,0,0,0)).toISOString();
      const paysRes=await Payments.mineSince(S.me.id,since);
      const ids=[...new Set((paysRes.data||[]).map(p=>p.purchase_id))];let histRows=[],histErr=null;
      for(let i=0;i<ids.length&&!histErr;i+=80){const h=await Purchases.historyFor(ids.slice(i,i+80));if(h.error)histErr=h.error;else histRows=histRows.concat(h.data||[]);}
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
        ${S.me.role==="admin"?`<div><label class="${C.lbl}" for="pd">Date</label><input id="pd" type="date" class="${C.inp}" value="${today()}" required></div>`:`<p class="text-label-md text-on-surface-variant flex items-center gap-1.5">${ic("event","text-[18px]")}Recorded as today, ${esc(today())}</p>`}
        <button class="${C.btn}" id="pb">${ic("verified", "fill text-[24px]")}<span>Save payment</span></button>
      </form><div id="pm"></div></section>`;
    (async () => { let d = false; try { if (navigator.onLine) { const x = await Payments.duplicateToday(r.customer_id, r.product_id); d = !x.error && x.data === true; } else d = cfIsRecentDuplicate(r, cfRecent) || await cfHasQueuedDuplicate(r); } catch (e) {}
      const el = $("dup"); if (d && el && S.selPurchase === r.purchase_id) el.innerHTML = `<div class="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl p-3 flex items-start gap-2">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">Already paid today: a payment for this customer and item was recorded earlier today. Check before saving another.</span></div>`; })();
    $("form").scrollIntoView({ behavior: "smooth" });
    $("cInst").onclick = () => { $("amt").value = def; };
    $("cFull").onclick = () => { $("amt").value = bal; };
    $("pf").onsubmit = async e => {
      e.preventDefault(); const b = $("pb"); busy(b, true);
      const amount = Number($("amt").value);
      const paymentDate = S.me.role==="admin" && $("pd") ? $("pd").value : today();
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
      const duplicateCheck=await Payments.duplicateToday(r.customer_id,r.product_id);
      if(duplicateCheck.error){busy(b,false);return say("pm",cfErr(duplicateCheck.error));}
      if(duplicateCheck.data&&!cfDupAck(r,amount,paymentDate)){busy(b,false);return cfDupAsk(r,amount,paymentDate);}
      const offlineId = cfUuid();
      let { data: saved, error } = await Payments.record({ purchase_id: r.purchase_id, amount, paid_on: paymentDate, collected_by: S.me.id, offline_submission_id: offlineId }, true);
      if (error && /offline_submission_id|column/i.test(error.message || "")) {
        ({ data: saved, error } = await Payments.record({ purchase_id: r.purchase_id, amount, paid_on: paymentDate, collected_by: S.me.id }, false));
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
      if (saved && saved.id) cfSmsButton(saved.id, who);
    };
  };
  $("q").oninput = draw;
  $("qc").onclick = () => { $("q").value = ""; draw(); $("q").focus(); };
  draw(); form();
}

/* ---------- register customer ---------- */
function cfSmsButton(paymentId, who) {
  const top = $("top"); if (!top) return;
  top.insertAdjacentHTML("beforeend", `<button id="sms-btn" type="button" class="${C.btn2} w-full mt-2">${ic("call", "text-[20px]")}<span>Send SMS receipt to ${esc(who)}</span></button><div id="sms-msg" class="mt-1"></div>`);
  $("sms-btn").onclick = async () => {
    const b = $("sms-btn"); busy(b, true);
    let res;
    try { const r = await Payments.sendSms(paymentId); res = r.data; if (r.error) { try { res = await r.error.context.json(); } catch (e) { res = { ok: false, message: cfErr(r.error) }; } } }
    catch (e) { res = { ok: false, message: cfErr(e) }; }
    busy(b, false);
    const ok = res && res.ok;
    $("sms-msg").innerHTML = `<p class="text-label-md ${ok ? "text-primary" : "text-error"}">${esc((res && res.message) || "Could not send the SMS.")}</p>`;
    if (ok) b.remove();
  };
}

/* ---------- customer statement ---------- */

;
/* ===== controllers/customers.js ===== */
/* CONTROLLER: Customers page: find and statement, new customer. */
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
    Products.inStock(),
    Plans.all()
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
    const args = { p_full_name: $("n").value, p_phone: $("p").value, p_location: $("l").value, p_product_id: Number($("pr").value), p_plan_id: Number($("pl").value) };
    const subId = cfUuid();
    const keep = async () => { const pr = prods.find(x => x.id == args.p_product_id); const ok = await queueCreditflexRegistration({ id: subId, ...args, product_label: pr ? pr.name : "" }); busy(b, false); if (ok) { $("rf").reset(); preview(); say("rm", "No internet. Customer saved on this phone and will be registered when you are online. Record their payments after that.", true); } else say("rm", "Could not save on this phone. Try again when online."); };
    if (!navigator.onLine) return keep();
    const { error } = await Customers.register(args, subId);
    if (error && /failed to fetch|network|load failed|timeout|connection|fetch/i.test(String(error.message || ""))) return keep();
    busy(b, false);
    if (error) return say("rm", cfErr(error));
    $("rf").reset(); preview(); say("rm", "Customer registered. You can now record their payments.", true);
  };
}


/* running balance per purchase: payments in the order recorded; cancelled ones are not counted */
async function cfStatements() {
  const v = $("cbody");
  v.innerHTML = loading;
  const { data, error, stale } = await Customers.all();
  if (error) return v.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  const all = data || [];
  v.innerHTML = cfStaleNote(stale) + `<section class="${C.card}"><label class="${C.lbl} flex items-center gap-1.5" for="sq">${ic("search", "text-[18px] text-primary")}Find a customer</label>
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
  const led = await Purchases.forCustomer(c.id);
  if (led.error) return box.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(led.error))}</div>`;
  const purchases = led.data || [], ids = purchases.map(x => x.purchase_id);
  let pays = [];
  if (ids.length) {
    const r = await Payments.forStatement(c.id, ids);
    if (r.error) return box.innerHTML = `<div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(r.error))}</div>`;
    pays = r.data || [];
  }
  const run = cfRunning(pays, k => (purchases.find(y => y.purchase_id === k) || {}).total_price);
  const tot = purchases.reduce((a, x) => a + Number(x.total_price), 0), paid = purchases.reduce((a, x) => a + Number(x.amount_paid), 0), bal = purchases.reduce((a, x) => a + Number(x.balance), 0);
  const text = () => ["Creditflex statement for " + c.full_name, ...purchases.map(x => "• " + x.product_name + ": paid " + money(x.amount_paid) + " of " + money(x.total_price) + ", balance " + money(x.balance)), "Total paid: " + money(paid), "Balance owed: " + money(bal), "Thank you."].join("\n");
  const wa = () => { let n = String(c.phone || "").replace(/[^0-9]/g, ""); if (n.startsWith("0")) n = "233" + n.slice(1); return "https://wa.me/" + n + "?text=" + encodeURIComponent(text()); };
  box.innerHTML = cfStaleNote(led.stale) + `<section class="${C.card} space-y-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h2 class="text-title-md truncate">${esc(c.full_name)}</h2><p class="${C.mute}">${esc(c.phone || "No phone")}${c.location ? " · " + esc(c.location) : ""}</p></div></div>
      <div class="grid grid-cols-3 gap-2 text-center"><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Price</div><div class="text-label-lg break-words">${money(tot)}</div></div><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Paid</div><div class="text-label-lg break-words">${money(paid)}</div></div><div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Owes</div><div class="text-label-lg text-tertiary-container break-words">${money(bal)}</div></div></div>
      ${purchases.length ? purchases.map(x => { const mine = pays.filter(p => p.purchase_id === x.purchase_id), pct = Number(x.total_price) ? Math.min(100, Math.round(Number(x.amount_paid) / Number(x.total_price) * 100)) : 0;
        return `<div class="rounded-xl bg-surface-container-low p-3"><div class="flex justify-between gap-2"><b class="text-body-lg">${esc(x.product_name)}</b><span class="text-label-md rounded-full px-2.5 py-0.5 ${x.status === "active" ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high text-on-surface-variant"}">${esc(x.status)}</span></div>
        <div class="${C.mute}">${esc(x.plan_name)} · installment ${money(x.installment_amount)} · agent ${esc(x.agent_name)}</div>
        <div class="h-2 rounded-full bg-surface-container-high mt-2 overflow-hidden"><div class="h-full bg-primary-container" style="width:${pct}%"></div></div><div class="${C.mute} mt-1">${pct}% paid · balance ${money(x.balance)}</div>
        <div class="divide-y divide-outline-variant/40 mt-2">${mine.length ? mine.map(p => `<div class="flex justify-between gap-2 py-1.5 text-body-md"><span>${esc(p.paid_on)}</span><span class="text-on-surface-variant text-label-md">owes ${money((run.get(p.id) || {}).balance)}</span><b>${money(p.amount)}</b></div>`).join("") : `<div class="${C.mute} py-1.5">No payments yet.</div>`}</div></div>`; }).join("") : `<p class="${C.mute}">This customer has no purchases yet.</p>`}
      <div class="grid grid-cols-2 gap-2"><a id="swa" class="${C.btn} text-center no-underline" href="${wa()}" target="_blank" rel="noopener">${ic("call", "text-[20px]")}<span>WhatsApp</span></a><button id="scsv" type="button" class="${C.btn2}">${ic("download", "text-[20px]")}<span>CSV</span></button></div></section>`;
  $("scsv").onclick = () => cfCsvDownload("statement-" + c.full_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + today() + ".csv", [["Customer", "Product", "Date", "Amount paid (GHS)", "Price (GHS)", "Paid so far (GHS)", "Balance after this payment (GHS)"], ...pays.map(p => { const x = purchases.find(y => y.purchase_id === p.purchase_id) || {}, r = run.get(p.id) || {}; return [c.full_name, x.product_name, p.paid_on, p.amount, x.total_price, r.paid, r.balance]; })]);
}

/* ---------- catalogue ---------- */

;
/* ===== controllers/catalogue.js ===== */
/* CONTROLLER: Catalogue page. */
async function viewCatalogue() {
  const v = $("view"), admin = S.me.role === "admin";
  v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1>${loading}`;
  const { data, error } = await Products.all();
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1>
    ${admin ? `<section class="${C.card}"><div class="grid grid-cols-2 gap-2"><button class="${C.btn}" id="add" type="button"><span>+ Add product</span></button><button class="${C.btn} !bg-secondary-container !text-on-secondary-container !shadow-none" id="addmany" type="button">${ic("photo_library", "text-[20px]")}<span>Add many</span></button></div><div id="pf"></div></section>` : ""}
    <div class="grid grid-cols-2 gap-3">${data.map(p => `<article class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" decoding="async" class="w-full aspect-square object-cover bg-surface-container-high">` : `<div class="w-full aspect-square bg-surface-container-high text-on-surface-variant flex flex-col items-center justify-center gap-1">${ic("image", "text-[32px]")}<span class="text-label-md">No photo</span></div>`}
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
        const up = await Products.uploadPhoto(path, file, file.type);
        if (up.error) { busy(b, false); return say("fm", cfErr(up.error)); }
        image_url = Products.photoUrl(path);
      }
      const row = { name: $("pn").value.trim(), price: Number($("pp").value), in_stock: $("ps").checked, image_url };
      const { error } = await Products.save(row, p && p.id);
      busy(b, false);
      if (error) return say("fm", cfErr(error));
      viewCatalogue();
    };
  };
  $("add").onclick = () => open(null);
  $("addmany").onclick = () => { go("bulk"); };
  v.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { open(data.find(x => x.id == b.dataset.e)); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

/* ---------- staff (admin) ---------- */

;
/* ===== controllers/staff.js ===== */
/* CONTROLLER: Staff page (admin). */
async function viewStaff() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Staff</h1>${loading}`;
  const { data: raw, error } = await Staff.all();
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
      const { error } = await Staff.adminUpdate(s.id, el.querySelector(".st").value, el.querySelector(".ro").value, el.querySelector(".su").value || null);
      say("sm", error ? cfErr(error) : `${s.full_name} updated.`, !error);
      if (!error) window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

Auth.onChange(ev => { if (ev === "SIGNED_OUT") { S.me = null; } if (ev === "PASSWORD_RECOVERY") { S.recovery = true; renderNewPassword(); } });

;
/* ===== controllers/tour.js ===== */
/* CONTROLLER: guided tour. */
const cfSteps=[
 {title:"The menu",target:"collections",body:"Everything in Creditflex is reached from the Menu button at the top right. It lists every page and also holds Sign out.",task:"Tap the Menu button.",hl:"#menuBtn",watch:["#menuBtn","click"]},
 {title:"Collections",target:"collections",body:"Collections is the money that has come in. Pick a date range to see how much was collected and by whom. Only payments saved online are counted.",task:"Tap Show to load today's collections.",hl:"#go",watch:["#go","click"]},
 {title:"Find a customer",target:"register",pre:()=>{S.cmode="find";},body:"The Customers page is your address book. Open any customer to see their statement: what they bought, what they have paid and what they still owe. You can send it to them on WhatsApp.",task:"Type a name, then tap a customer.",hl:"#sq",watch:["[data-c]","click"]},
 {title:"Record a payment",target:"pay",body:"You will use this page every day. Record the money the moment a customer hands it over, so the balance is always true. Pick the customer, check the item and amount, then save. The app warns you if that customer already paid for the same item today.",task:"Type a customer's name, then tap it. Do not tap Save unless it is a real payment.",hl:"#q",watch:[".pick","click"]},
 {title:"Register a new customer",target:"register",pre:()=>{S.cmode="find";},body:"When someone buys an item on instalments, register them once here: name, phone, place, the product and the payment plan. The app works out how much they pay each time.",task:"Tap New customer to see the form. Only fill it in for a real sale.",hl:'[data-cm="new"]',watch:['[data-cm="new"]',"click"]},
 {title:"Catalogue",target:"catalogue",body:"The Catalogue shows every product and its full price, so you can answer customers when they ask what is available.",task:"Scroll and look around, then tap Next."},
 {title:"Analytics",target:"analytics",body:"Analytics shows totals and trends for the days you choose, for example which days brought in the most money.",task:"Tap 7 days.",hl:'[data-r="6"]',watch:['[data-r="6"]',"click"]},
 {title:"Settings and offline",target:"settings",body:"Choose how the app looks. If you ever have no internet, payments are kept safely on your phone and sent when you are back online. The admin only sees them after they have been sent.",task:"Tap Dark, then tap Light again.",hl:"#cf-theme",watch:["#cf-theme button","click"]},
 {title:"Account",target:"account",body:"Your details and password live here (Menu, Settings, Account). Change your password if you ever think someone else knows it."},
 {title:"Help and credit",target:"credit",body:"Need help? Call or WhatsApp us from this page. You can read How it works from Menu, then Help, at any time to refresh your memory."}
];
/* uuid that also works on older browsers */
let cfStep=0,cfActive=cfSteps;
let cfWatch=null,cfHlTimer=null,cfMin=false;
function cfClearCoach(){const m=document.getElementById("cf-tour");if(m)m.remove();if(cfWatch){document.removeEventListener(cfWatch.ev,cfWatch.fn,true);cfWatch=null;}if(cfHlTimer){clearInterval(cfHlTimer);cfHlTimer=null;}document.querySelectorAll(".cf-hl").forEach(e=>e.classList.remove("cf-hl"));document.body.classList.remove("cf-coaching");}
function cfModal(){cfClearCoach();const m=document.createElement("div");m.id="cf-tour";m.className="cf-coach";m.innerHTML='<section class="cf-coach-card" role="region" aria-label="Guided tour"><div class="cf-coach-top"><span id="cf-tour-count"></span><span><button id="cf-tour-min" type="button" aria-label="Hide or show tips">Hide</button><button id="cf-tour-all" type="button">Skip training</button></span></div><h2 id="cf-tour-title"></h2><div id="cf-coach-more"><p id="cf-tour-body"></p><p id="cf-tour-task"></p></div><div class="cf-tour-track"><div id="cf-tour-progress"></div></div><div class="cf-tour-actions"><button id="cf-tour-back" type="button">Back</button><button id="cf-tour-next" type="button">Next</button></div></section>';document.body.appendChild(m);document.body.classList.add("cf-coaching");return m;}
async function cfFinishTour(){cfClearCoach();try{const {error}=await Staff.completeOnboarding();if(error)console.warn("Could not save onboarding completion",error.message);else if(S.me)S.me.onboarding_completed_at=new Date().toISOString();}catch(e){console.warn(e);}go("collections");}
function cfShowStep(){
 const s=cfActive[cfStep];
 if(S.tab!==s.target||s.pre){if(s.pre)s.pre();go(s.target);}
 const m=cfModal(),last=cfStep===cfActive.length-1;
 m.querySelector("#cf-tour-count").textContent="STEP "+(cfStep+1)+" OF "+cfActive.length;
 m.querySelector("#cf-tour-title").textContent=s.title;
 m.querySelector("#cf-tour-body").textContent=s.body;
 const task=m.querySelector("#cf-tour-task");task.textContent=s.task?"Try it: "+s.task:"";task.style.display=s.task?"block":"none";
 m.querySelector("#cf-tour-progress").style.width=((cfStep+1)/cfActive.length*100)+"%";
 const next=m.querySelector("#cf-tour-next");next.textContent=last?"Finish":"Next";
 const back=m.querySelector("#cf-tour-back");back.disabled=cfStep===0;
 back.onclick=()=>{if(cfStep>0){cfStep--;cfShowStep();}};
 next.onclick=()=>{if(!last){cfStep++;cfShowStep();}else cfFinishTour();};
 m.querySelector("#cf-tour-all").onclick=cfFinishTour;
 const more=m.querySelector("#cf-coach-more"),minb=m.querySelector("#cf-tour-min");
 const applyMin=()=>{more.style.display=cfMin?"none":"block";minb.textContent=cfMin?"Show":"Hide";};
 minb.onclick=()=>{cfMin=!cfMin;applyMin();};applyMin();
 if(s.watch){const sel=s.watch[0];cfWatch={ev:s.watch[1],fn:e=>{if(e.target&&e.target.closest&&e.target.closest(sel)){task.textContent="Done. Nice work! Tap Next when you are ready.";task.classList.add("done");next.classList.add("ready");}}};document.addEventListener(cfWatch.ev,cfWatch.fn,true);}
 if(s.hl){let scrolled=false;const apply=()=>{const t=document.querySelector(s.hl);if(t&&!t.classList.contains("cf-hl")){document.querySelectorAll(".cf-hl").forEach(e=>e.classList.remove("cf-hl"));t.classList.add("cf-hl");if(!scrolled){scrolled=true;try{t.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}}}};apply();cfHlTimer=setInterval(apply,400);}
}
function cfWelcome(){
 let m=document.getElementById("cf-tour");if(m)m.remove();
 m=document.createElement("div");m.id="cf-tour";m.className="cf-tour-backdrop";
 m.innerHTML='<section class="cf-tour-card" role="dialog" aria-modal="true"><span id="cf-tour-count">WELCOME</span><h2 id="cf-tour-title">Quick tour of Creditflex</h2><p id="cf-tour-body">Tick the parts you want to practise, or skip it all. The tour shows you each page and lets you try it yourself. You can replay it any time in Settings.</p><div class="cf-pick">'+cfSteps.map((s,i)=>'<label><input type="checkbox" data-i="'+i+'" checked> <span>'+esc(s.title)+'</span></label>').join("")+'</div><button id="cf-w-learn" type="button" class="cf-linkbtn">New to this kind of business? Read the basics first</button><div class="cf-tour-actions"><button id="cf-w-skip" type="button">Skip entirely</button><button id="cf-w-go" type="button">Start tour</button></div></section>';
 document.body.appendChild(m);
 m.querySelector("#cf-w-skip").onclick=cfFinishTour;
 m.querySelector("#cf-w-learn").onclick=()=>{m.remove();go("learn");};
 m.querySelector("#cf-w-go").onclick=()=>{const picked=[...m.querySelectorAll("input:checked")].map(i=>cfSteps[Number(i.dataset.i)]);if(!picked.length)return cfFinishTour();cfActive=picked;cfStep=0;cfShowStep();};
}
window.startCreditflexTour=function(replay){if(!S.me)return;if(!replay&&(S.me.role!=="agent"||S.me.onboarding_completed_at))return;cfWelcome();};
const cfCoachCSS=document.createElement("style");cfCoachCSS.textContent='.cf-coach{position:fixed;left:0;right:0;bottom:0;z-index:1000;padding:10px 12px calc(10px + env(safe-area-inset-bottom));pointer-events:none}.cf-coach-card{pointer-events:auto;max-width:640px;margin:0 auto;background:#fff;color:#17211c;border-radius:20px;box-shadow:0 -4px 28px rgba(0,0,0,.28);padding:12px 14px;border:2px solid var(--cf-a,#08734f)}.cf-coach-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.cf-coach #cf-tour-count{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--cf-a,#08734f)}.cf-coach-top button{min-height:36px;padding:0 8px;font-size:13px;font-weight:700;text-decoration:underline;background:none;border:0;color:inherit}.cf-coach #cf-tour-title{font-size:18px;font-weight:800;margin:0}.cf-coach #cf-tour-body{font-size:14px;line-height:1.5;margin:4px 0}.cf-coach #cf-tour-task{font-size:14px;font-weight:800;color:var(--cf-a,#08734f);margin:4px 0}.cf-coach #cf-tour-task.done{color:#0a7d3b}.cf-coach .cf-tour-track{height:5px;background:#dfe9e3;border-radius:99px;overflow:hidden;margin:8px 0}.cf-coach .cf-tour-track>div{height:100%;background:var(--cf-a,#08734f);border-radius:99px}.cf-coach .cf-tour-actions{display:flex;gap:10px}.cf-coach .cf-tour-actions button{flex:1;min-height:44px;border-radius:12px;font-weight:800;border:1px solid #c9d6ce;background:#f2f6f3;color:#17211c}.cf-coach .cf-tour-actions button:disabled{opacity:.4}.cf-coach .cf-tour-actions #cf-tour-next{background:var(--cf-a,#08734f);color:#fff;border-color:var(--cf-a,#08734f)}.cf-coach .cf-tour-actions #cf-tour-next.ready{box-shadow:0 0 0 4px rgba(10,125,59,.3)}body.cf-coaching #view{padding-bottom:300px}.cf-hl{outline:4px solid #f5a300!important;outline-offset:3px;border-radius:12px;animation:cfpulse 1.2s ease-in-out infinite;scroll-margin-top:90px;scroll-margin-bottom:300px;position:relative;z-index:5}@keyframes cfpulse{0%,100%{outline-color:#f5a300}50%{outline-color:#ffd77a}}.cf-linkbtn{background:none!important;border:0!important;text-decoration:underline;font-size:14px!important;min-height:44px!important;font-weight:700;color:var(--cf-a,#08734f)!important;text-align:left}html[data-cf-theme="dark"] .cf-coach-card{background:#1d2923;color:#e4eee8}html[data-cf-theme="dark"] .cf-coach .cf-tour-track{background:#33463b}html[data-cf-theme="dark"] .cf-coach .cf-tour-actions button{background:#26372e;color:#e4eee8;border-color:#42564a}html[data-cf-theme="dark"] .cf-coach .cf-tour-actions #cf-tour-next{background:var(--cf-a,#08734f);color:#fff}html[data-cf-theme="dark"] .cf-coach #cf-tour-task.done{color:#6fe3a0}@media (prefers-reduced-motion:reduce){.cf-hl{animation:none}}';document.head.appendChild(cfCoachCSS);

;
/* ===== controllers/learn.js ===== */
/* CONTROLLER: How it works page. */
window.viewCreditflexLearn=function(){
 const v=$("view"),sec=(ic_,t,b)=>'<section class="'+C.card+' space-y-2"><div class="flex items-center gap-2">'+ic(ic_,"text-[22px] text-primary")+'<h2 class="text-title-md">'+t+'</h2></div>'+b+'</section>';
 const li=a=>'<ol class="list-decimal pl-5 space-y-1.5 '+C.mute+'">'+a.map(x=>'<li>'+x+'</li>').join("")+'</ol>';
 const ul=a=>'<ul class="list-disc pl-5 space-y-1.5 '+C.mute+'">'+a.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
 const term=(t,d)=>'<details class="rounded-xl bg-surface-container-low px-3 py-2"><summary class="font-bold cursor-pointer min-h-[32px] flex items-center">'+t+'</summary><p class="'+C.mute+' pt-1 pb-1">'+d+'</p></details>';
 v.innerHTML='<h1 class="'+C.h1+'">How it works</h1>'
 +sec("info","What is this business?","<p class=\""+C.mute+"\">Creditflex sells goods such as blenders and TVs to people who cannot pay the full price at once. Instead of paying everything on day one, the customer takes the item home and pays a small amount again and again, every day or every week, until the full price is paid. This is called selling on credit, or instalment selling.</p><p class=\""+C.mute+"\">You, the agent, are the link between the customer and the company. You register the customer, collect their small payments and record each one in this app. The money is only truly safe when the record is true.</p>")
 +sec("group","Who is who",ul(["<b>Customer</b>: the person who buys an item and pays it off in small amounts.","<b>Agent (you)</b>: registers customers and collects and records their payments.","<b>Admin</b>: the manager who approves agents, sees all the money collected and what is still owed, and fixes mistakes."]))
 +sec("school","A simple example","<p class=\""+C.mute+"\">Ama wants a blender that costs <b>GH₵ 240</b>. She cannot pay that today, so she picks a plan: <b>GH₵ 30 every week for 8 weeks</b>.</p>"+ul(["Week 0: you register Ama. She takes the blender home. She owes GH₵ 240.","Week 1: she pays GH₵ 30. You record it. She now owes GH₵ 210.","Week 3: she has paid GH₵ 90 in total. She owes GH₵ 150.","Week 8: the last GH₵ 30 is paid. She owes nothing and the purchase is complete."]))
 +sec("payments","Your day in the app",li(["Open <b>Customers</b> and register any new buyer once. Choose the product and the plan.","Visit your customers. When one pays, open <b>Record payment</b>, find them, check the item and the amount, and tap Save straight away.","At the end of the day open <b>Collections</b> to see your total. It should match the cash you collected.","Hand over the money to your admin the way you have been told to."]))
 +sec("verified","Golden rules",ul(["Record a payment only after you have received the money, and record it right away.","Check the customer's name and the item before you save. Two customers can have the same name.","Never record the same payment twice. The app warns you if that customer already paid for the item today. Tap Save anyway only if they really paid again.","If you make a mistake, tell your admin. Only the admin can cancel a payment, and every cancellation is written in a log.","No internet? You can still record payments. They wait on your phone and are sent when you are online again. The admin cannot see them until then.","Never share your password, and sign out on a phone that is not yours."]))
 +sec("search","Words you will see",'<div class="space-y-2">'+term("Product and price","What the customer is buying and the full price they must finish paying.")+term("Payment plan","How often and how many times the customer pays, for example daily for 30 days or weekly for 8 weeks.")+term("Instalment","One small payment. The app works it out from the price and the plan.")+term("Purchase","One customer buying one item on one plan. A customer can have several purchases.")+term("Balance","What the customer still owes on a purchase. It goes down with every payment.")+term("Collections","The total money collected in a period, shown per agent and per day.")+term("Statement","A summary for one customer of what they bought, paid and still owe. You can send it on WhatsApp.")+term("Cancelled (voided) payment","A wrong payment the admin has reversed. It no longer counts in totals, but the record stays in the log.")+'</div>')
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Ready to practise?</h2><p class="'+C.mute+'">The guided tour walks you through each page and lets you try it yourself.</p><button id="cf-learn-tour" class="'+C.btn+'" type="button">'+ic("school","text-[22px]")+'<span>Start the guided tour</span></button></section>';
 $("cf-learn-tour").onclick=()=>startCreditflexTour(true);
};

;
/* ===== controllers/analytics.js ===== */
/* CONTROLLER: Analytics page. */
window.viewCreditflexAnalytics=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Analytics</h1><section class="'+C.card+' space-y-3"><div class="grid grid-cols-2 gap-3"><div><label class="'+C.lbl+'">From</label><input id="cfa" type="date" class="'+C.inp+'" value="'+today()+'"></div><div><label class="'+C.lbl+'">To</label><input id="cfb" type="date" class="'+C.inp+'" value="'+today()+'"></div></div><div class="flex gap-2 flex-wrap" id="cf-chips"><button type="button" data-r="0" class="'+C.btn2+'">Today</button><button type="button" data-r="6" class="'+C.btn2+'">7 days</button><button type="button" data-r="29" class="'+C.btn2+'">30 days</button><button type="button" data-r="m" class="'+C.btn2+'">This month</button></div><button id="cf-run" class="'+C.btn+'">Refresh analytics</button><div id="cf-analytics-msg"></div></section><div id="cf-analytics-out">'+loading+'</div>';
 async function load(){const out=$("cf-analytics-out");out.innerHTML=loading;const {data,error}=await Payments.between($("cfa").value,$("cfb").value);if(error){out.innerHTML='<div class="bg-error-container rounded-xl p-4">'+esc(cfErr(error))+'</div>';return;}const rows=data||[],total=rows.reduce((n,p)=>n+Number(p.amount||0),0),byDay={};rows.forEach(p=>byDay[p.paid_on]=(byDay[p.paid_on]||0)+Number(p.amount||0));const days=Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0]));const max=Math.max(1,...days.map(x=>x[1]));let names={};try{const ids=[...new Set(rows.map(x=>x.collected_by).filter(Boolean))];if(ids.length){const staff=await Staff.namesIn(ids);(staff.data||[]).forEach(s=>names[s.id]=s.full_name);}}catch(e){}const byAgent={};rows.forEach(p=>{const k=p.collected_by||"unknown";byAgent[k]=(byAgent[k]||0)+Number(p.amount||0);});const queued=await cfAll().catch(()=>[]);let owed=0;try{const pr=await Summary.portfolio();owed=(pr.data||[]).reduce((n,x)=>n+Number(x.outstanding||0),0);}catch(e){}const topE=Object.entries(byAgent).sort((a,b)=>b[1]-a[1])[0];const topName=topE?(names[topE[0]]||(topE[0]===S.me.id?S.me.full_name:"Agent")):"-";out.innerHTML='<section class="grid grid-cols-2 gap-3"><article class="'+C.card+'"><div class="'+C.mute+'">Total collected</div><div class="text-2xl font-extrabold mt-1">'+money(total)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Payments recorded</div><div class="text-2xl font-extrabold mt-1">'+rows.length+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Average payment</div><div class="text-xl font-bold mt-1">'+money(rows.length?total/rows.length:0)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Waiting on this phone</div><div class="text-2xl font-extrabold mt-1">'+queued.length+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Still owed (all time)</div><div class="text-xl font-bold mt-1">'+money(owed)+'</div></article><article class="'+C.card+'"><div class="'+C.mute+'">Top agent</div><div class="text-xl font-bold mt-1">'+esc(topName)+'</div></article></section><section class="'+C.card+' space-y-3"><h2 class="text-title-md">Daily collections</h2>'+(days.length?days.map(([d,n])=>'<div><div class="flex justify-between text-sm mb-1"><span>'+esc(d)+'</span><b>'+money(n)+'</b></div><div class="h-2 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:'+(n/max*100)+'%"></div></div></div>').join(""):'<p class="'+C.mute+'">No payments in this date range.</p>')+'</section><section class="'+C.card+' space-y-2"><h2 class="text-title-md">By agent</h2>'+Object.entries(byAgent).sort((a,b)=>b[1]-a[1]).map(([id,n])=>'<div class="flex justify-between gap-3 border-b border-slate-200 py-2"><span>'+esc(names[id]|| (id===S.me.id?S.me.full_name:"Agent"))+'</span><b>'+money(n)+'</b></div>').join("")+'</section>'; }
 $("cf-chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{const t=new Date(),f=new Date();if(b.dataset.r==="m")f.setDate(1);else f.setDate(t.getDate()-Number(b.dataset.r));$("cfa").value=f.toLocaleDateString("en-CA");$("cfb").value=t.toLocaleDateString("en-CA");load();});
 $("cf-run").onclick=load;load();
};

;
/* ===== controllers/settings.js ===== */
/* CONTROLLER: Settings page, themes, install button. */
function cfSettingsLinks() { const t = setInterval(() => { const v = $("view"); if (!v || S.tab !== "settings" || v.querySelector("#cf-acct")) return clearInterval(t); if (!v.querySelector("h1")) return; clearInterval(t); v.insertAdjacentHTML("beforeend", `<section class="${C.card}"><button id="cf-acct" type="button" class="w-full flex items-center gap-3 min-h-[48px] text-left">${ic("manage_accounts", "text-[24px] text-primary")}<span class="flex-1"><span class="block text-label-lg">Account</span><span class="block text-label-md text-on-surface-variant">Your details and password</span></span></button></section>`); $("cf-acct").onclick = () => { go("account"); }; }, 60); setTimeout(() => clearInterval(t), 4000); }

/* ---------- collections ---------- */
window.viewCreditflexSettings=async function(){
 const v=$("view"),theme=localStorage.getItem("creditflex-theme")||"light",accent=localStorage.getItem("creditflex-accent")||"green",buzz=localStorage.getItem("creditflex-buzz")!=="off";
 const last=localStorage.getItem("creditflex-last-sync");
 const seg=(id,opts,cur)=>'<div class="cf-seg" id="'+id+'">'+opts.map(o=>'<button type="button" data-v="'+o[0]+'" class="'+(o[0]===cur?"on":"")+'">'+o[1]+'</button>').join("")+'</div>';
 const sw=Object.keys(CF_ACCENTS).map(k=>'<button type="button" class="cf-sw'+(k===accent?" on":"")+'" data-a="'+k+'" aria-label="'+k+' colour" style="background:'+CF_ACCENTS[k][0]+'"></button>').join("");
 v.innerHTML='<h1 class="'+C.h1+'">Settings</h1>'
 +(S.me.role==="admin"?"":'<section class="'+C.card+' space-y-2"><h2 class="text-title-md">Notifications</h2><div id="cf-push-slot"></div></section>')
 +'<section class="'+C.card+' space-y-2"><h2 class="text-title-md">Quick unlock</h2><p class="'+C.mute+'">'+(cfPinState().set?"You stay signed in. The PIN is asked only if you leave the app for a while.":"No PIN set yet. Set one to protect customer records on this phone.")+'</p><button id="cf-pin-chg" type="button" class="'+C.btn2+' w-full">'+ic("lock","text-[20px]")+'<span>'+(cfPinState().set?"Change PIN":"Set a PIN")+'</span></button>'+(cfPinState().set?'<button id="cf-pin-rm" type="button" class="'+C.btn2+' w-full">Remove PIN</button><div id="cf-bio-slot"></div>':"")+'</section>'
 +'<section class="'+C.card+' space-y-4"><div class="flex items-center gap-2">'+ic("palette","text-[22px] text-primary")+'<h2 class="text-title-md">Look and feel</h2></div><div><div class="'+C.lbl+'">Theme</div>'+seg("cf-theme",[["auto","Auto"],["light","Light"],["dark","Dark"]],theme)+'</div><div><div class="'+C.lbl+'">Accent colour</div><div class="flex gap-3 flex-wrap" id="cf-accents">'+sw+'</div></div><p id="cf-theme-msg" class="'+C.mute+'">Saved on this phone.</p></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Preferences</h2><label class="flex items-center justify-between gap-3 min-h-12"><span><b class="block">Vibrate when a payment is saved</b><span class="'+C.mute+'">A short buzz so you know it worked.</span></span><input id="cf-buzz" type="checkbox" class="w-6 h-6 accent-primary" '+(buzz?"checked":"")+'></label></section>'
 +'<section class="'+C.card+' space-y-3"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">'+ic("sync","text-[22px] text-primary")+'<h2 class="text-title-md">Offline payments</h2></div><span class="cf-pill '+(navigator.onLine?"ok":"off")+'">'+(navigator.onLine?"Online":"Offline")+'</span></div><p class="'+C.mute+'">Payments saved without internet wait here until they sync. The admin cannot see them before then.</p><p class="'+C.mute+'">Last sync: '+(last?esc(new Date(last).toLocaleString()):"not yet")+'</p><div id="cf-queue-list">'+loading+'</div><button id="cf-sync" class="'+C.btn+'">'+ic("sync","text-[22px]")+'<span>Sync now</span></button></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Help and device</h2><button id="cf-learn" type="button" class="'+C.btn2+' w-full">'+ic("info","text-[22px]")+'<span>How Creditflex works (for beginners)</span></button><button id="cf-replay" type="button" class="'+C.btn2+' w-full">'+ic("school","text-[22px]")+'<span>Start the guided tour</span></button><button id="cf-install" type="button" class="'+C.btn2+' w-full">'+ic("grid_view","text-[22px]")+'<span>Add Creditflex to home screen</span></button><p id="cf-install-msg" class="'+C.mute+'"></p><button id="cf-clear" type="button" class="'+C.btn2+' w-full">'+ic("delete","text-[22px]")+'<span>Clear saved customer list</span></button><p class="'+C.mute+'">Clearing does not delete payments waiting to sync.</p><p id="cf-clear-msg" class="'+C.mute+'"></p></section>'
 +'<section class="'+C.card+' space-y-1"><h2 class="text-title-md">About</h2><p class="'+C.mute+'">Creditflex Agents · version 2.1</p><p class="'+C.mute+'">Signed in as '+esc(S.me.full_name)+' ('+esc(S.me.role)+')</p></section>';
 $("cf-theme").querySelectorAll("button").forEach(b=>b.onclick=()=>{cfApplyTheme(b.dataset.v);$("cf-theme").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));$("cf-theme-msg").textContent="Theme saved on this phone.";});
 $("cf-accents").querySelectorAll("button").forEach(b=>b.onclick=()=>{cfApplyAccent(b.dataset.a);$("cf-accents").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));$("cf-theme-msg").textContent="Colour saved on this phone.";});
 if($("cf-push-slot")&&window.cfPushSlot)cfPushSlot("cf-push-slot");
 if($("cf-pin-chg"))$("cf-pin-chg").onclick=()=>cfPinChange();
 if($("cf-pin-rm"))$("cf-pin-rm").onclick=()=>{cfPinRemove();viewCreditflexSettings();};
 if($("cf-bio-slot"))cfBioSupported().then(ok=>{const s=$("cf-bio-slot");if(!ok||!s)return;const on=cfPinState().bio;s.innerHTML='<button id="cf-bio-btn" type="button" class="'+C.btn2+' w-full">'+(on?"Turn off fingerprint or face":"Use fingerprint or face to unlock")+'</button><div id="cf-bio-msg"></div>';$("cf-bio-btn").onclick=async()=>{try{if(on)cfBioDisable();else await cfBioEnable();viewCreditflexSettings();}catch(x){say("cf-bio-msg","Could not set up fingerprint or face on this phone.");}};});
 $("cf-buzz").onchange=e=>{try{localStorage.setItem("creditflex-buzz",e.target.checked?"on":"off");}catch(x){}if(e.target.checked)cfBuzz();};
 $("cf-sync").onclick=async()=>{const b=$("cf-sync");busy(b,true);await syncCreditflexOfflineQueue();busy(b,false);await cfRenderQueue();};
 $("cf-learn").onclick=()=>{go("learn");};
 $("cf-replay").onclick=()=>startCreditflexTour(true);
 $("cf-install").onclick=async()=>{if(cfInstall){cfInstall.prompt();cfInstall=null;}else $("cf-install-msg").textContent="Open your browser menu and choose Add to Home Screen (or Install app).";};
 $("cf-clear").onclick=async()=>{if(!confirm("Clear the saved customer list on this phone? You can reload it when online."))return;try{await cfClearCache();$("cf-clear-msg").textContent="Saved customer list cleared.";}catch(e){$("cf-clear-msg").textContent="Could not clear: "+e.message;}};
 await cfRenderQueue();
};
async function cfRenderQueue(){const el=$("cf-queue-list");if(!el)return;const rows=await cfAll().catch(()=>[]);el.innerHTML=rows.length?rows.map(r=>r.kind==="register"?'<div class="border-b border-slate-200 py-2"><div class="flex justify-between gap-2"><b>'+esc(r.p_full_name)+'</b><b>New customer</b></div><p class="text-sm opacity-70">'+esc(r.product_label||"Purchase")+' · '+esc(r.status)+'</p>'+(r.last_error?'<p class="text-sm text-red-700">'+esc(r.last_error)+'</p>':'')+'</div>':'<div class="border-b border-slate-200 py-2"><div class="flex justify-between gap-2"><b>'+esc(r.customer_name||"Customer")+'</b><b>'+money(r.amount)+'</b></div><p class="text-sm opacity-70">'+esc(r.product_name||"Purchase")+' · '+esc(r.paid_on)+' · '+esc(r.status)+'</p>'+(r.last_error?'<p class="text-sm text-red-700">'+esc(r.last_error)+'</p>':'')+'</div>').join(""):'<p class="'+C.mute+'">Nothing waiting to sync.</p>';}
window.refreshCreditflexQueueCount=cfRenderQueue;
const CF_ACCENTS={green:["#0b6b4f","#00513a","#a0f3cf"],blue:["#1d4ed8","#1e40af","#dbeafe"],purple:["#6d28d9","#5b21b6","#ede9fe"],orange:["#c2410c","#9a3412","#ffedd5"],rose:["#be123c","#9f1239","#ffe4e6"]};
function cfApplyTheme(theme){try{localStorage.setItem("creditflex-theme",theme);}catch(e){}const dark=theme==="dark"||(theme==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.cfTheme=dark?"dark":"light";}
function cfApplyAccent(name){const a=CF_ACCENTS[name]||CF_ACCENTS.green;try{localStorage.setItem("creditflex-accent",name);}catch(e){}const r=document.documentElement;if(name==="green"||!CF_ACCENTS[name])r.removeAttribute("data-cf-accent");else{r.dataset.cfAccent=name;r.style.setProperty("--cf-a",a[0]);r.style.setProperty("--cf-a2",a[1]);r.style.setProperty("--cf-t",a[2]);}const mt=document.querySelector('meta[name="theme-color"]');if(mt)mt.content=a[0];}
let cfInstall=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();cfInstall=e;});
const cfThemeCSS=document.createElement("style");cfThemeCSS.textContent='.cf-tour-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:16px}.cf-tour-card{width:100%;max-width:440px;background:#fff;color:#17211c;border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.32);display:flex;flex-direction:column;gap:16px}.cf-tour-card>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:12px}.cf-tour-card #cf-tour-count{font-size:12px;font-weight:800;letter-spacing:.08em;color:#08734f}.cf-tour-card button{min-height:48px;border-radius:12px;padding:0 14px;font-weight:700}.cf-tour-card #cf-tour-all{text-decoration:underline;font-size:13px}.cf-tour-card #cf-tour-title{font-size:22px;line-height:1.25;font-weight:800}.cf-tour-card #cf-tour-body{font-size:15px;line-height:1.65}.cf-tour-track{height:7px;background:#e5ece8;border-radius:99px;overflow:hidden}.cf-tour-track>div{height:100%;width:0;background:#08734f;border-radius:99px}.cf-tour-actions{display:flex;gap:10px}.cf-tour-actions button{flex:1;border:1px solid #cbd5d0;background:#f7faf8;color:#17211c}.cf-tour-actions #cf-tour-next,.cf-tour-actions #cf-w-go{background:#08734f;color:#fff;border-color:#08734f}html[data-cf-theme="dark"] body{background:#101714!important;color:#e4eee8!important}html[data-cf-theme="dark"] .bg-surface,html[data-cf-theme="dark"] .bg-surface-container-lowest,html[data-cf-theme="dark"] .bg-surface-container-low,html[data-cf-theme="dark"] .bg-surface-container-high,html[data-cf-theme="dark"] .bg-surface-container-highest{background-color:#1d2923!important;color:#e4eee8!important}html[data-cf-theme="dark"] .text-on-surface,html[data-cf-theme="dark"] .text-on-surface-variant{color:#e4eee8!important}html[data-cf-theme="dark"] input,html[data-cf-theme="dark"] select{background:#25352d!important;color:#fff!important;border-color:#415348!important}html[data-cf-theme="dark"] header,html[data-cf-theme="dark"] nav{background:rgba(20,30,25,.97)!important}html[data-cf-theme="dark"] .bg-white{background:#1d2923!important;color:#e4eee8!important}html[data-cf-theme="dark"] .text-slate-900{color:#e4eee8!important}html[data-cf-theme="dark"] .cf-tour-card{background:#1d2923;color:#e4eee8}.cf-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cf-pick label{display:flex;gap:8px;align-items:center;padding:10px;border:1px solid #cbd5d0;border-radius:12px;font-size:14px;font-weight:600}.cf-pick input{width:20px;height:20px;accent-color:#08734f}.cf-seg{display:flex;gap:4px;background:#e8eef0;border-radius:12px;padding:4px}.cf-seg button{flex:1;min-height:44px;border-radius:9px;font-weight:700}.cf-seg button.on{background:var(--cf-a,#0b6b4f);color:#fff}.cf-sw{width:44px;height:44px;border-radius:99px;border:3px solid transparent}.cf-sw.on{border-color:#fff;box-shadow:0 0 0 3px var(--cf-a,#0b6b4f)}.cf-pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800}.cf-pill.ok{background:#a0f3cf;color:#00210f}.cf-pill.off{background:#ffdbbb;color:#2b1700}html[data-cf-theme="dark"] .cf-seg{background:#26372e}html[data-cf-theme="dark"] .cf-pick label{border-color:#42564a}html[data-cf-theme="dark"] .cf-sw.on{border-color:#1d2923}html[data-cf-accent] .bg-primary-container{background-color:var(--cf-a)!important}html[data-cf-accent] .text-primary-container,html[data-cf-accent] .text-primary{color:var(--cf-a)!important}html[data-cf-accent] .border-primary-container{border-color:var(--cf-a)!important}html[data-cf-accent] .bg-primary-fixed{background-color:var(--cf-t)!important}html[data-cf-accent] .hover\\:bg-primary:hover{background-color:var(--cf-a2)!important}html[data-cf-accent] .accent-primary{accent-color:var(--cf-a)!important}html[data-cf-accent] .focus\\:ring-primary-container:focus{--tw-ring-color:var(--cf-a)!important}html[data-cf-accent] .cf-tour-actions #cf-tour-next,html[data-cf-accent] .cf-tour-actions #cf-w-go{background:var(--cf-a);border-color:var(--cf-a)}html[data-cf-accent] .cf-tour-track>div{background:var(--cf-a)}html[data-cf-theme="dark"] .cf-tour-actions button{background:#26372e;color:#e4eee8;border-color:#42564a}html[data-cf-theme="dark"] .cf-tour-actions #cf-tour-next{background:#08734f;color:#fff}';document.head.appendChild(cfThemeCSS);cfApplyTheme(localStorage.getItem("creditflex-theme")||"light");cfApplyAccent(localStorage.getItem("creditflex-accent")||"green");

;
/* ===== controllers/account.js ===== */
/* CONTROLLER: Account page. */
window.viewCreditflexAccount=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Account</h1><section class="'+C.card+' space-y-2"><div class="text-title-md">'+esc(S.me.full_name)+'</div><p class="'+C.mute+'">'+esc(S.me.email||"No email on file")+'</p><p class="'+C.mute+'">Role: '+esc(S.me.role)+'</p></section><section class="'+C.card+' space-y-3"><h2 class="text-title-md">Change password</h2><form id="cf-password-form" class="space-y-3"><div><label class="'+C.lbl+'" for="cf-current">Current password</label><input id="cf-current" type="password" autocomplete="current-password" class="'+C.inp+'" required></div><div><label class="'+C.lbl+'" for="cf-new">New password</label><input id="cf-new" type="password" autocomplete="new-password" minlength="8" class="'+C.inp+'" required><p class="'+C.mute+' mt-1">Use at least 8 characters with letters and numbers.</p></div><div><label class="'+C.lbl+'" for="cf-confirm">Confirm new password</label><input id="cf-confirm" type="password" autocomplete="new-password" minlength="8" class="'+C.inp+'" required></div><button id="cf-password-save" class="'+C.btn+'">Update password</button><div id="cf-password-msg"></div></form></section>';
 $("cf-password-form").onsubmit=async e=>{e.preventDefault();const b=$("cf-password-save"),current=$("cf-current").value,next=$("cf-new").value,confirmPass=$("cf-confirm").value;{const pwIssue=cfPwIssue(next);if(pwIssue)return say("cf-password-msg",pwIssue);}if(next!==confirmPass)return say("cf-password-msg","The new passwords do not match.");if(next===current)return say("cf-password-msg","Choose a password different from your current password.");busy(b,true);const auth=await Auth.signIn(S.me.email,current);if(auth.error){busy(b,false);return say("cf-password-msg","Current password could not be verified.");}const changed=await Auth.setPassword(next);busy(b,false);if(changed.error)return say("cf-password-msg",changed.error.message);$("cf-current").value="";$("cf-new").value="";$("cf-confirm").value="";say("cf-password-msg","Password updated successfully.",true);};
};

;
/* ===== controllers/financial.js ===== */
/* CONTROLLER: Financial review (admin). */
window.viewCreditflexFinancial=async function(){
 const v=$("view");v.innerHTML='<h1 class="'+C.h1+'">Financial review</h1><p class="'+C.mute+'">Admin-only payment review, reversals and audit history.</p><div id="cf-financial-list">'+loading+'</div>';
 const [pay,ledger,staff,audit]=await Promise.all([
  Payments.recent(),
  Purchases.forReview(),
  Staff.names(),
  Payments.auditLog()
 ]);
 if(pay.error){$("cf-financial-list").innerHTML='<div class="bg-error-container rounded-xl p-4">'+esc(cfErr(pay.error))+'</div>';return;}
 const purchases=new Map((ledger.data||[]).map(x=>[String(x.purchase_id),x])),people=new Map((staff.data||[]).map(x=>[x.id,x.full_name]));
 const rows=pay.data||[];
 $("cf-financial-list").innerHTML='<section class="'+C.card+' space-y-3"><div class="flex items-center justify-between gap-2"><h2 class="text-title-md">Recent payments</h2><span class="'+C.mute+'">'+rows.length+' shown</span></div>'+(rows.length?rows.map(p=>{const x=purchases.get(String(p.purchase_id))||{};return '<article class="border-b border-outline-variant/50 py-3 space-y-2"><div class="flex justify-between gap-3"><div class="min-w-0"><b>'+esc(x.customer_name||("Purchase #"+p.purchase_id))+'</b><p class="'+C.mute+'">'+esc(x.product_name||"")+' · '+esc(people.get(p.collected_by)||"Agent")+'</p><p class="'+C.mute+'">'+esc(p.paid_on)+' · '+esc(String(p.created_at||"").replace("T"," ").slice(0,16))+'</p></div><div class="text-right shrink-0"><b>'+money(p.amount)+'</b><p class="text-xs '+(p.voided_at?"text-red-600":"text-emerald-700")+'">'+(p.voided_at?"Reversed":"Recorded")+'</p></div></div>'+(p.voided_at?'<p class="text-sm text-red-700">Reason: '+esc(p.void_reason||"Not provided")+'</p>':'<button type="button" data-void="'+p.id+'" class="'+C.btn2+' w-full">Reverse payment</button>')+'</article>';}).join(""):'<p class="'+C.mute+'">No payments found.</p>')+'</section><section class="'+C.card+' mt-4 space-y-3"><h2 class="text-title-md">Financial audit trail</h2>'+(audit.error?'<p class="text-red-700">'+esc(audit.error.message)+'</p>':(audit.data||[]).length?(audit.data||[]).map(a=>'<article class="border-b border-outline-variant/50 py-2"><div class="flex justify-between gap-2"><b>'+esc(a.event_type)+'</b><span class="'+C.mute+'">Payment #'+esc(a.payment_id)+'</span></div><p class="'+C.mute+'">'+esc(people.get(a.actor_id)||"System")+' · '+esc(String(a.event_at||"").replace("T"," ").slice(0,16))+'</p><details class="mt-2"><summary class="text-sm underline">View recorded details</summary><pre class="text-xs whitespace-pre-wrap break-words mt-2">'+esc(JSON.stringify({old:a.old_payment,new:a.new_payment},null,2))+'</pre></details></article>').join(""):'<p class="'+C.mute+'">No audit entries found.</p>')+'</section>';
 document.querySelectorAll("[data-void]").forEach(btn=>btn.onclick=async()=>{const reason=prompt("Enter the reason for reversing this payment (at least 8 characters):");if(reason===null)return;if(reason.trim().length<8)return alert("The reason must be at least 8 characters.");if(!confirm("Reverse this payment? The action will be recorded in the financial audit trail."))return;btn.disabled=true;const result=await Payments.reverse(Number(btn.dataset.void),reason.trim());if(result.error){btn.disabled=false;return alert(result.error.message);}await viewCreditflexFinancial();});
};

;
/* ===== controllers/export.js ===== */
/* CONTROLLER: Export data (admin). */
window.viewCreditflexExport = async function () {
  const v = $("view");
  if (S.me.role !== "admin") { return go("collections"); }
  let last = null; try { last = localStorage.getItem("creditflex-last-export"); } catch (e) {}
  v.innerHTML = `<h1 class="${C.h1}">Export data</h1>
    <section class="${C.card} space-y-3"><p class="${C.mute}">Download your records as CSV files you can open in Excel or keep in Google Drive as a backup. Do this at least once a week.</p>
      <div class="text-label-md ${last ? "text-on-surface-variant" : "text-error"}">${last ? "Last export on this phone: " + esc(new Date(last).toLocaleString()) : "You have not exported anything from this phone yet."}</div>
      <button id="x-all" class="${C.btn}" type="button">${ic("download", "text-[22px]")}<span>Download everything</span></button>
      <div class="grid grid-cols-1 gap-2"><button id="x-pay" class="${C.btn2}" type="button">Payments</button><button id="x-cus" class="${C.btn2}" type="button">Customers</button><button id="x-pur" class="${C.btn2}" type="button">Purchases and balances</button></div>
      <div id="x-msg"></div></section>`;
  const stamp = () => today();
  const staffName = async () => { const m = {}; (await Staff.namesList()).forEach(x => m[x.id] = x.full_name); return m; };
  const jobs = {
    async pay() {
      const [pays, led, names] = await Promise.all([Payments.exportAll(), Purchases.exportPaymentsLedger(), staffName()]);
      const L = {}; led.forEach(x => L[x.purchase_id] = x);
      const run = cfRunning(pays, k => (L[k] || {}).total_price);
      cfCsvDownload("creditflex-payments-" + stamp() + ".csv", [["Payment ID", "Date", "Amount (GHS)", "Customer", "Phone", "Product", "Price (GHS)", "Paid so far (GHS)", "Balance after this payment (GHS)", "Collected by", "Recorded at", "Cancelled", "Cancel reason"], ...pays.map(p => { const l = L[p.purchase_id] || {}; return [p.id, p.paid_on, p.amount, l.customer_name, l.customer_phone, l.product_name, l.total_price, (run.get(p.id) || {}).paid ?? "", (run.get(p.id) || {}).balance ?? "", names[p.collected_by] || "", p.created_at, p.voided_at ? "yes" : "no", p.void_reason || ""]; })]);
      return pays.length;
    },
    async cus() {
      const [cs, names] = await Promise.all([Customers.exportAll(), staffName()]);
      cfCsvDownload("creditflex-customers-" + stamp() + ".csv", [["ID", "Name", "Phone", "Location", "Registered by", "Created"], ...cs.map(c => [c.id, c.full_name, c.phone, c.location, names[c.registered_by] || "", c.created_at])]);
      return cs.length;
    },
    async pur() {
      const led = await Purchases.exportAll();
      cfCsvDownload("creditflex-purchases-" + stamp() + ".csv", [["Purchase ID", "Customer", "Phone", "Product", "Plan", "Agent", "Total price", "Installment", "Paid", "Balance", "Payments made", "Start date", "Status"], ...led.map(x => [x.purchase_id, x.customer_name, x.customer_phone, x.product_name, x.plan_name, x.agent_name, x.total_price, x.installment_amount, x.amount_paid, x.balance, x.payments_made, x.start_date, x.status])]);
      return led.length;
    }
  };
  const run = async (names, btn) => {
    busy(btn, true); say("x-msg", "");
    try { const counts = []; for (const n of names) counts.push(await jobs[n]()); try { localStorage.setItem("creditflex-last-export", new Date().toISOString()); } catch (e) {} say("x-msg", "Done. " + counts.join(" + ") + " rows exported.", true); }
    catch (e) { say("x-msg", cfErr(e) || "Export failed."); }
    busy(btn, false);
  };
  $("x-all").onclick = () => run(["pay","cus","pur"], $("x-all"));
  $("x-pay").onclick = () => run(["pay"], $("x-pay"));
  $("x-cus").onclick = () => run(["cus"], $("x-cus"));
  $("x-pur").onclick = () => run(["pur"], $("x-pur"));
};

;
/* ===== controllers/credit.js ===== */
/* CONTROLLER: Credit and contact page. */
window.viewCreditflexCredit=function(){const v=$("view");
 v.innerHTML='<h1 class="'+C.h1+'">Credit</h1>'
 +'<section class="'+C.card+' space-y-3"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">'+ic("payments","fill text-[26px]")+'</div><div><div class="text-title-md">Creditflex Agents</div><div class="'+C.mute+'">Instalment collections for field agents</div></div></div></section>'
 +'<section class="'+C.card+' space-y-3"><h2 class="text-title-md">Built by</h2><div class="flex items-center gap-3"><span class="w-11 h-11 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-title-md">C</span><div><b class="block">Cronos (Peter)</b><span class="'+C.mute+'">Project owner and developer</span></div></div></section>'
 +'<section class="'+C.card+' space-y-2"><h2 class="text-title-md">Contact and support</h2><a class="'+C.btn2+' w-full" href="tel:+233206709055">'+ic("call","text-[22px]")+'<span>Call 020 670 9055</span></a><a class="'+C.btn2+' w-full" href="https://wa.me/233206709055" target="_blank" rel="noopener"><span>WhatsApp 020 670 9055</span></a><a class="'+C.btn2+' w-full" href="mailto:Blisscoenergy001@gmail.com"><span>Blisscoenergy001@gmail.com</span></a></section>'
 +'<p class="text-xs text-center opacity-60">Creditflex Agents · Ghana</p>';};

;
/* ===== controllers/report.js ===== */
/* CONTROLLER: Report a problem (everyone) and Problem reports (admin). */
(function () {
"use strict";
const when = iso => new Date(iso).toLocaleString();

window.viewCreditflexReport = async function () {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Report a problem</h1>
  <section class="${C.card} space-y-3"><p class="${C.mute}">Something not working, confusing or slow? Tell us what you were doing and what happened. We add your phone model, the app version and recent error messages to help fix it. We never send passwords or customer details.</p>
    <form id="rp-f" class="space-y-3"><div><label class="${C.lbl}" for="rp-m">What went wrong?</label><textarea id="rp-m" class="${C.inp}" rows="5" maxlength="1000" required placeholder="Example: I tapped Save payment and it kept loading"></textarea><div id="rp-c" class="${C.mute} text-right">0 / 1000</div></div>
    <button class="${C.btn}" id="rp-s">${ic("send", "text-[22px]")}<span>Send report</span></button><div id="rp-msg"></div></form></section>
  <div id="rp-mine"></div>`;
  $("rp-m").oninput = () => { $("rp-c").textContent = $("rp-m").value.length + " / 1000"; };
  $("rp-f").onsubmit = async e => {
    e.preventDefault(); const b = $("rp-s"); busy(b, true);
    const { error } = await Reports.send({ reporter_id: S.me.id, message: $("rp-m").value.trim(), page: String(S.tab).slice(0, 60), user_agent: navigator.userAgent.slice(0, 300), app_build: APP_BUILD, recent_errors: CF_ERRORS.join("\n").slice(0, 2000) || null });
    busy(b, false);
    if (error) return say("rp-msg", navigator.onLine ? cfErr(error) : "No internet. Your text is still here. Try again when you are online.");
    $("rp-f").reset(); $("rp-c").textContent = "0 / 1000"; say("rp-msg", "Thank you. Your report was sent.", true); mine();
  };
  async function mine() {
    const r = await Reports.mine(S.me.id); const box = $("rp-mine"); if (!box || r.error || !(r.data || []).length) return;
    box.innerHTML = `<h2 class="text-title-md px-1">Your recent reports</h2>` + r.data.map(x => `<section class="${C.card} space-y-1"><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.message)}</p><p class="${C.mute}">${esc(when(x.created_at))} · ${x.status === "done" ? "Fixed or answered" : "Waiting"}</p></section>`).join("");
  }
  mine();
};

window.viewCreditflexReports = async function () {
  if (S.me.role !== "admin") return go("collections");
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1>${loading}`;
  const [rp, st] = await Promise.all([Reports.all(), Staff.names()]);
  if (rp.error) return v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(rp.error))}</div>`;
  const names = {}; (st.data || []).forEach(s => names[s.id] = s.full_name);
  const list = rp.data || [];
  v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1>` + (list.length ? list.map(x => `<section class="${C.card} space-y-2 ${x.status === "new" ? "border-l-4 border-primary" : "opacity-80"}">
    <div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(names[x.reporter_id] || "Agent")}</b><span class="text-label-md rounded-full px-2.5 py-0.5 ${x.status === "new" ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high"}">${x.status === "new" ? "New" : "Done"}</span></div>
    <p class="text-body-md whitespace-pre-wrap break-words">${esc(x.message)}</p>
    <p class="${C.mute}">${esc(when(x.created_at))} · page: ${esc(x.page || "?")} · build ${esc(x.app_build || "?")}</p>
    <details><summary class="text-label-md text-primary min-h-[40px] flex items-center">Phone and error details</summary><p class="${C.mute} break-words">${esc(x.user_agent || "")}</p>${x.recent_errors ? `<pre class="text-[12px] whitespace-pre-wrap break-words bg-surface-container-high rounded-lg p-2 mt-1">${esc(x.recent_errors)}</pre>` : `<p class="${C.mute}">No error messages were recorded.</p>`}</details>
    <button type="button" data-st="${x.id}" data-to="${x.status === "new" ? "done" : "new"}" class="${C.btn2}">${x.status === "new" ? "Mark as done" : "Reopen"}</button></section>`).join("") : `<div class="${C.card} text-center ${C.mute}">No reports yet.</div>`);
  v.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => { busy(b, true); const { error } = await Reports.setStatus(Number(b.dataset.st), b.dataset.to); if (error) { busy(b, false); return alert(cfErr(error)); } viewCreditflexReports(); });
};
})();

;
/* ===== controllers/bulk.js ===== */
/* Creditflex bulk product upload (admin): paste a list, import a CSV file, or add many photos at once,
   check everything in one list, then save all in one go. */
(function () {
"use strict";

const MAX_ROWS = 200;
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const cleanName = s => String(s || "").replace(/\s+/g, " ").replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, "").trim();
const niceName = file => cleanName(file.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-]+/g, " ")).replace(/\b([a-z])/g, m => m.toUpperCase());

/* one pasted line -> { name, price } (price may be null) */
function parseLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  let name, priceText;
  if (raw.includes("\t")) {
    const parts = raw.split("\t").map(x => x.trim());
    name = parts[0]; priceText = parts[1] || "";
  } else {
    const m = raw.match(/^(.*?)[\s,;:=\-–—]*(?:GH[S₵C¢]?\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:GH[S₵C¢]|cedis?)?\s*$/i);
    if (m && cleanName(m[1])) { name = m[1]; priceText = m[2]; }
    else { name = raw; priceText = ""; }
  }
  const price = parsePrice(priceText);
  return { name: cleanName(name), price };
}
function parsePrice(t) {
  const n = Number(String(t || "").replace(/GH[S₵C¢]?|cedis?|₵|¢/gi, "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/* tiny CSV reader that understands quotes and , ; tab separators */
function parseCsv(text) {
  text = String(text || "").replace(/^﻿/, "");
  const first = text.split(/\r?\n/).find(l => l.trim()) || "";
  const delim = [",", ";", "\t"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
function csvToProducts(text) {
  const rows = parseCsv(text); if (!rows.length) return [];
  const head = rows[0].map(x => norm(x));
  const find = names => head.findIndex(h => names.includes(h));
  let ni = find(["name", "product", "productname", "item", "description"]), pi = find(["price", "amount", "cost", "ghs", "unitprice", "sellingprice"]), si = find(["instock", "stock", "available", "status"]);
  const hasHeader = ni >= 0 && pi >= 0;
  if (!hasHeader) { ni = 0; pi = 1; si = -1; }
  return (hasHeader ? rows.slice(1) : rows).map(r => {
    const stockText = si >= 0 ? norm(r[si]) : "";
    return { name: cleanName(r[ni]), price: parsePrice(r[pi]), in_stock: !["no", "false", "0", "out", "outofstock", "n"].includes(stockText) };
  }).filter(x => x.name);
}

/* shrink phone photos so they fit the 2 MB limit and upload quickly */
async function preparePhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use JPG, PNG or WebP photos.");
  if (file.size <= 400000) return file;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await createImageBitmap(file); }
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  for (const quality of [0.75, 0.6, 0.5]) {
    const blob = await new Promise(res => cv.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= 2000000) return blob;
  }
  throw new Error("Photo is too big even after shrinking.");
}

window.viewCreditflexBulk = async function () {
  const v = $("view");
  if (S.me.role !== "admin") { return go("collections"); }
  v.innerHTML = `<h1 class="${C.h1}">Add many products</h1>${loading}`;
  const ex = await Products.allForBulk();
  if (ex.error) return v.innerHTML = `<h1 class="${C.h1}">Add many products</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(ex.error))}</div>`;
  const existing = new Map((ex.data || []).map(p => [norm(p.name), p]));

  let rows = [], nextId = 1, onExisting = "skip", saving = false;
  const mk = o => ({ id: nextId++, name: "", price: null, in_stock: true, photo: null, preview: null, err: "", ...o });

  v.innerHTML = `<div class="flex items-center justify-between gap-2"><h1 class="${C.h1}">Add many products</h1></div>
  <button id="bk-back" type="button" class="${C.btn2} w-full justify-start">${ic("arrow_back", "text-[20px]")}<span>Back to catalogue</span></button>

  <section class="${C.card} space-y-3">
    <h2 class="text-title-md">1. Put your products in the list</h2>
    <p class="${C.mute}">Pick whichever is easiest. You can mix them. Nothing is saved until you press Save all.</p>
    <details class="rounded-xl bg-surface-container-low px-3 py-2" open><summary class="font-bold cursor-pointer min-h-[36px] flex items-center">Paste a list</summary>
      <p class="${C.mute} py-1">One product per line, with the price at the end. You can also copy two columns (name, price) straight from Excel or Google Sheets.</p>
      <textarea id="bk-paste" rows="6" class="w-full rounded-xl bg-surface p-3 text-body-md shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container" placeholder="Bruhm Blender 2-in-1, 240&#10;Nasco 32 inch TV 1500&#10;Gas cooker 4 burner - 1,200"></textarea>
      <button id="bk-paste-go" type="button" class="${C.btn} mt-2">${ic("add", "text-[22px]")}<span>Add these to the list</span></button></details>
    <details class="rounded-xl bg-surface-container-low px-3 py-2"><summary class="font-bold cursor-pointer min-h-[36px] flex items-center">Upload a CSV file</summary>
      <p class="${C.mute} py-1">Columns: <b>name</b>, <b>price</b> and optionally <b>in_stock</b> (yes/no). In Excel use Save As → CSV.</p>
      <div class="grid grid-cols-2 gap-2"><label class="${C.btn2} cursor-pointer">${ic("upload_file", "text-[20px]")}<span>Choose file</span><input id="bk-csv" type="file" accept=".csv,.txt,text/csv,text/plain" class="hidden"></label>
      <button id="bk-tpl" type="button" class="${C.btn2}">${ic("download", "text-[20px]")}<span>Template</span></button></div></details>
    <details class="rounded-xl bg-surface-container-low px-3 py-2"><summary class="font-bold cursor-pointer min-h-[36px] flex items-center">Add many photos</summary>
      <p class="${C.mute} py-1">Choose several photos at once. Each photo becomes a product named after its file (for example <i>gas-cooker.jpg</i> becomes "Gas Cooker"). If you already pasted that name, the photo is attached to it. Big photos are shrunk automatically.</p>
      <label class="${C.btn2} cursor-pointer w-full">${ic("photo_library", "text-[20px]")}<span>Choose photos</span><input id="bk-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden"></label></details>
    <div id="bk-note"></div>
  </section>

  <section class="${C.card} space-y-3">
    <div class="flex items-center justify-between gap-2"><h2 class="text-title-md">2. Check the list</h2><span id="bk-count" class="${C.mute}"></span></div>
    <label class="block"><span class="${C.lbl}">If a product with the same name already exists</span>
      <select id="bk-ex" class="${C.inp}"><option value="skip">Skip it (keep what is there)</option><option value="update">Update its price and photo</option></select></label>
    <div id="bk-rows" class="space-y-3"></div>
    <div class="grid grid-cols-2 gap-2"><button id="bk-blank" type="button" class="${C.btn2}">${ic("add", "text-[20px]")}<span>Blank row</span></button><button id="bk-clear" type="button" class="${C.btn2}">${ic("delete", "text-[20px]")}<span>Clear all</span></button></div>
  </section>

  <section class="${C.card} space-y-3"><h2 class="text-title-md">3. Save</h2>
    <button id="bk-save" type="button" class="${C.btn}">${ic("check_circle", "text-[22px]")}<span>Save all</span></button><div id="bk-msg"></div></section>`;

  const note = (t, ok) => say("bk-note", t, ok);
  const statusOf = (r, i) => {
    if (r.err) return ["err", r.err];
    if (!r.name || r.name.length < 2) return ["err", "Needs a name"];
    if (!(r.price > 0)) return ["err", "Needs a price"];
    const first = rows.findIndex(x => norm(x.name) === norm(r.name));
    if (first !== i) return ["skip", "Duplicate in this list: skipped"];
    const e = existing.get(norm(r.name));
    if (e) return onExisting === "update" ? ["upd", "Already exists: price will be updated"] : ["skip", "Already exists: skipped"];
    return ["new", "New product"];
  };
  const chipClass = { err: "bg-error-container text-on-error-container", skip: "bg-surface-container-high text-on-surface-variant", upd: "bg-tertiary-fixed text-on-tertiary-fixed", new: "bg-primary-fixed text-on-primary-fixed" };
  const paintChips = () => {
    rows.forEach((r, i) => { const el = v.querySelector(`[data-chip="${r.id}"]`); if (!el) return; const [k, t] = statusOf(r, i); el.className = "text-label-md rounded-full px-2.5 py-0.5 inline-block " + chipClass[k]; el.textContent = t; });
    const ok = rows.filter((r, i) => ["new", "upd"].includes(statusOf(r, i)[0])).length;
    $("bk-count").textContent = rows.length ? rows.length + " in list · " + ok + " to save" : "";
    $("bk-save").querySelector("span").textContent = ok ? "Save all (" + ok + ")" : "Save all";
  };
  const paintRows = () => {
    $("bk-rows").innerHTML = rows.length ? rows.map(r => `<div class="rounded-xl bg-surface-container-low p-3 space-y-2" data-row="${r.id}">
      <div class="flex gap-3 items-start">
        <label class="shrink-0 w-16 h-16 rounded-xl bg-surface-container-high overflow-hidden flex items-center justify-center cursor-pointer text-on-surface-variant" title="Add or change photo">
          ${r.preview ? `<img src="${r.preview}" alt="" class="w-full h-full object-cover">` : ic("image", "text-[28px]")}<input data-photo="${r.id}" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"></label>
        <div class="flex-1 min-w-0 space-y-2">
          <input data-name="${r.id}" class="${C.inp} !h-12" placeholder="Product name" value="${esc(r.name)}" autocomplete="off">
          <div class="flex gap-2 items-center"><input data-price="${r.id}" class="${C.inp} !h-12" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="Price GH₵" value="${r.price ?? ""}">
          <label class="flex items-center gap-1.5 text-label-md shrink-0"><input data-stock="${r.id}" type="checkbox" class="w-6 h-6 accent-primary" ${r.in_stock ? "checked" : ""}>In stock</label></div>
        </div>
        <button type="button" data-del="${r.id}" class="shrink-0 min-w-[44px] min-h-[44px] rounded-xl text-error flex items-center justify-center" aria-label="Remove row">${ic("delete", "text-[22px]")}</button>
      </div><span data-chip="${r.id}"></span></div>`).join("") : `<div class="bg-surface-container-lowest rounded-xl p-5 text-center ${C.mute}">The list is empty. Use one of the three ways above.</div>`;
    const byId = id => rows.find(r => String(r.id) === id);
    $("bk-rows").querySelectorAll("[data-name]").forEach(el => el.oninput = () => { byId(el.dataset.name).name = el.value; byId(el.dataset.name).err = ""; paintChips(); });
    $("bk-rows").querySelectorAll("[data-price]").forEach(el => el.oninput = () => { byId(el.dataset.price).price = parsePrice(el.value); byId(el.dataset.price).err = ""; paintChips(); });
    $("bk-rows").querySelectorAll("[data-stock]").forEach(el => el.onchange = () => { byId(el.dataset.stock).in_stock = el.checked; });
    $("bk-rows").querySelectorAll("[data-del]").forEach(el => el.onclick = () => { rows = rows.filter(r => String(r.id) !== el.dataset.del); paintRows(); });
    $("bk-rows").querySelectorAll("[data-photo]").forEach(el => el.onchange = async () => {
      const r = byId(el.dataset.photo), f = el.files[0]; if (!f) return;
      try { r.photo = await preparePhoto(f); if (r.preview) URL.revokeObjectURL(r.preview); r.preview = URL.createObjectURL(r.photo); r.err = ""; } catch (e) { r.err = e.message; }
      paintRows();
    });
    paintChips();
  };
  const addRows = list => {
    const room = MAX_ROWS - rows.length;
    list.slice(0, room).forEach(o => rows.push(mk(o)));
    paintRows();
    return list.length > room ? list.length - room : 0;
  };

  $("bk-back").onclick = () => { go("catalogue"); };
  $("bk-ex").onchange = e => { onExisting = e.target.value; paintChips(); };
  $("bk-blank").onclick = () => { addRows([{}]); const last = $("bk-rows").querySelector("[data-row]:last-child [data-name]"); if (last) last.focus(); };
  $("bk-clear").onclick = () => { if (rows.length && !confirm("Remove everything from the list?")) return; rows.forEach(r => r.preview && URL.revokeObjectURL(r.preview)); rows = []; paintRows(); say("bk-note", ""); };

  $("bk-paste-go").onclick = () => {
    const parsed = $("bk-paste").value.split(/\r?\n/).map(parseLine).filter(Boolean).filter(x => x.name);
    if (!parsed.length) return note("Type or paste at least one product first.");
    const cut = addRows(parsed); const noPrice = parsed.filter(x => !x.price).length;
    $("bk-paste").value = "";
    note(parsed.length + " added to the list." + (noPrice ? " " + noPrice + " have no price yet. Fill them in below." : "") + (cut ? " " + cut + " were left out because the list is limited to " + MAX_ROWS + "." : ""), !noPrice && !cut);
  };
  $("bk-csv").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1000000) return note("That file is too big for a product list.");
    try { const parsed = csvToProducts(await f.text()); if (!parsed.length) return note("No products found. Check the columns are called name and price."); const cut = addRows(parsed); note(parsed.length + " products read from " + f.name + "." + (cut ? " " + cut + " left out (limit " + MAX_ROWS + ")." : ""), !cut); }
    catch (err) { note("Could not read that file."); }
    e.target.value = "";
  };
  $("bk-tpl").onclick = () => cfCsvDownload("creditflex-products-template.csv", [["name","price","in_stock"], ["Bruhm Blender 2-in-1", 240, "yes"], ["Nasco 32 inch TV", 1500, "yes"], ["Gas cooker 4 burner", 1200, "no"]]);
  $("bk-photos").onchange = async e => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    note("Preparing " + files.length + " photo" + (files.length > 1 ? "s" : "") + "…", true);
    let matched = 0, fresh = 0, failed = 0;
    for (const f of files) {
      let blob; try { blob = await preparePhoto(f); } catch (err) { failed++; continue; }
      const guess = niceName(f.name), g = norm(guess);
      const row = rows.find(r => !r.photo && r.name && norm(r.name).length >= 3 && g.length >= 3 && (norm(r.name) === g || norm(r.name).includes(g) || g.includes(norm(r.name))));
      if (row) { row.photo = blob; row.preview = URL.createObjectURL(blob); matched++; }
      else if (rows.length < MAX_ROWS) { rows.push(mk({ name: guess, photo: blob, preview: URL.createObjectURL(blob) })); fresh++; }
    }
    paintRows();
    note(matched + " photo" + (matched === 1 ? "" : "s") + " matched to products, " + fresh + " new row" + (fresh === 1 ? "" : "s") + " created" + (failed ? ", " + failed + " could not be used (use JPG, PNG or WebP)" : "") + ". Now add the prices below.", !failed);
  };

  $("bk-save").onclick = async () => {
    if (saving) return;
    const todo = rows.map((r, i) => ({ r, k: statusOf(r, i)[0] }));
    if (todo.some(x => x.k === "err")) { paintChips(); return say("bk-msg", "Fix the rows marked in red first (every product needs a name and a price)."); }
    const news = todo.filter(x => x.k === "new").map(x => x.r), upds = todo.filter(x => x.k === "upd").map(x => x.r);
    if (!news.length && !upds.length) return say("bk-msg", "Nothing to save yet.");
    saving = true; const btn = $("bk-save"); busy(btn, true); say("bk-msg", "");
    const prog = t => say("bk-msg", t, true);
    const result = { added: 0, updated: 0, photosFailed: 0, failed: 0 };
    try {
      /* 1. upload photos (3 at a time) */
      const withPhotos = [...news, ...upds].filter(r => r.photo); let done = 0;
      const queue = withPhotos.slice();
      await Promise.all([0, 1, 2].map(async () => {
        while (queue.length) {
          const r = queue.shift();
          const path = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + (norm(r.name).slice(0, 30) || "product") + ".jpg";
          const up = await Products.uploadPhoto(path, r.photo, r.photo.type || "image/jpeg");
          if (up.error) { result.photosFailed++; r.url = null; } else r.url = Products.photoUrl(path);
          prog("Uploading photos… " + (++done) + " of " + withPhotos.length);
        }
      }));
      /* 2. new products in batches, falling back to one by one to find a bad row */
      const saved = new Set();
      for (let i = 0; i < news.length; i += 50) {
        const chunk = news.slice(i, i + 50); prog("Saving products… " + Math.min(i + 50, news.length) + " of " + news.length);
        const payload = chunk.map(r => ({ name: r.name, price: r.price, in_stock: r.in_stock, image_url: r.url || null }));
        const b = await Products.insertMany(payload);
        if (!b.error) { chunk.forEach(r => saved.add(r.id)); result.added += chunk.length; continue; }
        for (const r of chunk) {
          const one = await Products.insertOne({ name: r.name, price: r.price, in_stock: r.in_stock, image_url: r.url || null });
          if (one.error) { r.err = cfErr(one.error); result.failed++; } else { saved.add(r.id); result.added++; }
        }
      }
      /* 3. updates to products that already exist */
      for (const r of upds) {
        const e = existing.get(norm(r.name)); const patch = { price: r.price, in_stock: r.in_stock }; if (r.url) patch.image_url = r.url;
        const u = await Products.update(e.id, patch);
        if (u.error) { r.err = cfErr(u.error); result.failed++; } else { saved.add(r.id); result.updated++; }
      }
      rows = rows.filter(r => !saved.has(r.id));
      const again = await Products.allForBulk();
      if (!again.error) { existing.clear(); (again.data || []).forEach(p => existing.set(norm(p.name), p)); }
      const parts = []; if (result.added) parts.push(result.added + " added"); if (result.updated) parts.push(result.updated + " updated");
      let msg = (parts.join(", ") || "Nothing saved") + ".";
      if (result.photosFailed) msg += " " + result.photosFailed + " photo" + (result.photosFailed > 1 ? "s" : "") + " could not be uploaded (add them later with Edit).";
      if (result.failed) msg += " " + result.failed + " could not be saved. They stay in the list with the reason.";
      paintRows(); say("bk-msg", msg, !result.failed);
      if (!result.failed) $("bk-msg").insertAdjacentHTML("beforeend", `<button id="bk-open" type="button" class="${C.btn2} w-full mt-2">${ic("inventory_2", "text-[20px]")}<span>Open the catalogue</span></button>`), $("bk-open").onclick = () => { go("catalogue"); };
    } catch (err) { say("bk-msg", cfErr(err) || "Saving failed. Check the list and try again."); }
    saving = false; busy(btn, false); paintChips();
  };

  paintRows();
};
})();

;
/* ===== controllers/notices.js ===== */
/* Creditflex announcements: admin writes a message to all agents (or one agent); agents see a bell with a count and an inbox. */
(function () {
"use strict";
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + " h ago"; return new Date(iso).toLocaleDateString(); };

async function loadNotices() {
  const a = await Announcements.listMine();
  const r = await Announcements.myReads(S.me.id);
  const seen = new Set((r.data || []).map(x => String(x.announcement_id)));
  return { list: a.data || [], seen, error: a.error, stale: a.stale };
}

/* bell badge in the header (agents only) */
window.cfBellRefresh = async function () {
  const b = document.getElementById("bellBadge"); if (!b || !S.me) return;
  try { const { list, seen } = await loadNotices(); const n = list.filter(x => !seen.has(String(x.id))).length; b.textContent = n > 9 ? "9+" : String(n); b.classList.toggle("hidden", n === 0); const btn = document.getElementById("bellBtn"); if (btn) btn.setAttribute("aria-label", n ? n + " new announcements" : "Announcements"); } catch (e) {}
};
setInterval(() => { if (!document.hidden && window.cfBellRefresh) window.cfBellRefresh(); }, 300000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && window.cfBellRefresh) window.cfBellRefresh(); });


/* ---- phone notifications (Web Push). Works when the app is closed. iPhone needs the app added to the Home Screen first. ---- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const u8 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function pushReg() { return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(Error("The app is still getting ready. Try again in a moment.")), 4000))]); }
async function pushCurrent() { try { const r = await pushReg(); return await r.pushManager.getSubscription(); } catch (e) { return null; } }
window.cfPushEnable = async function () {
  if (!pushSupported()) throw Error(isIOS && !standalone() ? "On iPhone, first tap Share, then Add to Home Screen, and open Creditflex from the new icon." : "This browser does not support notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw Error("Notifications are blocked. Allow them in your phone or browser settings for this app.");
  const k = await Announcements.pushKey();
  const key = k.data && k.data.key; if (!key) throw Error("Notifications are not ready yet. Try again in a minute.");
  const reg = await pushReg();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(key) });
  const j = sub.toJSON();
  const { error } = await Announcements.saveSubscription(j.endpoint, j.keys.p256dh, j.keys.auth, navigator.userAgent);
  if (error) throw error;
  try { localStorage.setItem("cf-push-on", "1"); } catch (e) {}
};
window.cfPushDisable = async function () {
  const sub = await pushCurrent();
  if (sub) { try { await Announcements.removeSubscription(sub.endpoint); } catch (e) {} try { await sub.unsubscribe(); } catch (e) {} }
  try { localStorage.removeItem("cf-push-on"); } catch (e) {}
};
/* called when someone signs out so the next person on this phone does not receive their messages */
window.cfPushSignOutCleanup = async function () { try { if (localStorage.getItem("cf-push-on")) await cfPushDisable(); } catch (e) {} };
window.cfPushSlot = async function (id) {
  const el = document.getElementById(id); if (!el) return;
  if (S.me.role === "admin") return;
  const sub = pushSupported() ? await pushCurrent().catch(() => null) : null, on = !!sub && Notification.permission === "granted";
  if (!document.getElementById(id)) return;
  const hint = isIOS && !standalone() ? `<p class="${C.mute}">On iPhone: tap Share, then Add to Home Screen, and open Creditflex from that icon. Then turn notifications on here.</p>` : "";
  const el2 = document.getElementById(id); if (!el2) return;
  el2.innerHTML = `<p class="${C.mute}">${on ? "Notifications are on. You will get a message on this phone when the admin sends an announcement, even when the app is closed." : "Get a message on this phone when the admin sends an announcement, even when the app is closed."}</p>${hint}<button id="${id}-btn" type="button" class="${C.btn2} w-full">${ic("notifications", "text-[20px]")}<span>${on ? "Turn off notifications" : "Turn on notifications"}</span></button><div id="${id}-msg"></div>`;
  document.getElementById(id + "-btn").onclick = async () => { const b = document.getElementById(id + "-btn"); busy(b, true); try { if (on) await cfPushDisable(); else await cfPushEnable(); } catch (e) { busy(b, false); return say(id + "-msg", e.message || cfErr(e)); } cfPushSlot(id); };
};

/* agent inbox */
window.viewCreditflexInbox = async function () {
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const { list, seen, error, stale } = await loadNotices();
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Announcements</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${cfStaleNote(stale)}<section class="${C.card} space-y-2"><h2 class="text-title-md">Notifications</h2><div id="inbox-push"></div></section>` + (list.length ? list.map(x => { const fresh = !seen.has(String(x.id)); return `<section class="${C.card} space-y-1 ${fresh ? "border-l-4 border-primary" : ""}"><div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(x.title)}</b>${fresh ? `<span class="text-label-md rounded-full px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed shrink-0">New</span>` : ""}</div><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.body)}</p><p class="${C.mute}">${esc(ago(x.created_at))}${x.audience_agent_id ? " · just for you" : ""}</p></section>`; }).join("") : `<div class="${C.card} text-center ${C.mute}">No announcements yet.</div>`);
  cfPushSlot("inbox-push");
  const fresh = list.filter(x => !seen.has(String(x.id)));
  if (fresh.length && navigator.onLine) { try { await Announcements.markRead(fresh.map(x => x.id), S.me.id); } catch (e) {} const b = document.getElementById("bellBadge"); if (b) b.classList.add("hidden"); }
};

/* admin: write and manage announcements */
window.viewCreditflexAnnounce = async function () {
  if (S.me.role !== "admin") { return go("collections"); }
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const [ag, an, rd] = await Promise.all([
    Staff.activeAgents(),
    Announcements.listSent(),
    Announcements.allReads()
  ]);
  const agents = ag.data || [], list = an.data || [], reads = rd.data || [];
  const nameOf = id => (agents.find(a => a.id === id) || {}).full_name || "one agent";
  v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>
  <section class="${C.card} space-y-3"><p class="${C.mute}">Write a message your agents will see when they open the app. A bell with a number shows on their screen until they read it.</p>
    <form id="an-f" class="space-y-3">
      <div><label class="${C.lbl}" for="an-t">Title</label><input id="an-t" class="${C.inp}" maxlength="80" required placeholder="e.g. New price list"></div>
      <div><label class="${C.lbl}" for="an-b">Message</label><textarea id="an-b" class="${C.inp}" rows="4" maxlength="600" required placeholder="Write your message"></textarea><div id="an-c" class="${C.mute} text-right">0 / 600</div></div>
      <div><label class="${C.lbl}" for="an-a">Send to</label><select id="an-a" class="${C.inp}"><option value="">All agents</option>${agents.map(a => `<option value="${esc(a.id)}">${esc(a.full_name)} only</option>`).join("")}</select></div>
      <button class="${C.btn}" id="an-s">${ic("send", "text-[22px]")}<span>Send announcement</span></button><div id="an-m"></div>
    </form></section>
  <h2 class="text-title-md px-1">Sent</h2>` + (list.length ? list.map(x => { const n = reads.filter(r => r.announcement_id === x.id).length, total = x.audience_agent_id ? 1 : agents.length;
    return `<section class="${C.card} space-y-1"><div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(x.title)}</b><button type="button" data-arch="${x.id}" class="text-label-md text-error min-h-[40px] px-2">Remove</button></div><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.body)}</p><p class="${C.mute}">${esc(ago(x.created_at))} · ${x.audience_agent_id ? esc(nameOf(x.audience_agent_id)) : "All agents"} · read by ${n} of ${total}</p></section>`; }).join("") : `<div class="${C.card} text-center ${C.mute}">Nothing sent yet.</div>`);
  $("an-b").oninput = () => { $("an-c").textContent = $("an-b").value.length + " / 600"; };
  $("an-f").onsubmit = async e => {
    e.preventDefault(); const b = $("an-s"); busy(b, true);
    const row = { title: $("an-t").value.trim(), body: $("an-b").value.trim(), audience_agent_id: $("an-a").value || null, created_by: S.me.id };
    const ins = await Announcements.send(row);
    if (ins.error) { busy(b, false); return say("an-m", cfErr(ins.error)); }
    let note = "Announcement sent. Agents will see it when they open the app.";
    try { const r = await Announcements.pushSend(ins.data && ins.data.id); const d = r.data || {}; if (d.ok) note = d.devices ? "Announcement sent. Phone notification delivered to " + d.sent + " of " + d.devices + " phones." : "Announcement sent. No agent has turned on phone notifications yet, so they will see it when they open the app."; } catch (e) {}
    busy(b, false);
    await viewCreditflexAnnounce(); say("an-m", note, true);
  };
  v.querySelectorAll("[data-arch]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this announcement for everyone?")) return;
    const { error } = await Announcements.archive(Number(b.dataset.arch));
    if (error) return alert(cfErr(error)); viewCreditflexAnnounce();
  });
};
})();

;
/* ===== controllers/legal.js ===== */
/* Privacy notice and terms of use, shown as a page in the menu and as a pop-up on the sign-in screen. */
(function () {
"use strict";
const UPDATED = "18 November 2026";

const sec = (title, body, open) => `<details class="rounded-xl bg-surface-container-low px-3 py-2"${open ? " open" : ""}><summary class="font-bold cursor-pointer min-h-[40px] flex items-center">${title}</summary><div class="space-y-2 pb-2 text-body-md">${body}</div></details>`;
const p = t => `<p>${t}</p>`;
const ul = a => `<ul class="list-disc pl-5 space-y-1">${a.map(x => `<li>${x}</li>`).join("")}</ul>`;

window.cfLegalHtml = function () {
  const privacy = [
    sec("Who we are", p("Creditflex runs this app so its sales agents and managers can record instalment sales and the payments customers make. If you have a question about your information, call or WhatsApp <b>020 670 9055</b> or email <b>Blisscoenergy001@gmail.com</b>."), true),
    sec("What we keep", p("<b>About staff (agents and admins):</b>") + ul(["name, email address, phone number and role", "your password (kept scrambled by our login provider, so nobody can read it)", "sign-in records"]) + p("<b>About customers (recorded by agents):</b>") + ul(["name, phone number and location", "what they bought and the payment plan", "every payment: amount, date and which agent collected it", "the reason, if a payment was cancelled by the admin"])),
    sec("Why we use it", ul(["to record sales and instalment payments and show each customer's balance and statement", "to check that the cash agents collect matches what is recorded", "to prevent mistakes and fraud: every payment and cancellation is written in a log that cannot be edited", "to contact customers about their account"]) + p("We do not sell your information and we do not use it for advertising.")),
    sec("Who can see it", ul(["an <b>agent</b> sees only their own customers, purchases and payments", "a <b>supervisor</b> also sees the agents they look after", "the <b>admin</b> sees everything and is the only person who can cancel a payment"]) + p("Our service providers also handle data for us: <b>Supabase</b> (database and sign-in, servers in Ireland), <b>Vercel</b> (hosts the app), and <b>Google Fonts</b> and <b>jsDelivr</b> (load the text style and app code, so they can see your device's internet address). When staff share a statement, it goes through <b>WhatsApp</b> to the customer.")),
    sec("Saved on your phone", p("When there is no internet, payments wait on the phone until they can be sent. Customer balances you have looked at are also kept on the phone so you can work offline. You can clear this in <b>Settings</b>. Sign out on any phone that is not yours.")),
    sec("How long we keep it", p("Payment records are kept for as long as Creditflex needs them for its accounts and the law. For this reason a payment can never be deleted, only cancelled with a written reason. A customer or staff member can ask us to correct wrong details at any time.")),
    sec("Keeping it safe", p("The app uses a secure (HTTPS) connection, strict rules on who can see what, an admin-only cancel process and a permanent audit trail. No system is perfectly safe, so please keep your password private and tell us at once if you think someone else has used your account.")),
    sec("Your rights", p("Under Ghana's Data Protection Act, 2012 (Act 843) you can ask to see the information we hold about you, ask us to correct it, and object to how it is used. If you are not happy with our answer you can complain to the Data Protection Commission of Ghana. This app is not meant for anyone under 18.")),
  ].join("");
  const terms = [
    sec("Who may use the app", p("Only Creditflex staff whose account the admin has approved. The admin may switch off an account at any time."), true),
    sec("Your account", p("Keep your password to yourself. You are responsible for everything done with your account, so sign out on shared phones.")),
    sec("Recording money", ul(["Record a payment only when you have really received the money, and record it straight away with the right amount and date.", "Never record a payment you did not receive.", "If you make a mistake, tell the admin. Only the admin can cancel a payment, and every cancellation is kept in the log.", "False records may lead to disciplinary action and, where the law allows, legal action."])),
    sec("Customer information", p("Use customer details only for Creditflex business. Do not copy, share or sell them for any other reason.")),
    sec("Offline payments", p("A payment saved while offline is not recorded on the server until it has been sent. Keep the app and the phone safe until it syncs.")),
    sec("Availability", p("We work to keep the app running but cannot promise it will always be available. Keep your own cash notes if the app is down.")),
    sec("Breaking the rules", p("We may suspend or remove an account that breaks these terms. These terms are governed by the laws of Ghana.")),
  ].join("");
  return `<section class="${C.card} space-y-3"><h2 class="text-title-md">Privacy notice</h2><p class="${C.mute}">What information we keep, why, and who can see it. Last updated ${UPDATED}.</p><div class="space-y-2">${privacy}</div></section>
    <section class="${C.card} space-y-3"><h2 class="text-title-md">Terms of use</h2><p class="${C.mute}">The simple rules for using the app.</p><div class="space-y-2">${terms}</div></section>`;
};

window.viewCreditflexPrivacy = function () {
  $("view").innerHTML = `<h1 class="${C.h1}">Privacy &amp; terms</h1>` + cfLegalHtml();
};

/* pop-up version, used before signing in */
window.cfOpenLegal = function () {
  if (document.getElementById("cf-legal")) return;
  const d = document.createElement("div"); d.id = "cf-legal";
  d.style.cssText = "position:fixed;inset:0;z-index:1100;overflow-y:auto;-webkit-overflow-scrolling:touch";
  d.className = "bg-surface text-on-surface";
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Privacy and terms");
  d.innerHTML = `<div class="max-w-2xl mx-auto px-4 py-5 space-y-4"><div class="flex items-center justify-between gap-3"><h1 class="${C.h1}">Privacy &amp; terms</h1><button id="cf-legal-x" type="button" class="${C.btn2}">Close</button></div>${cfLegalHtml()}<button id="cf-legal-x2" type="button" class="${C.btn}">Close</button></div>`;
  document.body.appendChild(d); d.scrollTop = 0;
  const close = () => d.remove();
  d.querySelector("#cf-legal-x").onclick = close; d.querySelector("#cf-legal-x2").onclick = close;
};
})();

;
/* ===== controllers/lock.js ===== */

/* Quick unlock (like mobile-money and banking apps): people stay signed in. The app asks for a PIN, or a fingerprint/face
   touch where the phone supports it, only when it was left for a while (or closed for a while). Never while someone is using it.
   Checked on the phone only; five wrong PINs or "Forgot PIN" send the person to the normal password sign-in. */
(function(){
 const uid=()=>S.me&&S.me.id, K=u=>"cf-pin:"+u, SN=u=>"cf-pin-later:"+u, BK=u=>"cf-bio:"+u, AK=u=>"cf-active:"+u;
 const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}}, lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}, lsDel=k=>{try{localStorage.removeItem(k);}catch(e){}};
 const getPin=()=>{try{return JSON.parse(lsGet(K(uid())));}catch(e){return null;}};
 const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
 const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 async function hash(pin,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:100000,hash:"SHA-256"},k,256));}
 const weak=p=>!/^[0-9]{4}$/.test(p)||/^(\d)\1{3}$/.test(p)||["1234","4321","0123","1122","2580","1212"].includes(p);
 let hiddenAt=0,locked=false,bound=false,asked=false,lastMark=0;
 const awayMs=()=>((S.me&&S.me.role==="admin")?5:10)*60000;
 const mark=()=>{if(!S.me||locked)return;const n=Date.now();if(n-lastMark>10000){lastMark=n;lsSet(AK(uid()),String(n));}};
 const wrap=h=>{const d=document.createElement("div");d.id="cf-lock";d.className="fixed inset-0 z-[200] bg-surface flex items-center justify-center p-6";d.innerHTML='<div class="w-full max-w-xs space-y-4 text-center">'+h+'</div>';document.body.appendChild(d);return d;};
 const pinField=(id,label)=>'<label class="'+C.lbl+' block text-left" for="'+id+'">'+label+'</label><input id="'+id+'" type="password" data-noeye="1" inputmode="numeric" autocomplete="off" maxlength="4" class="'+C.inp+' text-center text-headline-md tracking-[0.5em]" placeholder="••••">';
 async function setPin(p){const s=new Uint8Array(16);crypto.getRandomValues(s);const salt=b64(s);lsSet(K(uid()),JSON.stringify({salt,hash:await hash(p,salt),tries:0}));}
 /* fingerprint / face through the phone's own screen-lock sensor (WebAuthn, platform authenticator) */
 const bioSupported=async()=>{try{return !!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());}catch(e){return false;}};
 const bioOn=()=>!!lsGet(BK(uid()));
 async function bioEnroll(){
  const ch=crypto.getRandomValues(new Uint8Array(32));
  const c=await navigator.credentials.create({publicKey:{challenge:ch,rp:{name:"Creditflex"},user:{id:new TextEncoder().encode(String(uid())).slice(0,64),name:S.me.email||S.me.full_name||"agent",displayName:S.me.full_name||"Agent"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000}});
  if(!c)throw Error("cancelled");lsSet(BK(uid()),b64(c.rawId));
 }
 async function bioCheck(){
  const id=lsGet(BK(uid()));if(!id)return false;
  try{const r=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:"public-key",id:unb64(id)}],userVerification:"required",timeout:60000}});return !!r;}catch(e){return false;}
 }
 function lock(){
  if(locked||!S.me||!getPin())return;locked=true;
  const bio=bioOn();
  const d=wrap('<div class="w-14 h-14 mx-auto rounded-full bg-primary-container text-on-primary flex items-center justify-center">'+ic("lock","text-[28px]")+'</div><h2 class="text-title-md">Welcome back, '+esc((S.me.full_name||"").split(" ")[0])+'</h2><p class="'+C.mute+'">'+(bio?"Touch the sensor, or enter your PIN.":"Enter your PIN to continue.")+'</p>'+pinField("cf-pin-in","PIN")+'<div id="cf-pin-msg"></div>'+(bio?'<button id="cf-bio-go" type="button" class="'+C.btn+' w-full">Use fingerprint or face</button>':'')+'<button id="cf-pin-forgot" type="button" class="'+C.btn2+' w-full">Forgot PIN? Sign in with password</button>');
  const inp=d.querySelector("#cf-pin-in");if(!bio)inp.focus();
  const unlock=()=>{d.remove();locked=false;mark();};
  const go=async()=>{
   const p=inp.value,rec=getPin();if(!rec)return unlock();
   if(!/^[0-9]{4}$/.test(p))return;
   if(await hash(p,rec.salt)===rec.hash){rec.tries=0;lsSet(K(uid()),JSON.stringify(rec));return unlock();}
   rec.tries=(rec.tries||0)+1;lsSet(K(uid()),JSON.stringify(rec));inp.value="";
   if(rec.tries>=5){lsDel(K(uid()));lsDel(BK(uid()));d.remove();locked=false;return logout("Too many wrong PINs. Sign in with your password.");}
   say("cf-pin-msg","Wrong PIN. "+(5-rec.tries)+" tries left.");
  };
  inp.oninput=()=>{if(inp.value.length===4)go();};inp.onkeydown=e=>{if(e.key==="Enter")go();};
  const tryBio=async()=>{if(await bioCheck())unlock();};
  if(bio){d.querySelector("#cf-bio-go").onclick=tryBio;tryBio();}
  d.querySelector("#cf-pin-forgot").onclick=()=>{lsDel(K(uid()));lsDel(BK(uid()));d.remove();locked=false;logout("Sign in with your password. You can set a new PIN afterwards.");};
 }
 async function ask(){
  const u=uid();if(asked||!u||getPin()||document.getElementById("cf-lock"))return;
  if(!S.me.onboarding_completed_at&&S.me.role!=="admin")return;
  if(Date.now()<Number(lsGet(SN(u))||0))return;
  asked=true;
  const canBio=await bioSupported();
  const d=wrap('<div class="w-14 h-14 mx-auto rounded-full bg-primary-container text-on-primary flex items-center justify-center">'+ic("lock","text-[28px]")+'</div><h2 class="text-title-md">Protect customer records</h2><p class="'+C.mute+'">You stay signed in. A 4-digit PIN'+(canBio?" (or your fingerprint)":"")+' is only asked if you leave the app for a while.</p>'+pinField("cf-pin-a","Choose a 4-digit PIN")+pinField("cf-pin-b","Type it again")+'<div id="cf-pin-msg"></div><button id="cf-pin-save" type="button" class="'+C.btn+' w-full">Save PIN</button><button id="cf-pin-later" type="button" class="'+C.btn2+' w-full">Not now</button>');
  d.querySelector("#cf-pin-save").onclick=async()=>{const a=d.querySelector("#cf-pin-a").value,b=d.querySelector("#cf-pin-b").value;
   if(weak(a))return say("cf-pin-msg","Choose 4 digits that are not easy to guess (not 1234, 0000 or repeated numbers).");
   if(a!==b)return say("cf-pin-msg","The two PINs do not match.");
   await setPin(a);d.remove();mark();
   if(canBio){try{await bioEnroll();}catch(e){/* fingerprint is optional */}}};
  d.querySelector("#cf-pin-later").onclick=()=>{lsSet(SN(u),String(Date.now()+7*864e5));d.remove();};
 }
 const check=()=>{if(!S.me||locked)return;if(getPin()&&hiddenAt&&Date.now()-hiddenAt>awayMs())lock();hiddenAt=0;};
 let started=false;
 window.cfIdleStart=function(){
  if(!bound){bound=true;["pointerdown","keydown","touchstart"].forEach(ev=>document.addEventListener(ev,mark,{passive:true,capture:true}));
   document.addEventListener("visibilitychange",()=>{if(document.hidden){hiddenAt=Date.now();lsSet(AK(uid()),String(hiddenAt));}else check();});}
  if(!started){started=true;/* app just opened: was it closed for a while? */const t=Number(lsGet(AK(uid()))||0);if(t&&Date.now()-t>awayMs()&&getPin())lock();else mark();}
  ask();
 };
 window.cfIdleStop=function(){const d=document.getElementById("cf-lock");if(d)d.remove();locked=false;asked=false;started=false;};
 window.cfPinState=()=>({set:!!getPin(),bio:bioOn()});
 window.cfBioSupported=bioSupported;
 window.cfBioEnable=async function(){await bioEnroll();};
 window.cfBioDisable=function(){lsDel(BK(uid()));};
 window.cfPinChange=async function(){asked=false;lsDel(K(uid()));lsDel(SN(uid()));ask();};
 window.cfPinRemove=function(){lsDel(K(uid()));lsDel(BK(uid()));};
})();

;
/* ===== main.js ===== */
/* Start the app once the page has loaded. */
window.__cfBooted = true;   // the whole app file loaded and ran (checked by the old-phone guard in index.html)
document.addEventListener("DOMContentLoaded", boot);
