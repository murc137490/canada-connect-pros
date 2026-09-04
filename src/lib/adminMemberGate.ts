/** Session gate: platform admins must enter their 6-digit Member ID after login. */

const KEY = "premiere_admin_member_verified";

export function clearAdminMemberVerification(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function setAdminMemberVerified(userId: string, memberId: string): void {
  try {
    sessionStorage.setItem(KEY, `${userId}:${memberId}`);
  } catch {
    /* ignore */
  }
}

export function isAdminMemberVerified(userId: string, memberId: string): boolean {
  try {
    return sessionStorage.getItem(KEY) === `${userId}:${memberId}`;
  } catch {
    return false;
  }
}

export function normalizeMemberIdInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}
