/* MODEL: purchases and what is still owed (the purchase_ledger view). */
const Purchases = {
  active: () => cfLoadAll("purchase_ledger", "purchase_id,customer_id,customer_name,customer_phone,product_id,product_name,plan_name,total_price,installment_amount,amount_paid,balance,payments_made,status", ["customer_name", "purchase_id"], q => q.eq("status", "active")),
  forCustomer: customerId => cfRead("stmt:" + customerId, () => sb.from("purchase_ledger").select("purchase_id,product_name,plan_name,agent_name,total_price,installment_amount,amount_paid,balance,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false })),
  historyFor: ids => sb.from("purchase_ledger").select("purchase_id,customer_id,product_id").in("purchase_id", ids),
  forReview: () => cfLoadAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,agent_name", "purchase_id"),
  exportPaymentsLedger: () => cfFetchAll("purchase_ledger", "purchase_id,customer_name,customer_phone,product_name,total_price", "purchase_id"),
  exportAll: () => cfFetchAll("purchase_ledger", "*", "purchase_id")
};
