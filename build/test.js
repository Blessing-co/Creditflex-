// Headless UI test with a fake Supabase. Run:  node test.js   (needs: npm install, and `npx playwright` browsers)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");
const dir = __dirname, shots = path.join(dir, "shots"); fs.mkdirSync(shots, { recursive: true });
const root = path.join(dir, "..");

const server = http.createServer((q, r) => {
  const f = path.join(root, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : f.endsWith(".png") ? "image/png" : f.endsWith(".svg") ? "image/svg+xml" : f.endsWith(".webmanifest") ? "application/manifest+json" : "text/html" }); r.end(fs.readFileSync(f));
});

const stub = cfg => `(function(){
  const cfg=${JSON.stringify(cfg)}; const calls=[]; window.__calls=calls;
  const D={
    staff_me:{id:'u1',full_name:'Kofi Mensah',role:cfg.role,status:'active',email:'k@x.com',onboarding_completed_at:cfg.onboarded?'2026-11-01T00:00:00Z':null},
    purchase_ledger:[
      {purchase_id:1,customer_id:11,product_id:21,customer_name:'Ama Serwaa',customer_phone:'0244128901',product_name:'Bruhm Blender 2-in-1',plan_name:'8-week weekly',balance:90,amount_paid:180,total_price:270,payments_made:6,installment_amount:30,status:'active'},
      {purchase_id:2,customer_id:12,product_id:22,customer_name:'Kofi Boateng',customer_phone:'0201112233',product_name:'Nasco 32 inch TV',plan_name:'30-day daily',balance:420,amount_paid:80,total_price:500,payments_made:4,installment_amount:20,status:'active'}],
    products:[{id:1,name:'Blender',price:270,image_url:null,in_stock:true}],
    payment_plans:[{id:1,name:'30-day daily',frequency:'daily',installments:30}],
    customers:[{id:11,full_name:'Ama Serwaa',phone:'0244128901',location:'Makola',registered_by:'u1',created_at:'2026-11-15T09:00:00Z'},{id:1,full_name:'Ama Serwaa',phone:'0244128901',location:'Makola',registered_by:'u1',created_at:'2026-11-15T09:00:00Z'}],
    payments:[{id:5,purchase_id:1,amount:30,paid_on:'2026-11-15',collected_by:'u1',created_at:new Date().toISOString(),voided_at:null}],
    payment_audit_log:[],
    announcements:[{id:1,title:'New price list',body:'Prices changed today.',created_at:new Date().toISOString(),audience_agent_id:null}],
    announcement_reads:[],
    staff:[{id:'u1',full_name:'Kofi Mensah',email:'k@x.com',phone:'',role:cfg.role,status:'active',supervisor_id:null}]
  };
  const RPC={collection_summary:[{paid_on:'2026-11-15',agent_name:'Kofi Mensah',payments_count:3,total:90}],
    portfolio_summary:[{agent_name:'Kofi Mensah',active_purchases:2,outstanding:510}],
    check_recent_payment_duplicate:!!cfg.dup, complete_agent_onboarding:null, void_payment:null, register_customer:null, admin_update_staff:null};
  function builder(t){const b={_single:false};
    ['select','eq','order','limit','gte','lte','is','in','range'].forEach(m=>b[m]=()=>b);
    b.maybeSingle=()=>{b._single=true;return b;};
    b.insert=row=>{calls.push(['insert',t,row]);b._ins=true;return b;}; b.upsert=row=>{calls.push(['upsert',t,row]);return b;}; b.update=row=>{calls.push(['update',t,row]);return b;};
    b.then=(res,rej)=>{let data=D[t]; if(b._single) data=(t==='staff'?D.staff_me:(b._ins&&t==='payments'?{id:99}:null));
      return Promise.resolve({data,error:null}).then(res,rej);};
    return b;}
  const sbm={auth:{getSession:async()=>({data:{session:cfg.loggedOut?null:{}}}),getUser:async()=>({data:{user:{id:'u1'}}}),
    signOut:async()=>({}),signInWithPassword:async()=>({error:{message:'Invalid login credentials'}}),signUp:async()=>({error:null}),
    resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null}),onAuthStateChange:()=>{}},
    from:t=>builder(t), rpc:async(n,a)=>{calls.push(['rpc',n,a]);return{data:RPC[n]??null,error:null};},
    functions:{invoke:async(n,o)=>{calls.push(['fn',n,o.body]);return{data:{ok:true,message:'SMS sent.'},error:null};}},
    storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'x'}})})}};
  window.supabase={createClient:()=>sbm};
})();`;

