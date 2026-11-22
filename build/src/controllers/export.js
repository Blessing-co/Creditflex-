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
  const staffName = async () => { const m = {}; (await cfFetchAll("staff", "id,full_name", "full_name")).forEach(x => m[x.id] = x.full_name); return m; };
  const jobs = {
    async pay() {
      const [pays, led, names] = await Promise.all([cfFetchAll("payments", "id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason", "id"), cfFetchAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,total_price", "purchase_id"), staffName()]);
      const L = {}; led.forEach(x => L[x.purchase_id] = x);
      const run = cfRunning(pays, k => (L[k] || {}).total_price);
      cfCsvDownload("creditflex-payments-" + stamp() + ".csv", [["Payment ID", "Date", "Amount (GHS)", "Customer", "Phone", "Product", "Price (GHS)", "Paid so far (GHS)", "Balance after this payment (GHS)", "Collected by", "Recorded at", "Cancelled", "Cancel reason"], ...pays.map(p => { const l = L[p.purchase_id] || {}; return [p.id, p.paid_on, p.amount, l.customer_name, l.customer_phone, l.product_name, l.total_price, (run.get(p.id) || {}).paid ?? "", (run.get(p.id) || {}).balance ?? "", names[p.collected_by] || "", p.created_at, p.voided_at ? "yes" : "no", p.void_reason || ""]; })]);
      return pays.length;
    },
    async cus() {
      const [cs, names] = await Promise.all([cfFetchAll("customers", "id,full_name,phone,location,registered_by,created_at", "id"), staffName()]);
      cfCsvDownload("creditflex-customers-" + stamp() + ".csv", [["ID", "Name", "Phone", "Location", "Registered by", "Created"], ...cs.map(c => [c.id, c.full_name, c.phone, c.location, names[c.registered_by] || "", c.created_at])]);
      return cs.length;
    },
    async pur() {
      const led = await cfFetchAll("purchase_ledger", "*", "purchase_id");
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
