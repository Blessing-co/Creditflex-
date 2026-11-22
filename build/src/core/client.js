/* The one Supabase client the whole app shares. */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: "implicit" }, global: { fetch: cfFetch } });

const $app = document.getElementById("app");