async function open(browser, cfg, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", ...ctxOpts });
  const page = await ctx.newPage(); const errors = [];
  if (!cfg.pin) await page.addInitScript(() => { try { localStorage.setItem("cf-pin:u1", JSON.stringify({ salt: "AAAAAAAAAAAAAAAAAAAAAA==", hash: "x", tries: 0 })); } catch (e) {} });
  page.on("pageerror", e => { errors.push("pageerror: " + e.message); if (process.env.DBG) console.log("PAGEERR", e.message); });
  page.on("console", m => { if (process.env.DBG && m.type() === "error") console.log("CONSOLE", m.text()); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/*", route => {
    const u = route.request().url();
    if (u.includes("/vendor/supabase.js")) return route.fulfill({ contentType: "application/javascript", body: stub(cfg) });
    if (u.startsWith("http://localhost")) return route.continue();
    return route.abort();
  });
  await page.goto("http://localhost:8765/"); await page.waitForTimeout(900);
  return { page, ctx, errors };
}
const HUBP = { announce: "manage", learn: "help", privacy: "help", credit: "help", staff: "manage", financial: "manage", export: "manage", bulk: "manage" };
const nav = async (p, k) => {
  const top = async key => { if (await p.$eval('#menuPanel', e => e.classList.contains('hidden'))) await p.click('#menuBtn'); await p.click('#menuPanel button[data-t="' + key + '"]'); };
  if (HUBP[k]) { await top(HUBP[k]); await p.waitForSelector('[data-go="' + k + '"]'); await p.click('[data-go="' + k + '"]'); }
  else if (k === "account") { await top("settings"); await p.waitForSelector('#cf-acct'); await p.click('#cf-acct'); }
  else await top(k);
};
const shot = (p, n) => p.screenshot({ path: path.join(shots, n + ".png"), fullPage: false });
const calls = p => p.evaluate(() => window.__calls);
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await chromium.launch(); const errs = [];

  // 1. first sign-in tour, agent
  let t = await open(browser, { role: "agent", onboarded: false }); let p = t.page;
  ok(await p.$("#cf-w-go") !== null, "agent first login shows the tour welcome");
  await shot(p, "01-tour-welcome");
  ok(await p.$("#cf-w-learn") !== null, "welcome offers the beginner basics");
  await p.click('.cf-pick label:nth-child(9) input'); await p.click('.cf-pick label:nth-child(10) input');
  await p.click("#cf-w-go"); await p.waitForTimeout(500);
  ok((await p.textContent("#cf-tour-count")) === "STEP 1 OF 8", "tour has 8 steps after un-ticking 2");
  const cardBox = await (await p.$(".cf-coach-card")).boundingBox();
  ok(cardBox.height < 330 && cardBox.y > 440, "tour card is a small panel at the bottom, not full screen");
  ok(await p.$(".cf-tour-backdrop") === null, "no dark overlay blocks the app");
  ok(await p.$("#menuBtn.cf-hl") !== null, "step 1 highlights the Menu button");
  await shot(p, "02-tour-step");
  await p.click("#menuBtn"); await p.waitForTimeout(200);
  ok((await p.textContent("#cf-tour-task")).includes("Done"), "doing the step marks it done");
  await p.click("#cf-tour-next"); await p.waitForTimeout(500);
  ok(await p.$("#go.cf-hl") !== null, "step 2 highlights the Show button and the page is usable");
  await p.click("#go"); await p.waitForTimeout(300);
  ok((await p.textContent("#cf-tour-task")).includes("Done"), "tapping the real Show button completes step 2");
  await p.click("#cf-tour-next"); await p.waitForTimeout(500);
  ok(await p.$("#sq.cf-hl") !== null, "step 3 highlights customer search");
  await p.click("#cf-tour-next"); await p.waitForTimeout(500);
  ok(await p.$("#q.cf-hl") !== null, "step 4 highlights Find customer on the payment page");
  await shot(p, "02b-tour-pay");
  await p.click("#cf-tour-back"); await p.waitForTimeout(300);
  ok((await p.textContent("#cf-tour-count")) === "STEP 3 OF 8", "Back works");
  await p.click("#cf-tour-all"); await p.waitForTimeout(400);
  ok((await calls(p)).some(c => c[1] === "complete_agent_onboarding"), "skipping saves onboarding as complete");
  ok(await p.$("#cf-tour") === null, "tour closed after skip");
  errs.push(...t.errors); await t.ctx.close();

  // 2. returning agent: no tour; More menu; settings; credit
  // network layer, paging and friendly errors
  { const nt = await open(browser, { loggedOut: true }); const np = nt.page;
    const r = await np.evaluate(async () => {
      const out = {}; const realFetch = window.fetch; CF_NET.backoff = 1;
      let n = 0; window.fetch = async () => { n++; if (n < 3) throw new TypeError("Failed to fetch"); return new Response("ok", { status: 200 }); };
      out.getRes = (await (await cfFetch("https://x.test/a")).text()); out.getCalls = n;
      n = 0; window.fetch = async () => { n++; throw new TypeError("Failed to fetch"); };
      try { await cfFetch("https://x.test/a", { method: "POST" }); out.postErr = "none"; } catch (e) { out.postErr = e.message; } out.postCalls = n;
      n = 0; window.fetch = async () => { n++; return new Response("bad", { status: 503 }); };
      out.r503 = (await cfFetch("https://x.test/a")).status; out.r503Calls = n;
      const keep = CF_NET.read, keepR = CF_NET.retries; CF_NET.read = 40; CF_NET.retries = 0;
      window.fetch = (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
      try { await cfFetch("https://x.test/slow"); out.slow = "none"; } catch (e) { out.slow = e.message; }
      CF_NET.read = keep; CF_NET.retries = keepR; window.fetch = realFetch;
      out.errs = [cfErr({ message: "Failed to fetch" }), cfErr({ code: "P0001", message: "Payment is more than the balance (balance is 10.00)." }), cfErr({ code: "42501", message: "permission denied for table x" }), cfErr({ code: "XX000", message: "relation public.secret_table does not exist" }), cfErr({ name: "AuthApiError", message: "Invalid login credentials" })];
      const pages = []; const fake = { select() { return fake; }, order() { return fake; }, range(a, b) { pages.push([a, b]); const n = Math.max(0, Math.min(b + 1, 2350) - a); return Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: a + i })), error: null }); } };
      const keepFrom = sb.from; sb.from = () => fake; const all = await cfFetchAll("x", "id", ["id"]); sb.from = keepFrom;
      out.paged = [all.length, pages.length];
      return out; });
    ok(r.getRes === "ok" && r.getCalls === 3, "a failed read is retried and then succeeds (" + r.getCalls + " tries)");
    ok(r.postCalls === 1 && /Failed to fetch/.test(r.postErr), "a failed write is never retried");
    ok(r.r503 === 503 && r.r503Calls === 3, "server errors on reads are retried then returned");
    ok(/timeout/.test(r.slow), "a hanging request times out: " + r.slow);
    ok(r.errs[0].startsWith("Cannot reach the server") && r.errs[1].includes("more than the balance") && r.errs[2] === "You do not have permission to do that." && r.errs[3].startsWith("Something went wrong") && r.errs[3].indexOf("secret_table") < 0 && r.errs[4] === "Invalid login credentials", "error messages are friendly and hide database details");
    ok(r.paged[0] === 2350 && r.paged[1] === 3, "paging reads all 2350 rows in 3 requests, not just 1000: " + r.paged);
    await nt.ctx.close(); }
  // sign-in screen: privacy pop-up and installable app files
  { const lo = await open(browser, { loggedOut: true }); const lp = lo.page;
    ok(await lp.$("#lg") !== null, "sign-in screen has a Privacy & terms link");
    await lp.click("#lg"); await lp.waitForTimeout(300); await shot(lp, "17-legal-popup");
    const lt = await lp.textContent("#cf-legal");
    ok(lt.includes("Act 843") && lt.includes("Terms of use") && lt.includes("020 670 9055"), "privacy pop-up shows the notice, terms and contact");
    await lp.click("#cf-legal-x"); ok(await lp.$("#cf-legal") === null, "privacy pop-up closes");
    const mf = await lp.evaluate(async () => { const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); const ok = await Promise.all(m.icons.map(i => fetch(i.src).then(r => r.ok && r.headers.get("content-type").includes("image/png")))); return { name: m.short_name, display: m.display, icons: ok }; });
    ok(mf.name === "Creditflex" && mf.display === "standalone" && mf.icons.length === 3 && mf.icons.every(Boolean), "manifest is valid and all 3 icons load");
    ok(await lp.$('link[rel="apple-touch-icon"]') !== null, "iPhone home-screen icon is declared");
    await lo.ctx.close(); }
  t = await open(browser, { role: "agent", onboarded: true }); p = t.page;
  ok(await p.$("#cf-tour") === null, "no tour for returning agent");
  ok(await p.$("nav.fixed.bottom-0") === null, "no bottom bar any more");
  await p.click("#menuBtn"); await p.waitForTimeout(200); await shot(p, "03-menu-agent");
  ok((await p.$$("#menuPanel button[data-t]")).length === 7, "agent menu has 7 tabs");
  { const bx = await (await p.$("#menuPanel")).boundingBox(); ok(bx.x + bx.width > 335 && bx.y < 90, "menu sits at the top right"); }
  await nav(p, "privacy"); await p.waitForTimeout(300);
  ok((await p.textContent("#view")).includes("Privacy notice") && (await p.textContent("#view")).includes("Terms of use"), "Privacy & terms page opens from the menu");
  await nav(p, "learn"); await p.waitForTimeout(300); await shot(p, "03b-learn");
  ok((await p.textContent("#view")).includes("GH₵ 240") && (await p.textContent("#view")).includes("Golden rules"), "How it works page explains the business");
  await nav(p, "settings"); await p.waitForTimeout(500); await shot(p, "04-settings");
  await p.click('#cf-theme button[data-v="dark"]'); await p.waitForTimeout(200); await shot(p, "05-settings-dark");
  await p.click('#cf-accents button[data-a="blue"]'); await p.waitForTimeout(200); await shot(p, "06-settings-blue-dark");
  await p.click('#cf-theme button[data-v="light"]');
  await nav(p, 'credit'); await p.waitForTimeout(300); await shot(p, "07-credit");
  const body = await p.textContent("body");
  ok(body.includes("020 670 9055") && body.includes("Blisscoenergy001@gmail.com"), "credit page shows phone and email");
  ok(await p.$('a[href="https://wa.me/233206709055"]') !== null, "credit page has WhatsApp link");
  await nav(p, 'analytics'); await p.waitForTimeout(600); await shot(p, "08-analytics");
  await nav(p, 'settings'); await p.waitForTimeout(300); await p.click("#cf-replay"); await p.waitForTimeout(300);
  ok(await p.$("#cf-w-go") !== null, "Replay training works from Settings");
  await p.click("#cf-w-skip"); await p.waitForTimeout(300);
  // customer statement
  await nav(p, "register"); await p.waitForTimeout(600);
  ok(await p.$('[data-c="11"]') !== null, "Customers tab lists customers");
  await p.fill("#sq", "ama"); await p.click('[data-c="11"]'); await p.waitForTimeout(500); await shot(p, "14-statement");
  const st = await p.textContent("#sbox");
  ok(st.includes("Ama Serwaa") && st.includes("90.00") && st.includes("2026-11-15"), "statement shows balance and payment history");
  ok((await p.getAttribute("#swa", "href")).startsWith("https://wa.me/233244128901?text="), "statement WhatsApp link uses the customer number");
  await p.click('[data-cm="new"]'); await p.waitForTimeout(400);
  ok(await p.$("#rf") !== null, "New customer form still reachable");
  // password rules
  await nav(p, "account"); await p.waitForTimeout(300);
  await p.fill("#cf-current", "OldPass123"); await p.fill("#cf-new", "123456"); await p.fill("#cf-confirm", "123456");
  await p.evaluate(() => { document.getElementById("cf-new").removeAttribute("minlength"); document.getElementById("cf-confirm").removeAttribute("minlength"); });
  await p.click("#cf-password-save"); await p.waitForTimeout(200);
  ok((await p.textContent("#cf-password-msg")).includes("at least 8"), "short password rejected");
  await p.fill("#cf-new", "abcdefghij"); await p.fill("#cf-confirm", "abcdefghij"); await p.click("#cf-password-save"); await p.waitForTimeout(200);
  ok((await p.textContent("#cf-password-msg")).includes("letters and numbers"), "letters-only password rejected");
  await p.fill("#cf-new", "password1"); await p.fill("#cf-confirm", "password1"); await p.click("#cf-password-save"); await p.waitForTimeout(200);
  ok((await p.textContent("#cf-password-msg")).includes("too easy"), "common password rejected");
  errs.push(...t.errors); await t.ctx.close();

  // 3. pay flow with a same-day duplicate
  t = await open(browser, { role: "agent", onboarded: true, dup: true }); p = t.page;
  await nav(p, 'pay'); await p.waitForTimeout(700);
  ok(await p.$(".pick") !== null, "Record payment page loads with customers (helper bug fixed)");
  await p.click('.pick[data-id="1"]'); await p.waitForTimeout(600); await shot(p, "09-pay-dup-banner");
  ok((await p.$("#pd")) === null, "agent has no payment date field");
  ok((await p.textContent("#dup")).includes("Already paid today"), "same-day banner shown on selecting customer");
  await p.click("#pb"); await p.waitForTimeout(400);
  ok((await p.textContent("#pb")).includes("Save anyway"), "first Save asks to confirm");
  ok(!(await calls(p)).some(c => c[0] === "insert"), "nothing saved before confirmation");
  await shot(p, "10-pay-dup-confirm");
  await p.click("#pb"); await p.waitForTimeout(600);
  ok((await calls(p)).some(c => c[0] === "insert" && c[1] === "payments"), "Save anyway records the payment");
  errs.push(...t.errors); await t.ctx.close();

  // 4. no duplicate -> saves straight away
  t = await open(browser, { role: "agent", onboarded: true, dup: false }); p = t.page;
  await nav(p, 'pay'); await p.waitForTimeout(600); await p.click('.pick[data-id="2"]'); await p.waitForTimeout(400);
  ok((await p.textContent("#dup")) === "", "no banner when nothing paid today");
  await p.click("#pb"); await p.waitForTimeout(600);
  ok((await calls(p)).filter(c => c[0] === "insert").length === 1, "single Save works when no duplicate");
  ok(await p.$("#sms-btn") !== null, "SMS receipt button appears after a saved payment");
  await p.click("#sms-btn"); await p.waitForTimeout(400);
  ok((await calls(p)).some(c => c[0] === "fn" && c[1] === "send-payment-sms"), "SMS button calls the server function");

  // 5. offline queue then sync
  await nav(p, 'pay'); await p.waitForTimeout(500);
  await t.ctx.setOffline(true); await p.waitForTimeout(300);
  await nav(p, 'pay'); await p.waitForTimeout(700);
  ok(await p.$(".pick") !== null, "offline: cached customer list is shown");
  await p.click('.pick[data-id="2"]'); await p.waitForTimeout(400); await p.fill("#amt", "20"); await p.click("#pb"); await p.waitForTimeout(700);
  await shot(p, "11-offline-queued");
  ok((await p.textContent("body")).includes("queued on this phone"), "offline payment is queued");
  const before = (await calls(p)).filter(c => c[0] === "insert").length;
  await t.ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event("online"))); await p.waitForTimeout(1500);
  ok((await calls(p)).filter(c => c[0] === "insert").length === before + 1, "queued payment syncs when back online");

  // 5b. offline reading and offline customer sign-up
  t = await open(browser, { role: "agent", onboarded: true }); p = t.page;
  await nav(p, "register"); await p.waitForSelector("[data-c]");
  await nav(p, "catalogue"); await p.waitForTimeout(500);
  await t.ctx.setOffline(true); await p.waitForTimeout(300);
  await nav(p, "register"); await p.waitForTimeout(700);
  ok((await p.$$("[data-c]")).length > 0 && (await p.textContent("body")).includes("Saved copy"), "offline: customers shown from the saved copy");
  await p.click('[data-cm="new"]'); await p.waitForSelector("#rf"); await p.fill("#n", "Offline Ama"); await p.fill("#p", "0244000111"); await p.click("#rb"); await p.waitForTimeout(700);
  ok((await p.textContent("body")).includes("saved on this phone"), "offline: new customer is queued");
  const rb = (await calls(p)).filter(c => c[0] === "rpc" && c[1] === "register_customer").length;
  await t.ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event("online"))); await p.waitForTimeout(1500);
  const rc = (await calls(p)).filter(c => c[0] === "rpc" && c[1] === "register_customer");
  ok(rc.length === rb + 1 && rc[rc.length - 1][2].p_submission_id, "queued customer registered once, with a safe-retry id");
  errs.push(...t.errors); await t.ctx.close();

  // 5b2. announcements (agent)
  t = await open(browser, { role: "agent", onboarded: true }); p = t.page;
  await p.waitForTimeout(600);
  ok((await p.textContent("#bellBadge")) === "1", "bell shows 1 unread announcement");
  await p.click("#bellBtn"); await p.waitForTimeout(500);
  ok((await p.textContent("body")).includes("Prices changed today."), "inbox shows the announcement");
  ok((await calls(p)).some(c => c[0] === "upsert" && c[1] === "announcement_reads"), "opening the inbox marks it read");
  errs.push(...t.errors); await t.ctx.close();

  // 5c. quick PIN lock
  t = await open(browser, { role: "agent", onboarded: true, pin: true }); p = t.page;
  await p.waitForSelector("#cf-pin-a");
  await p.fill("#cf-pin-a", "1234"); await p.fill("#cf-pin-b", "1234"); await p.click("#cf-pin-save"); await p.waitForTimeout(300);
  ok((await p.textContent("#cf-pin-msg")).includes("not easy to guess"), "easy PIN is refused");
  await p.fill("#cf-pin-a", "4827"); await p.fill("#cf-pin-b", "4827"); await p.click("#cf-pin-save"); await p.waitForTimeout(800);
  ok(await p.$("#cf-lock") === null, "PIN saved");
  await p.evaluate(() => { const r = Date.now; Date.now = () => r() + 30 * 60000; });
  await p.click("#menuBtn"); await p.waitForTimeout(300); await p.click("#menuBtn");
  ok(await p.$("#cf-lock") === null, "no PIN is asked while the app is in use, however long the session");
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.evaluate(() => { const r = Date.now; Date.now = () => r() + 11 * 60000; Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(400);
  ok(await p.$("#cf-pin-in") !== null, "app locks only after being away 10+ minutes");
  await p.fill("#cf-pin-in", "0001"); await p.waitForTimeout(1200);
  ok((await p.textContent("#cf-pin-msg")).includes("Wrong PIN"), "wrong PIN is refused");
  await p.fill("#cf-pin-in", "4827"); await p.waitForTimeout(1200);
  ok(await p.$("#cf-lock") === null && await p.$("#menuBtn") !== null, "right PIN unlocks without signing in again");
  errs.push(...t.errors); await t.ctx.close();

  // 6. admin
  t = await open(browser, { role: "admin", onboarded: true }); p = t.page;
  ok(await p.$("#cf-tour") === null, "admin never sees the first-login tour");
  await p.click("#menuBtn"); await p.waitForTimeout(200); await shot(p, "12-menu-admin");
  ok((await p.$$("#menuPanel button[data-t]")).length === 8, "admin menu has 8 tabs");
  await nav(p, "pay"); await p.waitForSelector(".pick"); await p.click(".pick"); await p.waitForSelector("#pd");
  ok(true, "admin still has the payment date field");
  await nav(p, "announce"); await p.waitForSelector("#an-f"); await p.fill("#an-t", "Meeting"); await p.fill("#an-b", "Friday 9am"); await p.click("#an-s"); await p.waitForTimeout(600);
  ok((await calls(p)).some(c => c[0] === "insert" && c[1] === "announcements" && c[2].title === "Meeting" && c[2].audience_agent_id === null), "admin can send an announcement to all agents");
  ok(await p.$("#bellBtn") === null, "admin has no agent bell");
  await nav(p, "financial"); await p.waitForTimeout(600); await shot(p, "13-financial");
  await nav(p, 'staff'); await p.waitForTimeout(500);
  await nav(p, "export"); await p.waitForTimeout(400); await shot(p, "15-export");
  const dl = p.waitForEvent("download"); await p.click("#x-pay"); const d = await dl;
  ok(/creditflex-payments-.*\.csv/.test(d.suggestedFilename()), "admin can download payments CSV");
  await p.waitForTimeout(400);
  ok((await p.textContent("#x-msg")).includes("exported"), "export reports success");
  // bulk product upload
  await nav(p, "catalogue"); await p.waitForTimeout(500);
  await p.click("#addmany"); await p.waitForTimeout(500);
  ok(await p.$("#bk-paste") !== null, "Add many page opens from the catalogue");
  await p.fill("#bk-paste", "Blender, 300\nNasco TV 1,500\nGas cooker - GH₵ 1200\nMystery item\n\nTV stand\t85.50");
  await p.click("#bk-paste-go"); await p.waitForTimeout(300);
  ok((await p.$$("[data-row]")).length === 5, "pasted lines become 5 rows (blank line ignored)");
  const prices = await p.$$eval("[data-price]", els => els.map(e => e.value));
  ok(prices.join("|") === "300|1500|1200||85.5", "prices read from comma, dash, cedi sign and tab formats: " + prices.join("|"));
  const chips = await p.$$eval("[data-chip]", els => els.map(e => e.textContent));
  ok(chips[0].includes("Already exists") && chips[1] === "New product" && chips[3] === "Needs a price", "rows are checked: " + chips.join(" / "));
  await p.setInputFiles("#bk-photos", [{ name: "gas-cooker.png", mimeType: "image/png", buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64') }, { name: "new_fridge.png", mimeType: "image/png", buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64') }]);
  await p.waitForTimeout(800);
  ok((await p.$$("[data-row]")).length === 6 && (await p.$$("[data-row] img")).length === 2, "photos: one matched to Gas cooker, one new row created");
  ok((await p.$$eval("[data-name]", els => els.map(e => e.value))).includes("New Fridge"), "photo file name turned into a product name");
  await p.setInputFiles("#bk-csv", { name: "list.csv", mimeType: "text/csv", buffer: Buffer.from("Product,Price,In stock\nOven,900,no\n\"Iron, steam\",120,yes\n") });
  await p.waitForTimeout(400);
  ok((await p.$$("[data-row]")).length === 8, "CSV with header adds 2 more rows");
  await shot(p, "16-bulk");
  await p.click("#bk-save"); await p.waitForTimeout(300);
  ok((await p.textContent("#bk-msg")).includes("Fix the rows"), "Save is refused while a row has no price");
  const mysteryIdx = (await p.$$eval("[data-name]", els => els.map(e => e.value))).indexOf("Mystery item");
  await (await p.$$("[data-price]"))[mysteryIdx].fill("50");
  await (await p.$$("[data-price]"))[5].fill("700");
  await p.selectOption("#bk-ex", "update"); await p.waitForTimeout(200);
  ok((await p.$$eval("[data-chip]", els => els.map(e => e.textContent))).some(t => t.includes("price will be updated")), "update mode marks existing product for update");
  await p.click("#bk-save"); await p.waitForTimeout(1200);
  const bcalls = await p.evaluate(() => window.__calls);
  const ins = bcalls.filter(c => c[0] === "insert" && c[1] === "products").flatMap(c => c[2]);
  ok(ins.length === 7 && ins.some(x => x.name === "Nasco TV" && x.price === 1500) && ins.some(x => x.name === "Oven" && x.in_stock === false) && ins.some(x => x.name === "Gas cooker" && x.image_url === "x"), "all 7 new products saved in one go with prices, stock and photo: " + ins.map(x => x.name).join(","));
  ok(bcalls.some(c => c[0] === "update" && c[1] === "products" && c[2].price === 300), "existing Blender price updated");
  ok((await p.textContent("#bk-msg")).includes("7 added, 1 updated"), "summary reports 7 added, 1 updated");
  errs.push(...t.errors); await t.ctx.close();

  ok(errs.length === 0, "no JavaScript errors" + (errs.length ? ": " + JSON.stringify(errs) : ""));
  await browser.close(); server.close();
})();
