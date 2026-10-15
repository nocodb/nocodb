import type DOMPurifyType from 'isomorphic-dompurify';

let instance: typeof DOMPurifyType | undefined;

// isomorphic-dompurify loads jsdom (~13 MB heap), so defer it to the first sanitize.
// Inline require is deliberate: callers are sync, so `await import()` is not an option.
export function getDOMPurify(): typeof DOMPurifyType {
  instance ??= require('isomorphic-dompurify');
  return instance;
}
