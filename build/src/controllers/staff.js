/* CONTROLLER: Staff page (admin). */
async function viewStaff() {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Staff</h1>${loading}`;
  const { data: raw, error } = await cfLoadAll("staff", "id,full_name,email,phone,role,status,supervisor_id,created_at", ["status","full_name","id"]);
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Staff</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  const rank = { pending: 0, active: 1, disabled: 2 };
  const data = [...raw].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const pending = data.filter(s => s.status === "pending").length;
  const sups = data.filter(s => s.status === "active" && ["supervisor", "admin"].includes(s.role));
  const sel = `${C.inp} !h-12`;
  v.innerHTML = `<h1 class="${C.h1}">Staff</h1><div id="sm"></div>
    ${pending ? `<div class="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl p-3 text-label-lg flex items-center gap-2">${ic("hourglass_top", "text-[20px]")}${pending} waiting for approval</div>` : ""}
    ${data.map(s => `<section class="${C.card} space-y-3" data-s="${s.id}">
      <div class="flex items-start justify-between gap-2"><div class="min-w-0 flex items-center gap-3"><span class="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-title-md shrink-0">${esc(initials(s.full_name))}</span><div class="min-w-0"><b class="block text-title-md truncate">${esc(s.full_name)}</b><span class="block ${C.mute} truncate">${esc(s.email || "")} ${esc(s.phone || "")}</span></div></div>
      <span class="shrink-0 text-label-md rounded-full px-2.5 py-1 ${s.status === "pending" ? "bg-tertiary-fixed text-on-tertiary-fixed" : s.status === "active" ? "bg-primary-fixed text-on-primary-fixed" : "bg-error-container text-on-error-container"}">${esc(s.status)}</span></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="${C.lbl}">Status</label><select class="st ${sel}"><option value="pending">Pending</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
        <div><label class="${C.lbl}">Role</label><select class="ro ${sel}"><option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
      </div>
      <div><label class="${C.lbl}">Supervisor</label><select class="su ${sel}"><option value="">No supervisor</option>${sups.filter(x => x.id !== s.id).map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join("")}</select></div>
      <button class="${C.btn} sv" type="button">Save</button></section>`).join("")}`;
  v.querySelectorAll("[data-s]").forEach(el => {
    const s = data.find(x => x.id === el.dataset.s);
    el.querySelector(".st").value = s.status; el.querySelector(".ro").value = s.role; el.querySelector(".su").value = s.supervisor_id || "";
    el.querySelector(".sv").onclick = async () => {
      const { error } = await sb.rpc("admin_update_staff", { p_staff_id: s.id, p_status: el.querySelector(".st").value, p_role: el.querySelector(".ro").value, p_supervisor_id: el.querySelector(".su").value || null });
      say("sm", error ? cfErr(error) : `${s.full_name} updated.`, !error);
      if (!error) window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") { S.me = null; } if (ev === "PASSWORD_RECOVERY") { S.recovery = true; renderNewPassword(); } });
