/* MODEL: announcements, read receipts and phone-notification subscriptions. */
const Announcements = {
  listMine: () => cfRead("notices", () => sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(40)),
  myReads: staffId => cfRead("notice-reads", () => sb.from("announcement_reads").select("announcement_id").eq("staff_id", staffId)),
  listSent: () => sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(30),
  allReads: () => sb.from("announcement_reads").select("announcement_id,staff_id"),
  send: row => sb.from("announcements").insert(row).select("id").maybeSingle(),
  archive: id => sb.from("announcements").update({ archived_at: new Date().toISOString() }).eq("id", id),
  markRead: (ids, staffId) => sb.from("announcement_reads").upsert(ids.map(id => ({ announcement_id: id, staff_id: staffId })), { onConflict: "announcement_id,staff_id", ignoreDuplicates: true }),
  pushKey: () => sb.functions.invoke("push", { body: { action: "key" } }),
  pushSend: id => sb.functions.invoke("push", { body: { action: "send", announcement_id: id } }),
  saveSubscription: (endpoint, p256dh, auth, userAgent) => sb.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: userAgent }),
  removeSubscription: endpoint => sb.rpc("remove_push_subscription", { p_endpoint: endpoint })
};
