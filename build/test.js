// Headless UI test with a fake Supabase. Run:  node test.js   (needs: npm install, and `npx playwright` browsers)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");
const dir = __dirname, shots = path.join(dir, "shots"); fs.mkdirSync(shots, { recursive: true });
const root = path.join(dir, "..");

const server = http.createServer((q, r) => {
  const f = path.join(root, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(fs.readFileSync(f));
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
    customers:[{id:1,full_name:'Ama Serwaa',phone:'0244128901',location:'Makola',registered_by:'u1',created_at:'2026-11-15T09:00:00Z'}],
    payments:[{id:5,purchase_id:1,amount:30,paid_on:'2026-11-15',collected_by:'u1',created_at:new Date().toISOString(),voided_at:null}],
    payment_audit_log:[],
    staff:[{id:'u1',full_name:'Kofi Mensah',email:'k@x.com',phone:'',role:cfg.role,status:'active',supervisor_id:null}]
  };
  const RPC={collection_summary:[{paid_on:'2026-11-15',agent_name:'Kofi Mensah',payments_count:3,total:90}],
    portfolio_summary:[{agent_name:'Kofi Mensah',active_purchases:2,outstanding:510}],
    check_recent_payment_duplicate:!!cfg.dup, complete_agent_onboarding:null, void_payment:null, register_customer:null, admin_update_staff:null};
  function builder(t){const b={_single:false};
    ['select','eq','order','limit','gte','lte','is','in'].forEach(m=>b[m]=()=>b);
    b.maybeSingle=()=>{b._single=true;return b;};
    b.insert=row=>{calls.push(['insert',t,row]);return b;}; b.update=row=>{calls.push(['update',t,row]);return b;};
    b.then=(res,rej)=>{let data=D[t]; if(b._single) data=(t==='staff'?D.staff_me:null);
      return Promise.resolve({data,error:null}).then(res,rej);};
    return b;}
  const sbm={auth:{getSession:async()=>({data:{session:cfg.loggedOut?null:{}}}),getUser:async()=>({data:{user:{id:'u1'}}}),
    signOut:async()=>({}),signInWithPassword:async()=>({error:{message:'Invalid login credentials'}}),signUp:async()=>({error:null}),
    resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null}),onAuthStateChange:()=>{}},
    from:t=>builder(t), rpc:async(n,a)=>{calls.push(['rpc',n,a]);return{data:RPC[n]??null,error:null};},
    storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'x'}})})}};
  window.supabase={createClient:()=>sbm};
})();`;

async function open(browser, cfg, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", ...ctxOpts });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith("http://localhost")) return route.continue();
    if (u.includes("@supabase/supabase-js")) return route.fulfill({ contentType: "application/javascript", body: stub(cfg) });
    return route.abort();
  });
  await page.goto("http://localhost:8765/"); await page.waitForTimeout(900);
  return { page, ctx, errors };
}
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
  await p.click('.cf-pick label:nth-child(3) input'); await p.click('.cf-pick label:nth-child(4) input');
  await p.click("#cf-w-go"); await p.waitForTimeout(300);
  ok((await p.textContent("#cf-tour-count")) === "STEP 1 OF 6", "tour has 6 steps after un-ticking 2");
  await shot(p, "02-tour-step");
  await p.click("#cf-tour-all"); await p.waitForTimeout(400);
  ok((await calls(p)).some(c => c[1] === "complete_agent_onboarding"), "skipping saves onboarding as complete");
  ok(await p.$("#cf-tour") === null, "tour closed after skip");
  errs.push(...t.errors); await t.ctx.close();

  // 2. returning agent: no tour; More menu; settings; credit
  t = await open(browser, { role: "agent", onboarded: true }); p = t.page;
  ok(await p.$("#cf-tour") === null, "no tour for returning agent");
  ok((await p.$$("nav button")).length === 5, "bottom bar has 5 buttons");
  await p.click('nav button[data-t="more"]'); await p.waitForTimeout(300); await shot(p, "03-more-agent");
  ok((await p.$$("[data-go]")).length === 4, "agent More menu has 4 items");
  await p.click('[data-go="settings"]'); await p.waitForTimeout(500); await shot(p, "04-settings");
  await p.click('#cf-theme button[data-v="dark"]'); await p.waitForTimeout(200); await shot(p, "05-settings-dark");
  await p.click('#cf-accents button[data-a="blue"]'); await p.waitForTimeout(200); await shot(p, "06-settings-blue-dark");
  await p.click('#cf-theme button[data-v="light"]');
  await p.click('nav button[data-t="more"]'); await p.click('[data-go="credit"]'); await p.waitForTimeout(300); await shot(p, "07-credit");
  const body = await p.textContent("body");
  ok(body.includes("020 670 9055") && body.includes("Blisscoenergy001@gmail.com"), "credit page shows phone and email");
  ok(await p.$('a[href="https://wa.me/233206709055"]') !== null, "credit page has WhatsApp link");
  await p.click('nav button[data-t="more"]'); await p.click('[data-go="analytics"]'); await p.waitForTimeout(600); await shot(p, "08-analytics");
  await p.click('nav button[data-t="more"]'); await p.click('[data-go="settings"]'); await p.waitForTimeout(300); await p.click("#cf-replay"); await p.waitForTimeout(300);
  ok(await p.$("#cf-w-go") !== null, "Replay training works from Settings");
  await p.click("#cf-w-skip"); await p.waitForTimeout(300);
  errs.push(...t.errors); await t.ctx.close();

  // 3. pay flow with a same-day duplicate
  t = await open(browser, { role: "agent", onboarded: true, dup: true }); p = t.page;
  await p.click('nav button[data-t="pay"]'); await p.waitForTimeout(700);
  ok(await p.$(".pick") !== null, "Record payment page loads with customers (helper bug fixed)");
  await p.click('.pick[data-id="1"]'); await p.waitForTimeout(600); await shot(p, "09-pay-dup-banner");
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
  await p.click('nav button[data-t="pay"]'); await p.waitForTimeout(600); await p.click('.pick[data-id="2"]'); await p.waitForTimeout(400);
  ok((await p.textContent("#dup")) === "", "no banner when nothing paid today");
  await p.click("#pb"); await p.waitForTimeout(600);
  ok((await calls(p)).filter(c => c[0] === "insert").length === 1, "single Save works when no duplicate");

  // 5. offline queue then sync
  await p.click('nav button[data-t="pay"]'); await p.waitForTimeout(500);
  await t.ctx.setOffline(true); await p.waitForTimeout(300);
  await p.click('nav button[data-t="pay"]'); await p.waitForTimeout(700);
  ok(await p.$(".pick") !== null, "offline: cached customer list is shown");
  await p.click('.pick[data-id="2"]'); await p.waitForTimeout(400); await p.fill("#amt", "20"); await p.click("#pb"); await p.waitForTimeout(700);
  await shot(p, "11-offline-queued");
  ok((await p.textContent("body")).includes("queued on this phone"), "offline payment is queued");
  const before = (await calls(p)).filter(c => c[0] === "insert").length;
  await t.ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event("online"))); await p.waitForTimeout(1500);
  ok((await calls(p)).filter(c => c[0] === "insert").length === before + 1, "queued payment syncs when back online");
  errs.push(...t.errors); await t.ctx.close();

  // 6. admin
  t = await open(browser, { role: "admin", onboarded: true }); p = t.page;
  ok(await p.$("#cf-tour") === null, "admin never sees the first-login tour");
  await p.click('nav button[data-t="more"]'); await p.waitForTimeout(300); await shot(p, "12-more-admin");
  ok((await p.$$("[data-go]")).length === 6, "admin More menu has 6 items");
  await p.click('[data-go="financial"]'); await p.waitForTimeout(600); await shot(p, "13-financial");
  await p.click('nav button[data-t="more"]'); await p.click('[data-go="staff"]'); await p.waitForTimeout(500);
  errs.push(...t.errors); await t.ctx.close();

  ok(errs.length === 0, "no JavaScript errors" + (errs.length ? ": " + JSON.stringify(errs) : ""));
  await browser.close(); server.close();
})();
