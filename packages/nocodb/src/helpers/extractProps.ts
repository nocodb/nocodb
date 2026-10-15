import { getDOMPurify } from '~/helpers/domPurify';

export { extractProps } from 'nocodb-sdk';

export function extractPropsAndSanitize<T extends Record<string, any>>(
  body: T,
  props: string[],
): Partial<T> {
  // todo: throw error if no props found
  return props.reduce((o, key) => {
    if (key in body)
      o[key] = body[key] === '' ? null : getDOMPurify().sanitize(body[key]);
    return o;
  }, {});
}
