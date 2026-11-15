const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const shots = path.join(dir, "shots");
fs.mkdirSync(shots, { recursive: true });
const file = process.argv[2] || path.join(dir, "index.html");

const svg = c => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='${c}'/><circle cx='150' cy='150' r='70' fill='white' opacity='.6'/></svg>`).replace(/'/g, "%27");

const stub = (cfg) => `
(function(){
  const cfg = ${JSON.stringify(cfg)};
  const calls = []; window.__calls = calls;
  const D = {
    staff_me: { id:'u1', full_name:'Kofi Mensah', role: cfg.role, status: cfg.status, email:'k@x.com' },
    purchase_ledger: [
      { purchase_id:1, customer_name:'Ama Serwaa', customer_phone:'0244128901', product_name:'Bruhm Blender 2-in-1', plan_name:'8-week weekly', balance:90, amount_paid:180, total_price:270, payments_made:6, installment_amount:30, status:'active' },
      { purchase_id:2, customer_name:'Kofi Mensah-Boateng Junior', customer_phone:'0201112233', product_name:'Nasco 32 inch Satellite TV with long name', plan_name:'30-day daily', balance:420, amount_paid:80, total_price:500, payments_made:4, installment_amount:20, status:'active' },
      { purchase_id:3, customer_name:'Akosua Badu', customer_phone:'', product_name:'Samsung Microwave 23L', plan_name:'60-day daily', balance:150, amount_paid:0, total_price:150, payments_made:0, installment_amount:2.5, status:'active' }
    ],
    products: [
      { id:1, name:'Bruhm Blender 2-in-1', price:270, image_url:'${svg("#0b6b4f")}', in_stock:true },
      { id:2, name:'Nasco 32 inch Satellite TV', price:500, image_url:'${svg("#885200")}', in_stock:false },
      { id:3, name:'Office Chair', price:320, image_url:null, in_stock:true },
      { id:4, name:'Samsung Microwave 23L', price:150, image_url:'${svg("#535f71")}', in_stock:true }
    ],
    customers: [ { id:1, full_name:'Ama Serwaa', phone:'0244128901', location:'Makola', registered_by:'u1', created_at:'2026-11-14T09:00:00Z' } ],
    payment_plans: [ { id:1, name:'30-day daily', frequency:'daily', installments:30 }, { id:2, name:'8-week weekly', frequency:'weekly', installments:8 } ],
    staff: [
      { id:'s1', full_name:'Yaw Asante', email:'yaw@x.com', phone:'0240000001', role:'agent', status:'pending', supervisor_id:null },
      { id:'u1', full_name:'Kofi Mensah', email:'k@x.com', phone:'0240000002', role:'admin', status:'active', supervisor_id:null },
      { id:'s2', full_name:'Efua Owusu', email:'efua@x.com', phone:'', role:'supervisor', status:'active', supervisor_id:null },
      { id:'s3', full_name:'Kwame Old', email:'kw@x.com', phone:'', role:'agent', status:'disabled', supervisor_id:'s2' }
    ]
  };
  const RPC = {
    collection_summary: cfg.emptyCollections ? [] : [
      { paid_on:'2026-11-14', agent_name:'Kofi Mensah', payments_count:12, total:360 },
      { paid_on:'2026-11-14', agent_name:'Efua Owusu', payments_count:1, total:1234567.5 }
    ],
    portfolio_summary: [ { agent_name:'Kofi Mensah', active_purchases:14, outstanding:5230 }, { agent_name:'Efua Owusu', active_purchases:2, outstanding:640 } ],
    register_customer: null, admin_update_staff: null
  };
  function builder(table){
    const b = { _single:false, _err:null };
    ['select','eq','order','limit','gte','lte'].forEach(m => b[m] = () => b);
    b.maybeSingle = () => { b._single = true; return b; };
    b.insert = row => { calls.push(['insert', table, row]); return b; };
    b.update = row => { calls.push(['update', table, row]); return b; };
    b.then = (res, rej) => {
      let data = table === 'staff' && b._single ? D.staff_me : D[table];
      if (cfg.failTable === table) return Promise.resolve({ data:null, error:{ message:'permission denied for table '+table } }).then(res, rej);
      return Promise.resolve({ data, error:null }).then(res, rej);
    };
    return b;
  }
  const sbm = {
    auth: {
      getSession: async () => ({ data:{ session: cfg.loggedOut ? null : {} } }),
      getUser: async () => ({ data:{ user:{ id:'u1' } } }),
      signOut: async () => ({}), signInWithPassword: async a => { calls.push(['signin', a.email]); return { error:{ message:'Invalid login credentials' } }; },
      resetPasswordForEmail: async (e,o) => { calls.push(['reset', e, o.redirectTo]); return { error:null }; }, updateUser: async a => { calls.push(['updateUser']); return { error:null }; }, signUp: async a => { calls.push(['signup', a.email]); return { error:null }; },
      onAuthStateChange: () => {}
    },
    from: t => builder(t),
    rpc: async (n, a) => { calls.push(['rpc', n, a]); return { data: RPC[n] ?? null, error:null }; },
    storage: { from: () => ({ upload: async () => ({ error:null }), getPublicUrl: () => ({ data:{ publicUrl:'x' } }) }) }
  };
  window.supabase = { createClient: () => sbm };
})();`;

async function newPage(browser, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/*", async route => {
    const u = route.request().url();
    if (u.startsWith("file://")) return route.continue();
    if (u.includes("@supabase/supabase-js")) return route.fulfill({ contentType: "application/javascript", body: stub(cfg) });
    if (u.includes("fonts.googleapis.com/css2") && u.includes("Public+Sans")) {
      const w = [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Public Sans';font-weight:${w};src:url(https://fonts.gstatic.com/local/ps-${w}.woff2) format('woff2');}`).join("");
      return route.fulfill({ contentType: "text/css", body: w });
    }
    if (u.includes("fonts.googleapis.com/css2") && u.includes("Material+Symbols")) {
      return route.fulfill({ contentType: "text/css", body: `@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/local/ms.woff2) format('woff2');}` });
    }
    if (u.includes("fonts.gstatic.com/local/ms.woff2")) return route.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(dir, "node_modules/material-symbols/material-symbols-outlined.woff2")) });
    const m = u.match(/local\/ps-(\d+)\.woff2/);
    if (m) return route.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(dir, `node_modules/@fontsource/public-sans/files/public-sans-latin-${m[1]}-normal.woff2`)) });
    return route.abort();
  });
  await page.goto("file://" + file);
  await page.waitForTimeout(700);
  return { page, errors, ctx };
}

