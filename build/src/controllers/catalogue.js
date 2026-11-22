/* CONTROLLER: Catalogue page. */
async function viewCatalogue() {
  const v = $("view"), admin = S.me.role === "admin";
  v.innerHTML = `<h1 class="${C.h1}">Catalogue</h1>${loading}`;
  const { data, error } = await cfLoadAll("products", "id,name,price,image_url,in_stock", ["name", "id"]);
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
  $("addmany").onclick = () => { go("bulk"); };
  v.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { open(data.find(x => x.id == b.dataset.e)); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

/* ---------- staff (admin) ---------- */
