export interface IdAndTitle {
  id: string
  title: string
}
export interface TableWithProject {
  id: string
  title: string
  project: {
    id: string
    title: string
  }
}
