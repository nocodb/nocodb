/* eslint-disable @typescript-eslint/ban-types */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * `Omit` over a union keeps only the keys every member shares, which silently
 * erases a discriminated union down to its common base. This applies the omit
 * to each member instead, so `AgentEventPayload`-style unions survive it.
 */
export type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never;
