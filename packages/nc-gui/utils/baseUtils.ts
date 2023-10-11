import type { SourceType } from 'nocodb-sdk'

const isDefaultBase = (source: SourceType) => source.is_meta

export { isDefaultBase }
