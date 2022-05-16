export default function extractProps<T>(body: T, props: string[]): Partial<T> {
  // todo: throw error if no props found
  return props.reduce((o, key) => {
    if (key in body) o[key] = body[key];
    return o;
  }, {});
}
