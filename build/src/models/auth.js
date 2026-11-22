/* MODEL: sign-in, sessions and passwords (Supabase Auth). */
const Auth = {
  getSession: () => sb.auth.getSession(),
  getUser: () => sb.auth.getUser(),
  signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
  signUp: (email, password, fullName, phone) => sb.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } }),
  signOut: () => sb.auth.signOut(),
  sendResetLink: (email, redirectTo) => sb.auth.resetPasswordForEmail(email, { redirectTo }),
  setPassword: password => sb.auth.updateUser({ password }),
  onChange: fn => sb.auth.onAuthStateChange(fn)
};
