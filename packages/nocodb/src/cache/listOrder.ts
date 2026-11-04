/**
 * Comparator for cached lists. Null/undefined sort last in either direction,
 * and two nulls compare equal so the order stays antisymmetric.
 */
export function compareByKey<T extends Record<string, any>>(
  key: string,
  { dir, isString }: { dir?: 'asc' | 'desc'; isString?: boolean } = {},
): (a: T, b: T) => number {
  const orderMultiplier = dir === 'desc' ? -1 : 1;

  return (a, b) => {
    const aValue = a?.[key];
    const bValue = b?.[key];
    const aNull = aValue === null || aValue === undefined;
    const bNull = bValue === null || bValue === undefined;

    if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;

    if (isString) {
      return orderMultiplier * String(aValue).localeCompare(String(bValue));
    }
    return orderMultiplier * (aValue - bValue);
  };
}
