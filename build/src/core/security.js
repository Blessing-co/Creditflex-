/* Password rules. */
const CF_WEAK = ["password","12345678","123456789","1234567890","qwertyui","qwerty123","iloveyou","creditflex","password1","11111111","00000000","abcd1234","admin123"];
function cfPwIssue(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain both letters and numbers.";
  if (CF_WEAK.includes(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return "That password is too easy to guess. Choose a different one.";
  return null;
}
/* ---------- csv helper ---------- */
