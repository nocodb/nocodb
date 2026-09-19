/**
 * `Omit` over a union collapses it into one object with the shared keys, losing
 * the discriminant. This distributes, so `action` still narrows afterwards.
 */
export type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never;
