/* MODEL: problem reports sent by agents to the admin. */
const Reports = {
  send: row => sb.from("problem_reports").insert(row),
  mine: staffId => sb.from("problem_reports").select("id,message,status,created_at").eq("reporter_id", staffId).order("created_at", { ascending: false }).limit(10),
  all: () => sb.from("problem_reports").select("*").order("created_at", { ascending: false }).limit(100),
  setStatus: (id, status) => sb.from("problem_reports").update({ status }).eq("id", id)
};
