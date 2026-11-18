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
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  for (const quality of [0.82, 0.65, 0.5]) {
    const blob = await new Promise(res => cv.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= 2000000) return blob;
  }
  throw new Error("Photo is too big even after shrinking.");
}

window.viewCreditflexBulk = async function () {
  const v = $("view");
  if (S.me.role !== "admin") { S.tab = "collections"; return renderShell(); }
  v.innerHTML = `<h1 class="${C.h1}">Add many products</h1>${loading}`;
  const ex = await sb.from("products").select("id,name,price,in_stock,image_url").order("name");
  if (ex.error) return v.innerHTML = `<h1 class="${C.h1}">Add many products</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(ex.error.message)}</div>`;
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

  $("bk-back").onclick = () => { S.tab = "catalogue"; renderShell(); };
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
          const up = await sb.storage.from("product-images").upload(path, r.photo, { contentType: r.photo.type || "image/jpeg" });
          if (up.error) { result.photosFailed++; r.url = null; } else r.url = sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
          prog("Uploading photos… " + (++done) + " of " + withPhotos.length);
        }
      }));
      /* 2. new products in batches, falling back to one by one to find a bad row */
      const saved = new Set();
      for (let i = 0; i < news.length; i += 50) {
        const chunk = news.slice(i, i + 50); prog("Saving products… " + Math.min(i + 50, news.length) + " of " + news.length);
        const payload = chunk.map(r => ({ name: r.name, price: r.price, in_stock: r.in_stock, image_url: r.url || null }));
        const b = await sb.from("products").insert(payload);
        if (!b.error) { chunk.forEach(r => saved.add(r.id)); result.added += chunk.length; continue; }
        for (const r of chunk) {
          const one = await sb.from("products").insert({ name: r.name, price: r.price, in_stock: r.in_stock, image_url: r.url || null });
          if (one.error) { r.err = one.error.message; result.failed++; } else { saved.add(r.id); result.added++; }
        }
      }
      /* 3. updates to products that already exist */
      for (const r of upds) {
        const e = existing.get(norm(r.name)); const patch = { price: r.price, in_stock: r.in_stock }; if (r.url) patch.image_url = r.url;
        const u = await sb.from("products").update(patch).eq("id", e.id);
        if (u.error) { r.err = u.error.message; result.failed++; } else { saved.add(r.id); result.updated++; }
      }
      rows = rows.filter(r => !saved.has(r.id));
      const again = await sb.from("products").select("id,name,price,in_stock,image_url");
      if (!again.error) { existing.clear(); (again.data || []).forEach(p => existing.set(norm(p.name), p)); }
      const parts = []; if (result.added) parts.push(result.added + " added"); if (result.updated) parts.push(result.updated + " updated");
      let msg = (parts.join(", ") || "Nothing saved") + ".";
      if (result.photosFailed) msg += " " + result.photosFailed + " photo" + (result.photosFailed > 1 ? "s" : "") + " could not be uploaded (add them later with Edit).";
      if (result.failed) msg += " " + result.failed + " could not be saved. They stay in the list with the reason.";
      paintRows(); say("bk-msg", msg, !result.failed);
      if (!result.failed) $("bk-msg").insertAdjacentHTML("beforeend", `<button id="bk-open" type="button" class="${C.btn2} w-full mt-2">${ic("inventory_2", "text-[20px]")}<span>Open the catalogue</span></button>`), $("bk-open").onclick = () => { S.tab = "catalogue"; renderShell(); };
    } catch (err) { say("bk-msg", err.message || "Saving failed. Nothing more was saved; check the list and try again."); }
    saving = false; busy(btn, false); paintChips();
  };

  paintRows();
};
})();
