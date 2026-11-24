/**
 * A record's display value as notification text. The bell has no table meta,
 * so PlainCell renders these blank; the backend already flattens the value.
 */
export function notificationRowLabel(value: unknown, fallback = 'a record'): string {
  if (ncIsString(value) || ncIsNumber(value)) return String(value)
  // A User or CreatedBy display field arrives as a user object.
  if (ncIsObject(value)) {
    const user = value as { display_name?: string; email?: string }
    if (user.display_name || user.email) return (user.display_name || user.email) as string
  }
  return fallback
}
