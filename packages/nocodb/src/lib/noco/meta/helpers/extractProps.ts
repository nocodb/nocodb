export default function extractProps<T>(body: T, props: string[]): Partial<T> {
  return props.reduce((o, key) => {
    if (key in body) o[key] = body[key];
    return o;
  }, {});
}
