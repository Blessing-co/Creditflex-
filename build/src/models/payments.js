/* MODEL: payments: recording, reviewing, reversing and listing. */
const Payments = {
  record: (row, withOfflineId) => sb.from("payments").insert(withOfflineId ? row : { purchase_id: row.purchase_id, amount: row.amount, paid_on: row.paid_on, collected_by: row.collected_by }).select("id").maybeSingle(),
  insertRaw: payload => sb.from("payments").insert(payload),
  findByOfflineId: id => sb.from("payments").select("id").eq("offline_submission_id", id).maybeSingle(),
  duplicateToday: (customerId, productId) => sb.rpc("check_recent_payment_duplicate", { p_customer_id: customerId, p_product_id: productId }),
  mineSince: (agentId, since) => sb.from("payments").select("purchase_id,created_at").eq("collected_by", agentId).gte("created_at", since).is("voided_at", null),
  forStatement: (customerId, ids) => cfRead("stmtp:" + customerId, () => sb.from("payments").select("id,purchase_id,amount,paid_on,created_at,voided_at").in("purchase_id", ids).is("voided_at", null).order("paid_on", { ascending: true })),
  recent: () => sb.from("payments").select("id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason").order("created_at", { ascending: false }).limit(150),
  auditLog: () => sb.from("payment_audit_log").select("*").order("event_at", { ascending: false }).limit(150),
  reverse: (paymentId, reason) => sb.rpc("void_payment", { p_payment_id: paymentId, p_reason: reason }),
  between: (from, to) => cfLoadAll("payments", "id,amount,paid_on,collected_by", ["paid_on", "id"], q => q.gte("paid_on", from).lte("paid_on", to).is("voided_at", null)),
  exportAll: () => cfFetchAll("payments", "id,purchase_id,amount,paid_on,collected_by,created_at,voided_at,void_reason", "id"),
  sendSms: paymentId => sb.functions.invoke("send-payment-sms", { body: { payment_id: paymentId } })
};
