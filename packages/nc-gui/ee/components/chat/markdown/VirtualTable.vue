<script setup lang="ts">
const props = withDefaults(defineProps<Props>(), {
  content: undefined,
  schema: undefined,
})

const { $e } = useNuxtApp()

interface ArtifactColumn {
  title: string
  type: string
  options?: Record<string, any>
}

interface ArtifactSchema {
  title?: string
  description?: string
  columns: ArtifactColumn[]
}

interface ResolvedColumn {
  key: string
  title: string
  type: string
  options?: Record<string, any>
}

interface Props {
  data: any[] | string
  content?: string
  schema?: ArtifactSchema
}

const { $api } = useNuxtApp()

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const isSaving = ref(false)

const savedTableId = ref<string | null>(null)

const parsedData = computed(() => {
  if (Array.isArray(props.data)) return props.data
  try {
    return JSON.parse(props.data as string) as any[]
  } catch {
    return []
  }
})

const columns = computed<ResolvedColumn[]>(() => {
  if (props.schema?.columns?.length) {
    return props.schema.columns.map((col) => ({
      key: col.title,
      title: col.title,
      type: col.type || 'SingleLineText',
      options: col.options,
    }))
  }

  if (!parsedData.value.length) return []
  return Object.keys(parsedData.value[0]).map((key) => ({
    key,
    title: key,
    type: 'SingleLineText',
    options: undefined,
  }))
})

function getChoiceColor(value: string, options?: Record<string, any>): string | undefined {
  if (!options?.choices || !Array.isArray(options.choices)) return undefined
  const choice = options.choices.find((c: { title: string; color?: string }) => c.title === value)
  return choice?.color
}

const DEFAULT_CHIP_COLORS = ['#36BFFF', '#FC3AC6', '#7D26CD', '#FA8231', '#27D665', '#FCBE3A', '#FF4A3F', '#6A7184']

function chipColor(value: string, options?: Record<string, any>): string {
  const explicit = getChoiceColor(value, options)
  if (explicit) return explicit

  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash << 5) - hash + value.charCodeAt(i)
  return DEFAULT_CHIP_COLORS[Math.abs(hash) % DEFAULT_CHIP_COLORS.length]
}

function chipBg(color: string): string {
  return `${color}1A` // 10% opacity hex suffix
}

