import { ClientType } from '~/lib/enums'

export const clientTypes = [
  {
    text: 'MySql',
    value: ClientType.MYSQL,
  },
  {
    text: 'PostgreSQL',
    value: ClientType.PG,
  },
  {
    text: 'Snowflake',
    value: ClientType.SNOWFLAKE,
  },
  {
    text: 'Databricks',
    value: ClientType.DATABRICKS,
  },
]

export const clientTypesMap = clientTypes.reduce((acc, curr) => {
  acc[curr.value] = curr
  return acc
}, {} as Record<string, (typeof clientTypes)[0]>)
