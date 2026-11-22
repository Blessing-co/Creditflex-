/* MODEL: running balance calculation. */
function cfRunning(pays, priceOf) {
  const sorted = [...pays].sort((x, y) => String(x.created_at || x.paid_on).localeCompare(String(y.created_at || y.paid_on)) || Number(x.id) - Number(y.id));
  const paid = {}, out = new Map();
  sorted.forEach(p => {
    const k = p.purchase_id, price = Number(priceOf(k) || 0);
    if (p.voided_at) { out.set(p.id, null); return; }
    paid[k] = Math.round(((paid[k] || 0) + Number(p.amount)) * 100) / 100;
    out.set(p.id, { paid: paid[k], balance: Math.round((price - paid[k]) * 100) / 100 });
  });
  return out;
}

/* ---------- SMS receipt (sent by a server function; the SMS key never reaches the phone) ---------- */
