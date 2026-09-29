/**
 * Light client-side email checks — a soft typo guard and a hard disposable
 * block. Runs before /api/auth/signup so the round-trip and the mail we'd
 * send are saved when the address is obviously wrong or single-use.
 *
 * These lists are intentionally small and curated (no npm dependency, no
 * churn) — they'd rather miss an exotic disposable than false-positive a
 * real Indian domain. The typo suggester compares against the top mail
 * providers only; anything else is left alone. Both checks are advisory —
 * the caller decides what to do with the result.
 */

/** Handful of the highest-volume disposable domains we see in the wild.
 *  Blocked outright. Extend the list rather than fingerprinting patterns —
 *  a curated deny-list is easier to audit than a heuristic. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.io",
  "mintemail.com",
  "getnada.com",
  "maildrop.cc",
  "fakeinbox.com",
  "dispostable.com",
  "mailnesia.com",
  "emailondeck.com",
  "spam4.me",
  "spamgourmet.com",
  "mytemp.email",
  "moakt.com",
  "byom.de",
  "linshiyou.com",
])

/** Top providers we run the typo suggester against. Anything not close to
 *  one of these is passed through. */
const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.co.in",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "rediffmail.com",
  "aol.com",
]

/** Standard Damerau–Levenshtein (single-char edit distance with adjacent
 *  swaps counted as one edit). Distance ≤ 2 catches the common typos —
 *  gmial, gmai, gmali, hotnail — without matching to another real domain. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (Math.abs(al - bl) > 2) return 99
  const prev: number[] = Array(bl + 1)
  const cur: number[] = Array(bl + 1)
  const prev2: number[] = Array(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    cur[0] = i
    for (let j = 1; j <= bl; j++) {
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      const ins = cur[j - 1] + 1
      const del = prev[j] + 1
      cur[j] = Math.min(sub, ins, del)
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1)
      }
    }
    for (let j = 0; j <= bl; j++) {
      prev2[j] = prev[j]
      prev[j] = cur[j]
    }
  }
  return prev[bl]
}

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at <= 0 || at === email.length - 1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

/** True when the domain is on our disposable-mail deny-list. */
export function isDisposableEmail(email: string): boolean {
  const d = domainOf(email)
  return !!d && DISPOSABLE_DOMAINS.has(d)
}

/** Nearest common-provider match if the user's domain is one small typo
 *  away — returns the whole corrected email so the caller can offer
 *  "Did you mean priya@gmail.com?". Null when nothing is close, or when
 *  the domain already IS a known provider. */
export function suggestEmailFix(email: string): string | null {
  const d = domainOf(email)
  if (!d) return null
  if (COMMON_DOMAINS.includes(d)) return null
  let best: { domain: string; dist: number } | null = null
  for (const cand of COMMON_DOMAINS) {
    const dist = editDistance(d, cand)
    if (dist <= 2 && (!best || dist < best.dist)) best = { domain: cand, dist }
  }
  if (!best) return null
  return email.slice(0, email.lastIndexOf("@") + 1) + best.domain
}
