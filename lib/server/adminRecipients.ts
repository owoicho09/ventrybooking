/**
 * Who receives admin emails.
 *
 *   ADMIN_NOTIFY_EMAILS  comma-separated list (e.g. "admin@ventrybooking.com, owner@gmail.com").
 *   ADMIN_EMAIL          fallback when the list isn't set; also the admin login.
 *
 * Every admin email goes to each address separately, so one suppressed or
 * bouncing inbox can never stop the others getting it.
 */
export function adminRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAIL || '';
  const list = raw.split(',').map(s => s.trim().toLowerCase()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  return Array.from(new Set(list));
}

export function isAdminRecipient(email: string | null | undefined): boolean {
  return !!email && adminRecipients().includes(email.trim().toLowerCase());
}
