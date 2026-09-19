/**
 * Consumer mailbox providers. An address at one of these says nothing about who
 * the person works with, so a link restricted to it would be no restriction at
 * all -- every Gmail account on earth would match.
 *
 * Deliberately a short list of the providers people actually sign up with, not
 * an exhaustive registry: a miss only means we offer a weaker default, which
 * the creator can tighten in the same dialog.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'zoho.com',
  'mail.com',
  'mail.ru',
  'yandex.com',
  'yandex.ru',
  'qq.com',
  '163.com',
  '126.com',
  'naver.com',
  'hey.com',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
  'hushmail.com',
  'inbox.com',
  'rediffmail.com',
])

export function emailDomain(email?: string | null): string | null {
  const at = (email || '').lastIndexOf('@')
  if (at === -1) return null

  const domain = email!
    .slice(at + 1)
    .trim()
    .toLowerCase()

  return domain || null
}

export function isPersonalEmailDomain(domain?: string | null): boolean {
  return !!domain && PERSONAL_EMAIL_DOMAINS.has(domain)
}

/**
 * The domain a new invite link should be restricted to, or `null` to leave it
 * open. Work addresses give a sensible default; consumer ones do not.
 */
export function inviteLinkDefaultDomain(email?: string | null): string | null {
  const domain = emailDomain(email)

  return isPersonalEmailDomain(domain) ? null : domain
}

/**
 * Same rule as the server's `normaliseDomain`, so the edit screen can refuse a
 * bad domain at the field instead of waiting for a 400 to come back as a toast.
 * Accepts a leading `@`, surrounding space and any casing.
 */
export function isValidEmailDomain(domain?: string | null): boolean {
  const trimmed = (domain || '').trim().toLowerCase().replace(/^@/, '')

  return trimmed.length > 0 && trimmed.length <= 255 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)
}
