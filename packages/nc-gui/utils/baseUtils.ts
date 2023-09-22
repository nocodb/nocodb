import type { BaseType } from 'nocodb-sdk'

const isDefaultBase = (base: BaseType) => base.is_meta

export { isDefaultBase }
