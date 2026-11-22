/* CONTROLLER: Collections page. */
async function viewCollections() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Collections</h1>
    <section class="${C.card}">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${C.lbl}" for="df">From</label><input type="date" id="df" class="${C.inp}" value="${today()}"></div>
        <div><label class="${C.lbl}" for="dt">To</label><input type="date" id="dt" class="${C.inp}" value="${today()}"></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4"><button class="${C.btn}" id="go">Show</button><button class="${C.btn2}" id="csv">Export CSV</button></div><div id="cm"></div>
    </section>
    <div id="out"></div><div id="nc"></div><div id="port"></div>`;
  let exportRows=[];
  const load = async () => {
    const f = $("df").value, t = $("dt").value;
    $("out").innerHTML = loading;
    const { data, error } = await sb.rpc("collection_summary", { p_from: f, p_to: t });
    if (error) { $("out").innerHTML = ""; return say("cm", cfErr(error)); }
    exportRows=data||[];
    say("cm", "");
    const total = data.reduce((a, r) => a + Number(r.total), 0), cnt = data.reduce((a, r) => a + r.payments_count, 0);
    $("out").innerHTML = `<section class="bg-primary-container text-on-primary rounded-xl p-4 shadow-md">
        <div class="text-label-md uppercase opacity-80">Collected</div>
        <div class="text-currency-display break-words">${money(total)}</div>
        <div class="mt-2 inline-flex items-center gap-2 bg-on-primary/15 rounded-full px-3 py-1 text-label-md"><span>Payments</span><span class="text-label-lg">${cnt}</span></div>
      </section>
      <section class="${C.card} mt-4">
      ${data.length ? `<div class="flex justify-between text-label-md text-on-surface-variant uppercase pb-2"><span>Date · Agent</span><span>Count · Total</span></div><div class="divide-y divide-outline-variant/40">
      ${data.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.agent_name)}</div><div class="${C.mute}">${esc(r.paid_on)}</div></div><div class="text-right shrink-0"><div class="text-currency-item">${money(r.total)}</div><div class="${C.mute}">${r.payments_count} payment${r.payments_count == 1 ? "" : "s"}</div></div></div>`).join("")}</div>`
      : `<div class="text-center py-4"><div class="w-12 h-12 mx-auto rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">${ic("inventory_2", "text-[26px]")}</div><p class="${C.mute} mt-2">No payments in this range.</p></div>`}
      </section>`;
  };
  const loadNew = async () => {
    const f = $("df").value, t = $("dt").value;
    $("nc").innerHTML = "";
    const [c, st] = await Promise.all([
      sb.from("customers").select("id,full_name,phone,location,registered_by,created_at").gte("created_at", f + "T00:00:00").lte("created_at", t + "T23:59:59.999").order("created_at", { ascending: false }).limit(200),
      sb.from("staff").select("id,full_name")
    ]);
    if (c.error || !c.data) return;
    const names = {}; (st.data || []).forEach(x => names[x.id] = x.full_name);
    const rows = c.data;
    $("nc").innerHTML = `<section class="${C.card} mt-4"><div class="flex items-center justify-between mb-2"><h2 class="text-title-md flex items-center gap-2">${ic("person_add", "text-[22px] text-primary")}New customers</h2><span class="text-label-lg bg-primary-fixed text-on-surface rounded-full px-3 py-1">${rows.length}</span></div>
      ${rows.length ? `<div class="divide-y divide-outline-variant/40">${rows.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.full_name)}</div><div class="${C.mute} truncate">${esc(r.phone || "No phone")}${r.location ? " · " + esc(r.location) : ""}</div></div><div class="text-right shrink-0"><div class="text-label-lg">${esc(names[r.registered_by] || "Agent")}</div><div class="${C.mute}">${esc(String(r.created_at).slice(0, 10))}</div></div></div>`).join("")}</div>` : `<p class="${C.mute} py-2">No new customers in this range.</p>`}
    </section>`;
  };
  $("go").onclick = () => { load(); loadNew(); };
  $("csv").onclick=()=>{if(!exportRows.length)return say("cm","There are no collection rows to export for this date range.");const cell=v=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"' + s.replace(/"/g,'""') + '"';};const lines=[["Date","Agent","Payments","Total (GHS)"],...exportRows.map(r=>[r.paid_on,r.agent_name,r.payments_count,r.total])].map(row=>row.map(cell).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\ufeff"+lines],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="creditflex-collections-"+$("df").value+"-to-"+$("dt").value+".csv";a.click();URL.revokeObjectURL(url);};
  load(); loadNew();
  const { data: port } = await sb.rpc("portfolio_summary");
  if (port && port.length) {
    const out = port.reduce((a, r) => a + Number(r.outstanding), 0);
    $("port").innerHTML = `<section class="${C.card}"><h2 class="text-title-md mb-3">Money still owed</h2>
      <div class="grid grid-cols-2 gap-3">
        <div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Outstanding</div><div class="text-currency-item text-tertiary-container break-words">${money(out)}</div></div>
        <div class="${C.stat}"><div class="text-label-md text-on-surface-variant uppercase">Active purchases</div><div class="text-currency-item">${port.reduce((a, r) => a + r.active_purchases, 0)}</div></div>
      </div>
      <div class="flex justify-between text-label-md text-on-surface-variant uppercase pt-4 pb-1"><span>Agent · Active</span><span>Owed</span></div>
      <div class="divide-y divide-outline-variant/40">${port.map(r => `<div class="flex items-center justify-between gap-3 py-3"><div class="min-w-0"><div class="text-body-lg font-bold truncate">${esc(r.agent_name)}</div><div class="${C.mute}">${r.active_purchases} active</div></div><div class="text-currency-item shrink-0">${money(r.outstanding)}</div></div>`).join("")}</div></section>`;
  }
}

/* ---------- record payment ---------- */
