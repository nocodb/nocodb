type NonUndefined<T> = T extends undefined ? never : T
type NonNull<T> = T extends null ? never : T
type NonNullableObject<T> = {
  [K in keyof T]: NonUndefined<NonNull<T[K]>>
}

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export const stripUndefinedOrNull = <T>(obj: T): Prettify<NonNullableObject<T>> => {
  const strip = (input: unknown): unknown => {
    return Array.isArray(input)
      ? input.map(strip)
      : input !== null && typeof input === 'object'
      ? Object.entries(input)
          .filter(([, value]) => value !== undefined && value !== null)
          .reduce((acc, [key, value]) => {
            acc[key as keyof typeof acc] = strip(value)
            return acc
          }, {} as Record<string, unknown>)
      : input
  }

  return strip(obj) as Prettify<NonNullableObject<T>>
}
