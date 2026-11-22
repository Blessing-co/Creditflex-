const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dir = __dirname;

execFileSync(path.join(dir, "node_modules/.bin/tailwindcss"),
  ["-c", "tailwind.config.js", "-i", "input.css", "-o", "out.css", "--minify"], { cwd: dir, stdio: "inherit" });
const css = fs.readFileSync(path.join(dir, "out.css"), "utf8");

const icons = ["account_balance_wallet", "add", "arrow_back", "policy", "photo_library", "upload_file", "block", "call", "cancel", "check_circle", "delete", "download", "event", "bug_report", "visibility", "visibility_off", "campaign", "notifications", "send", "menu", "edit", "error", "grid_view", "group", "hourglass_top", "image", "info", "inventory_2", "lock", "logout", "manage_accounts", "more_horiz", "palette", "payments", "person_add", "person_search", "query_stats", "receipt_long", "school", "search", "settings", "sync", "verified"].sort();
const url = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&amp;icon_names=" + icons.join(",") + "&amp;display=block";

const srcDir = path.join(dir, "src");
let html = fs.readFileSync(path.join(srcDir, "index.html"), "utf8");
// The app is written as small files in folders (core, models, views, controllers, routes) and joined, in this order, into one app.js for the phone.
const ORDER = ["core/config.js", "core/errors.js", "core/net.js", "core/client.js", "core/state.js", "core/ui.js", "core/security.js", "core/pwa.js", "core/eye.js",
  "models/data.js", "models/ledger.js", "models/auth.js", "models/staff.js", "models/products.js", "models/plans.js", "models/customers.js",
  "models/payments.js", "models/purchases.js", "models/summary.js", "models/reports.js", "models/announcements.js", "models/offline.js",
  "routes.js", "views/shell.js", "views/hub.js", "views/auth.js",
  "controllers/session.js", "controllers/collections.js", "controllers/pay.js", "controllers/customers.js", "controllers/catalogue.js", "controllers/staff.js",
  "controllers/tour.js", "controllers/learn.js", "controllers/analytics.js", "controllers/settings.js", "controllers/account.js", "controllers/financial.js",
  "controllers/export.js", "controllers/credit.js", "controllers/report.js", "controllers/bulk.js", "controllers/notices.js", "controllers/legal.js", "controllers/lock.js", "main.js"];
const onDisk = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) onDisk.push(path.relative(srcDir, p)); } })(srcDir);
const forgotten = onDisk.filter(f => !ORDER.includes(f));
if (forgotten.length) { console.error("Source files not listed in ORDER (build.js): " + forgotten.join(", ")); process.exit(1); }
const bundle = ORDER.map(f => "/* ===== " + f + " ===== */\n" + fs.readFileSync(path.join(srcDir, f), "utf8")).join("\n;\n");
const js = [["app.js", bundle.replace("__BUILD__", new Date().toISOString().slice(0, 16).replace("T", " "))]];
// every icon used in the source must be in the list
const used = new Set();
for (const text of [html, ...js.map(x => x[1])]) {
  for (const m of text.matchAll(/ic\(\s*"([a-z0-9_]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/\["[a-z]+", "[^"]+", "([a-z0-9_]+)"\]/g)) used.add(m[1]);
  for (const m of text.matchAll(/ic\(pend \? "([a-z_]+)" : "([a-z_]+)"/g)) { used.add(m[1]); used.add(m[2]); }
}
const missing = [...used].filter(n => !icons.includes(n));
if (missing.length) { console.error("MISSING ICONS:", missing); process.exit(1); }

html = html.replace("/*ICONS_URL*/", () => url);
const outDir = process.argv[2] || path.join(dir, "..");
fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, "styles.css"), css);
for (const [f, text] of js) fs.writeFileSync(path.join(outDir, f), text);
// the Supabase library is served from this repo (exact version pinned in package.json), not from a public CDN
fs.mkdirSync(path.join(outDir, "vendor"), { recursive: true });
fs.copyFileSync(path.join(dir, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"), path.join(outDir, "vendor", "supabase.js"));
console.log("html", html.length, "css", css.length, "js", js.map(x => x[0] + " " + x[1].length).join(", "), "icons", icons.length, "->", outDir);
