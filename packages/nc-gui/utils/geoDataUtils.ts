export type GeoDataValidationError = 'format' | 'latitude' | 'longitude'

export type GeoDataParseResult =
  | { value: string; lat: number; lng: number; error?: undefined }
  | { value?: undefined; lat?: undefined; lng?: undefined; error: GeoDataValidationError }

const NUMERIC_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)$/

// Up to 10 decimals, trailing zeros dropped
const formatGeoNumber = (n: number) => {
  const str = n.toFixed(10).replace(/\.?0+$/, '')
  return str === '-0' ? '0' : str
}

/** Splits a stored GeoData value on `;` or `,`, trimming each part. */
export const splitGeoDataValue = (raw?: string | null): string[] => {
  if (!raw || typeof raw !== 'string') return []
  return raw.split(/[;,]/).map((part) => part.trim())
}

export const isValidGeoLatitude = (raw?: string | null) => {
  const part = `${raw ?? ''}`.trim()
  if (!NUMERIC_RE.test(part)) return false
  const lat = Number(part)
  return lat >= -90 && lat <= 90
}

export const isValidGeoLongitude = (raw?: string | null) => {
  const part = `${raw ?? ''}`.trim()
  if (!NUMERIC_RE.test(part)) return false
  const lng = Number(part)
  return lng >= -180 && lng <= 180
}

/** Normalises `lat,lon` / spaced input to `lat;lon`; never clamps an out-of-range value. */
export const parseGeoDataValue = (raw?: string | null): GeoDataParseResult => {
  const parts = splitGeoDataValue(raw)
  if (parts.length !== 2 || parts.some((part) => !NUMERIC_RE.test(part))) return { error: 'format' }

  const [latStr, lngStr] = parts as [string, string]
  if (!isValidGeoLatitude(latStr)) return { error: 'latitude' }
  if (!isValidGeoLongitude(lngStr)) return { error: 'longitude' }

  const lat = Number(latStr)
  const lng = Number(lngStr)
  return { value: `${formatGeoNumber(lat)};${formatGeoNumber(lng)}`, lat, lng }
}
