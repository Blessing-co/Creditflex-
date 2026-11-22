/* Settings that never change while the app runs. */
const APP_BUILD = "__BUILD__";   // filled in by build.js
const SUPABASE_URL = "https://dsjuwmtojudcaulfqmyp.supabase.co";
const SUPABASE_KEY = "sb_publishable_pSzeeh2eHthcVfL7ZQzZug_xmdN9t2a";
const RECOVERY = /type=recovery/.test(location.hash);
const HASHERR = ((location.hash.match(/error_description=([^&]+)/) || [])[1] || "").replace(/\+/g, " ");
/* Network layer: every request gets a time limit; reads are retried a couple of times.
   Writes are never retried here (a payment that timed out is queued and re-sent safely
   with its offline_submission_id by the offline queue). */
