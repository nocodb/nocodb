export function isTokenExpired(
  expires: string | number | Date | null | undefined,
): boolean {
  if (expires == null) return true;
  const date = new Date(expires);
  if (Number.isNaN(date.getTime())) return true;
  return date < new Date();
}
