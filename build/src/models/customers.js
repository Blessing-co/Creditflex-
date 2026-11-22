/* MODEL: customers. */
const Customers = {
  all: () => cfLoadAll("customers", "id,full_name,phone,location", ["full_name", "id"]),
  registeredBetween: (from, to) => sb.from("customers").select("id,full_name,phone,location,registered_by,created_at").gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59.999").order("created_at", { ascending: false }).limit(200),
  register: (args, submissionId) => sb.rpc("register_customer", { ...args, p_submission_id: submissionId }),
  exportAll: () => cfFetchAll("customers", "id,full_name,phone,location,registered_by,created_at", "id")
};
