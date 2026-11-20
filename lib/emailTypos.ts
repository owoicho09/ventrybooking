// Catches the common mistyped email domains ("gmial.com", "yahoo.con") at
// checkout so the buyer can fix them before the ticket goes to a dead inbox.
// Advisory only: a suggestion is shown, never forced.

const POPULAR = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'live.com', 'ymail.com', 'aol.com', 'yahoo.co.uk', 'hotmail.co.uk',
  'protonmail.com', 'msn.com',
];

// Real domains that sit one or two letters away from a popular one.
const LEGIT = new Set([
  ...POPULAR, 'mail.com', 'gmx.com', 'me.com', 'mac.com', 'proton.me',
  'live.co.uk', 'outlook.co.uk', 'email.com', 'yahoo.fr', 'hotmail.fr',
]);

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      // Swapped neighbours ("gmial") count as one slip, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

/** The corrected full address when the domain looks like a typo, else null. */
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain || LEGIT.has(domain)) return null;

  let best: string | null = null;
  let bestDist = Infinity;
  for (const p of POPULAR) {
    const d = distance(domain, p);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  // Two slips is the ceiling; short domains get one so "me.co" isn't rewritten.
  const limit = domain.length <= 6 ? 1 : 2;
  return best && bestDist > 0 && bestDist <= limit ? `${local}@${best}` : null;
}
