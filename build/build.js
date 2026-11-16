const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dir = __dirname;

execFileSync(path.join(dir, "node_modules/.bin/tailwindcss"),
  ["-c", "tailwind.config.js", "-i", "input.css", "-o", "out.css", "--minify"], { cwd: dir, stdio: "inherit" });
const css = fs.readFileSync(path.join(dir, "out.css"), "utf8");

const icons = ["account_balance_wallet", "block", "call", "cancel", "check_circle", "delete", "edit", "error", "grid_view", "group", "hourglass_top", "image", "info", "inventory_2", "lock", "logout", "manage_accounts", "more_horiz", "palette", "payments", "person_add", "person_search", "query_stats", "receipt_long", "school", "search", "settings", "sync", "verified"].sort();
const url = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&amp;icon_names=" + icons.join(",") + "&amp;display=block";

let html = fs.readFileSync(path.join(dir, "src.html"), "utf8");
// every icon used in the source must be in the list
const used = new Set();
for (const m of html.matchAll(/ic\(\s*"([a-z0-9_]+)"/g)) used.add(m[1]);
for (const m of html.matchAll(/\["[a-z]+", "[^"]+", "([a-z0-9_]+)"\]/g)) used.add(m[1]);
for (const m of html.matchAll(/ic\(pend \? "([a-z_]+)" : "([a-z_]+)"/g)) { used.add(m[1]); used.add(m[2]); }
const missing = [...used].filter(n => !icons.includes(n));
if (missing.length) { console.error("MISSING ICONS:", missing); process.exit(1); }

html = html.replace("/*ICONS_URL*/", () => url).replace("/*CSS*/", () => css);
const out = process.argv[2] || path.join(dir, "..", "index.html");
fs.writeFileSync(out, html);
console.log("css bytes", css.length, "html bytes", html.length, "icons", icons.length, "->", out);
