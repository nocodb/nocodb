import DOMPurify from 'isomorphic-dompurify';

export function extractProps<T extends Record<string, any>>(
  body: T,
  props: string[],
): Partial<T> {
  // todo: throw error if no props found
  return props.reduce((o, key) => {
    if (key in body) o[key] = body[key];
    return o;
  }, {});
}

export function extractPropsAndSanitize<T extends Record<string, any>>(
  body: T,
  props: string[],
): Partial<T> {
  // todo: throw error if no props found
  return props.reduce((o, key) => {
    if (key in body)
      o[key] = body[key] === '' ? null : DOMPurify.sanitize(body[key]);
    return o;
  }, {});
}
