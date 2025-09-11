export const willRunOnSet = (set: number) => {
  const argv = process.argv;
  return (
    argv.some((arg) => arg === `--test-set-${set}`) ||
    !argv.some((arg) => arg.startsWith(`--test-set`))
  );
};

export function runOnSet(set: number, target: () => void | any) {
  return function (...args: any[]) {
    if (willRunOnSet(set)) {
      return target.apply(this, args);
    }
    return;
  };
}
