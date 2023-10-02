export enum NcProjectType {
  DB = 'database',
  DOCS = 'documentation',
  AUTOMATION = 'automation',
  DASHBOARD = 'dashboard',
  COWRITER = 'cowriter',
}

export const clientTypes = [
  {
    text: 'MySql',
    value: ClientType.MYSQL,
  },
  {
    text: 'PostgreSQL',
    value: ClientType.PG,
  },
]
