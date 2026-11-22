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
