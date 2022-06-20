export function sanitize(v) {
  return v?.replaceAll('?', '\\\\?');
}

export function unsanitize(v) {
  return v?.replaceAll('\\?', '?');
}
