import axios from 'axios'
import type { AxiosAdapter, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { HttpClient } from 'nocodb-sdk'
import { CELLS_BASE_ID, CELLS_TABLE_ID, COMPANY_TABLE_ID, cellsTableMeta } from './fixtures'

type MergeParams = (this: HttpClient, params1: AxiosRequestConfig, params2?: AxiosRequestConfig) => AxiosRequestConfig

interface Company {
  Id: number
  Name: string
  Employees: number
}

/** related records the link cells list, pick from and expand */
const initialCompanies = (): Company[] => [
  { Id: 1, Name: 'Acme', Employees: 120 },
  { Id: 2, Name: 'Globex', Employees: 340 },
  { Id: 3, Name: 'Initech', Employees: 85 },
  { Id: 4, Name: 'Umbrella', Employees: 910 },
  { Id: 5, Name: 'Hooli', Employees: 2300 },
  { Id: 6, Name: 'Stark Industries', Employees: 5100 },
]

/** ids each link column starts with, matching the fixture values */
const initialLinked = (): Record<string, number[]> => ({
  c_links_hm: [1, 2, 3],
  c_ltar_mm: [1, 2],
  c_ltar_bt: [3],
})

let COMPANIES = initialCompanies()

let LINKED = initialLinked()

/** link column whose picker was used last; "New record" there links the record it creates */
let pickerColId: string | undefined

const OWN_IDS = [CELLS_BASE_ID, CELLS_TABLE_ID, COMPANY_TABLE_ID]

const page = (list: unknown[]) => ({
  list,
  pageInfo: { totalRows: list.length, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true },
})

function respond(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? 'get').toLowerCase()
  const path = (config.url ?? '').split('?')[0] ?? ''
  const colId = Object.keys(LINKED).find((id) => path.includes(`/${id}`))
  const operation = (config.params as { operation?: string } | undefined)?.operation
  let data: unknown = {}

  if (method === 'post' && operation === 'columnUpdate') {
    // select editors adding an option read the saved column back from the table meta
    const column = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    data = { columns: [column] }
  } else if (colId) {
    const linked = LINKED[colId]!
    // link / unlink: `…/{type}/{colId}/{childId}` or a v2/v3 links body
    if (method !== 'get') {
      const childId = Number(path.split('/').pop())
      if (!Number.isNaN(childId)) {
        if (method === 'delete') LINKED[colId] = linked.filter((id) => id !== childId)
        else if (!linked.includes(childId)) LINKED[colId] = colId === 'c_ltar_bt' ? [childId] : [...linked, childId]
      }
      data = { msg: 'ok' }
    } else if (path.endsWith('/exclude')) {
      pickerColId = colId
      data = page(COMPANIES.filter((c) => !linked.includes(c.Id)))
    } else {
      pickerColId = colId
      data = page(COMPANIES.filter((c) => linked.includes(c.Id)))
    }
  } else if (method === 'post' && path.endsWith(`/${COMPANY_TABLE_ID}`)) {
    // the link picker's "New record": the backend links it through the inverse field, so link it here
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const record: Company = { Name: '', Employees: 0, ...body, Id: Math.max(...COMPANIES.map((c) => c.Id)) + 1 }
    COMPANIES.push(record)
    if (pickerColId) LINKED[pickerColId] = pickerColId === 'c_ltar_bt' ? [record.Id] : [...LINKED[pickerColId]!, record.Id]
    data = record
  } else if (method === 'get') {
    data = page([])
  }

  return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} }
}

/** back to the fixture links, for Reset values */
export function resetCellsMocks() {
  COMPANIES = initialCompanies()
  LINKED = initialLinked()
}

/** what a row reload reads back for the link fields (the grid refetches the row after a picker creates a record) */
export function syncLinkedValues(row: Record<string, unknown>) {
  for (const column of cellsTableMeta().columns ?? []) {
    const ids = column.id ? LINKED[column.id] : undefined
    if (!ids || !column.title) continue
    const records = COMPANIES.filter((c) => ids.includes(c.Id)).map(({ Id, Name }) => ({ Id, Name }))
    if (column.id === 'c_links_hm') row[column.title] = records.length
    else if (column.id === 'c_ltar_bt') row[column.title] = records[0] ?? null
    else row[column.title] = records
  }
}

let saved: { merge: MergeParams; interceptorId: number } | null = null

/** Answers requests for the cells fixture base locally; everything else reaches the backend. */
export function installCellsMocks(instance: ReturnType<typeof useNuxtApp>['$api']['instance']) {
  if (saved) return
  const real = axios.getAdapter(axios.defaults.adapter)
  const adapter: AxiosAdapter = (config) =>
    OWN_IDS.some((id) => (config.url ?? '').includes(id)) ? Promise.resolve(respond(config)) : real(config)

  const merge = HttpClient.prototype.mergeRequestParams
  HttpClient.prototype.mergeRequestParams = function (params1, params2) {
    return { ...merge.call(this, params1, params2), adapter }
  } satisfies MergeParams
  const interceptorId = instance.interceptors.request.use((config) => {
    config.adapter = adapter
    return config
  })
  saved = { merge, interceptorId }
}

export function uninstallCellsMocks(instance: ReturnType<typeof useNuxtApp>['$api']['instance']) {
  if (!saved) return
  HttpClient.prototype.mergeRequestParams = saved.merge
  instance.interceptors.request.eject(saved.interceptorId)
  saved = null
}
