/* MODEL: staff (admins and agents). Every function returns Supabase's { data, error }. */
const Staff = {
  me: id => sb.from("staff").select("id,full_name,email,phone,role,status,supervisor_id,onboarding_completed_at").eq("id", id).maybeSingle(),
  all: () => cfLoadAll("staff", "id,full_name,email,phone,role,status,supervisor_id,created_at", ["status","full_name","id"]),
  names: () => cfLoadAll("staff", "id,full_name", "id"),
  namesList: async () => (await cfFetchAll("staff", "id,full_name", "full_name")),
  namesIn: ids => sb.from("staff").select("id,full_name").in("id", ids),
  everyone: () => sb.from("staff").select("id,full_name"),
  activeAgents: () => sb.from("staff").select("id,full_name").eq("role", "agent").eq("status", "active").order("full_name"),
  adminUpdate: (id, status, role, supervisorId) => sb.rpc("admin_update_staff", { p_staff_id: id, p_status: status, p_role: role, p_supervisor_id: supervisorId || null }),
  completeOnboarding: () => sb.rpc("complete_agent_onboarding")
};
