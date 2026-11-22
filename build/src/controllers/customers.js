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