async function metrics(page, label) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, icons: document.documentElement.classList.contains("icons") }));
  console.log(label, JSON.stringify(m), m.sw > m.iw ? "  <-- HORIZONTAL OVERFLOW" : "");
}
const full = (page, name) => page.screenshot({ path: path.join(shots, name + ".png"), fullPage: true });

(async () => {
  const browser = await chromium.launch();
  const allErrors = [];

  // 1. login + signup
  let t = await newPage(browser, { role: "admin", status: "active", loggedOut: true });
  await metrics(t.page, "login"); await full(t.page, "01-login");
  await t.page.fill('#em','a@b.com'); await t.page.click('#fp'); await t.page.waitForTimeout(200); console.log('reset call:', JSON.stringify((await t.page.evaluate(() => window.__calls)).filter(c => c[0]==='reset'))); await full(t.page, '02b-forgot');
  await t.page.click("#swap"); await t.page.waitForTimeout(200); await full(t.page, "02-signup");
  await t.page.click("#swap"); await t.page.fill("#em", "a@b.com"); await t.page.fill("#pw", "secret1"); await t.page.click("#authBtn"); await t.page.waitForTimeout(300);
  await full(t.page, "03-login-error");
  allErrors.push(...t.errors); await t.ctx.close();

  // 2. pending + disabled
  for (const st of ["pending", "disabled"]) {
    t = await newPage(browser, { role: "agent", status: st });
    await metrics(t.page, "blocked-" + st); await full(t.page, "04-blocked-" + st);
    allErrors.push(...t.errors); await t.ctx.close();
  }

  // 3. admin, all tabs
  t = await newPage(browser, { role: "admin", status: "active" });
  const p = t.page;
  await metrics(p, "collections"); await full(p, "10-collections");
  await p.click('nav button[data-t="pay"]'); await p.waitForTimeout(400);
  await metrics(p, "pay"); await full(p, "11-pay-list");
  await p.click('.pick[data-id="1"]'); await p.waitForTimeout(500);
  await metrics(p, "pay-selected"); await full(p, "12-pay-selected");
  await p.click("#cFull"); const full_v = await p.inputValue("#amt");
  await p.click("#cInst"); const inst_v = await p.inputValue("#amt");
  console.log("chips: full =", full_v, " installment =", inst_v);
  await p.fill("#amt", "30"); await p.click("#pb"); await p.waitForTimeout(600);
  console.log("payment insert:", JSON.stringify((await p.evaluate(() => window.__calls)).filter(c => c[0] === "insert")));
  await metrics(p, "pay-after-save"); await full(p, "13-pay-saved");
  await p.fill("#q", "zzz"); await p.waitForTimeout(200); await full(p, "14-pay-empty");
  await p.click('nav button[data-t="register"]'); await p.waitForTimeout(500);
  await metrics(p, "register"); await full(p, "15-register");
  await p.fill("#n", "Test Ama"); await p.fill("#p", "0241234567"); await p.fill("#l", "Makola"); await p.click("#rb"); await p.waitForTimeout(500);
  console.log("register rpc:", JSON.stringify((await p.evaluate(() => window.__calls)).filter(c => c[1] === "register_customer")));
  await full(p, "16-register-saved");
  await p.click('nav button[data-t="catalogue"]'); await p.waitForTimeout(500);
  await metrics(p, "catalogue"); await full(p, "17-catalogue");
  await p.click('[data-e="2"]'); await p.waitForTimeout(500); await metrics(p, "catalogue-edit"); await full(p, "18-catalogue-edit");
  await p.click('nav button[data-t="staff"]'); await p.waitForTimeout(500);
  await metrics(p, "staff"); await full(p, "19-staff");
  await p.click('[data-s="s1"] .sv'); await p.waitForTimeout(400);
  console.log("staff rpc:", JSON.stringify((await p.evaluate(() => window.__calls)).filter(c => c[1] === "admin_update_staff")));
  await full(p, "20-staff-saved");
  await p.click('nav button[data-t="collections"]'); await p.waitForTimeout(500);
  allErrors.push(...t.errors); await t.ctx.close();

  // 4. agent view: no staff tab, no admin buttons; error state; empty collections
  t = await newPage(browser, { role: "agent", status: "active", emptyCollections: true });
  console.log("agent tabs:", await t.page.$$eval("nav button", b => b.map(x => x.textContent.trim().replace(/\s+/g, " "))));
  await full(t.page, "21-agent-collections-empty");
  await t.page.click('nav button[data-t="catalogue"]'); await t.page.waitForTimeout(400);
  console.log("agent sees add/edit:", await t.page.$$eval("#add, [data-e]", e => e.length));
  await full(t.page, "22-agent-catalogue");
  allErrors.push(...t.errors); await t.ctx.close();

  t = await newPage(browser, { role: "agent", status: "active", failTable: "purchase_ledger" });
  await t.page.click('nav button[data-t="pay"]'); await t.page.waitForTimeout(400); await full(t.page, "23-pay-error");
  allErrors.push(...t.errors); await t.ctx.close();

  // 5. wide screen
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.close();

  console.log("JS ERRORS:", allErrors.length ? allErrors : "none");
  await browser.close();
})();
