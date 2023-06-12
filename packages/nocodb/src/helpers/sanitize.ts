export function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v?.replace(/([^\\]|^)(\?+)/g, (_, m1, m2) => {
    return `${m1}${m2.split('?').join('\\?')}`;
  });
}

export function unsanitize(v) {
  if (typeof v !== 'string') return v;
  return v?.replace(/\\[?]/g, '?');
}