function formatCurrency(val: any, options?: Record<string, any>): string {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (isNaN(num)) return String(val)
  try {
    return new Intl.NumberFormat(options?.locale || 'en-US', {
      style: 'currency',
      currency: options?.code || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return String(val)
  }
}

function formatNumber(val: any, options?: Record<string, any>): string {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (isNaN(num)) return String(val)
  if (options?.locale_string) {
    return num.toLocaleString()
  }
  return String(num)
}

function formatPercent(val: any): string {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (isNaN(num)) return String(val)
  return `${num}%`
}

function formatDate(val: any, options?: Record<string, any>): string {
  if (!val) return ''
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    const fmt = options?.date_format || 'YYYY-MM-DD'
    // Simple format — cover common patterns
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (fmt === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`
    if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`
    if (fmt === 'DD-MM-YYYY') return `${dd}-${mm}-${yyyy}`
    if (fmt.includes('MMM')) return `${monthNames[d.getMonth()]} ${dd}, ${yyyy}`
    return `${yyyy}-${mm}-${dd}`
  } catch {
    return String(val)
  }
}

function formatDefault(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function saveToBase() {
  if (!props.schema || isSaving.value || savedTableId.value) return
  $e('a:chat:data:save-to-base')

  const baseId = activeProjectId.value
  if (!baseId) return

  const base = basesStore.bases.get(baseId)
  const sourceId = base?.sources?.[0]?.id
  if (!sourceId) return

  isSaving.value = true

  try {
    const v2Columns = props.schema.columns.map((col) => {
      const v2: Record<string, any> = {
        title: col.title,
        uidt: col.type as any,
      }

      if (col.options) {
        const meta: Record<string, any> = {}
        const opts = col.options

        // Currency
        if (col.type === 'Currency') {
          meta.currency_locale = opts.locale || 'en-US'
          meta.currency_code = opts.code || 'USD'
        }

        // Number / Decimal
        if ((col.type === 'Number' || col.type === 'Decimal') && opts.locale_string) {
          meta.isLocaleString = true
        }

        // Date / DateTime
        if (col.type === 'Date' || col.type === 'DateTime') {
          if (opts.date_format) meta.date_format = opts.date_format
          if (opts.time_format) meta.time_format = opts.time_format
          if (opts['12hr_format']) meta.is12hrFormat = true
        }

        // Percent
        if (col.type === 'Percent' && opts.show_as_progress) {
          meta.show_as_progress = true
        }

        if (Object.keys(meta).length) {
          v2.meta = meta
        }

        // Select choices
        if ((col.type === 'SingleSelect' || col.type === 'MultiSelect') && opts.choices) {
          v2.colOptions = {
            options: opts.choices.map((c: { title: string; color?: string }) => ({
              title: c.title,
              color: c.color || undefined,
            })),
          }
        }

        // Rating
        if (col.type === 'Rating') {
          if (opts.max_value) meta.max = opts.max_value
          if (opts.icon) meta.iconIdx = opts.icon
          if (opts.color) meta.color = opts.color
        }
      }

      return v2
    })

    const tableMeta = await $api.source.tableCreate(baseId, sourceId, {
      title: props.schema.title || 'Untitled Table',
      columns: v2Columns,
    })

    if (tableMeta?.id && parsedData.value.length) {
      await $api.dbTableRow.bulkCreate('noco', baseId, tableMeta.id, parsedData.value, { typecast: 'true' } as any)
    }

    savedTableId.value = tableMeta?.id || null

    // Refresh tables in sidebar
    const tablesStore = useTablesStore()
    await tablesStore.loadProjectTables(baseId, true)

    message.success('Table saved to base')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div
    v-if="parsedData.length && columns.length"
    class="nc-chat-virtual-table rounded-lg border-1 border-nc-border-gray-medium overflow-hidden my-2"
  >
    <div
      v-if="schema?.title"
      class="px-3 py-1.5 bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-light flex items-center gap-2"
    >
      <span class="text-bodyDefaultSm font-semibold text-nc-content-gray truncate">{{ schema.title }}</span>
    </div>
    <div class="overflow-x-auto nc-scrollbar-thin">
      <table class="w-full text-captionSm">
        <thead>
          <tr class="bg-nc-bg-gray-extralight">
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-2.5 py-1.5 text-left font-medium text-nc-content-gray-subtle border-b-1 border-nc-border-gray-light"
            >
              <div class="flex items-center gap-1.5">
                <component :is="getUIDTIcon(col.type)" class="w-3.5 h-3.5 text-nc-content-gray-muted flex-none" />
                <NcTooltip show-on-truncate-only class="truncate max-w-[160px]">
                  <template #title>{{ col.title }}</template>
                  {{ col.title }}
                </NcTooltip>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in parsedData" :key="ri" class="hover:bg-nc-bg-gray-extralight transition-colors">
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-2.5 py-1.5 text-nc-content-gray border-b-1 border-nc-border-gray-light max-w-[200px]"
            >
              <template v-if="col.type === 'Currency'">
                <span class="tabular-nums">{{ formatCurrency(row[col.key], col.options) }}</span>
              </template>
              <template v-else-if="col.type === 'Number' || col.type === 'Decimal'">
                <span class="tabular-nums">{{ formatNumber(row[col.key], col.options) }}</span>
              </template>
              <template v-else-if="col.type === 'Percent'">
                <span class="tabular-nums">{{ formatPercent(row[col.key]) }}</span>
              </template>
              <template v-else-if="col.type === 'Date' || col.type === 'DateTime'">
                {{ formatDate(row[col.key], col.options) }}
              </template>
              <template v-else-if="col.type === 'Year'">
                {{ row[col.key] ?? '' }}
              </template>
              <template v-else-if="col.type === 'SingleSelect'">
                <span
                  v-if="row[col.key]"
                  class="nc-virtual-chip"
                  :style="{
                    color: chipColor(String(row[col.key]), col.options),
                    backgroundColor: chipBg(chipColor(String(row[col.key]), col.options)),
                  }"
                >
                  {{ row[col.key] }}
                </span>
              </template>
              <template v-else-if="col.type === 'MultiSelect'">
                <div v-if="row[col.key]" class="flex flex-wrap gap-1">
                  <span
                    v-for="(item, idx) in Array.isArray(row[col.key]) ? row[col.key] : String(row[col.key]).split(',')"
                    :key="idx"
                    class="nc-virtual-chip"
                    :style="{
                      color: chipColor(String(item).trim(), col.options),
                      backgroundColor: chipBg(chipColor(String(item).trim(), col.options)),
                    }"
                  >
                    {{ String(item).trim() }}
                  </span>
                </div>
              </template>
              <template v-else-if="col.type === 'Checkbox'">
                <GeneralIcon v-if="row[col.key]" icon="ncCheck" class="w-4 h-4 text-nc-content-brand" />
              </template>
              <template v-else-if="col.type === 'URL'">
                <a
                  v-if="row[col.key]"
                  :href="row[col.key]"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-nc-content-brand underline truncate block"
                >
                  {{ row[col.key] }}
                </a>
              </template>
              <template v-else-if="col.type === 'Email'">
                <a v-if="row[col.key]" :href="`mailto:${row[col.key]}`" class="text-nc-content-brand underline truncate block">
                  {{ row[col.key] }}
                </a>
              </template>
              <template v-else-if="col.type === 'Rating'">
                <div class="flex items-center gap-0.5">
                  <GeneralIcon
                    v-for="star in col.options?.max_value || 5"
                    :key="star"
                    icon="ncStar"
                    class="w-3.5 h-3.5"
                    :class="star <= Number(row[col.key] || 0) ? 'text-nc-content-orange' : 'text-nc-content-gray-light'"
                  />
                </div>
              </template>
              <template v-else>
                <span class="truncate block">{{ formatDefault(row[col.key]) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="px-3 py-1.5 border-t-1 border-nc-border-gray-light bg-nc-bg-gray-extralight flex items-center justify-between">
      <span class="text-captionXs text-nc-content-gray-muted">
        {{ parsedData.length }} {{ parsedData.length === 1 ? 'record' : 'records' }}
      </span>

      <NcButton
        v-if="schema && !savedTableId"
        size="xxsmall"
        type="text"
        :loading="isSaving"
        class="!text-nc-content-gray-subtle !h-5.5"
        @click="saveToBase"
      >
        <template #icon>
          <GeneralIcon icon="ncPlus" class="w-3.5 h-3.5" />
        </template>
        Save to base
      </NcButton>

      <span v-else-if="savedTableId" class="text-captionXs text-nc-content-green flex items-center gap-1">
        <GeneralIcon icon="ncCheck" class="w-3 h-3" />
        Saved
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-virtual-table {
  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  tr:last-child td {
    @apply border-b-0;
  }

  th:not(:first-child),
  td:not(:first-child) {
    @apply border-l-1 border-nc-border-gray-light;
  }
}

.nc-virtual-chip {
  @apply inline-flex items-center
    px-2 py-0.25
    rounded-full
    text-[11px] leading-4 font-medium
    whitespace-nowrap;
}
</style>
