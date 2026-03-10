<script setup lang="ts">
interface Props {
  output: any
  tableName?: string
}

const props = withDefaults(defineProps<Props>(), {
  tableName: undefined,
})

const { output, tableName } = toRefs(props)

const parsed = computed(() => {
  let data = output.value
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }
  if (!data?.records || !Array.isArray(data.records) || data.records.length === 0) return null

  const records: Record<string, any>[] = data.records
  // V3 format: { id, fields: {...} } — flatten to { id, ...fields }
  const rows = records.map((r) => {
    if (r.fields && typeof r.fields === 'object') {
      return { Id: r.id, ...r.fields }
    }
    return r
  })

  // Extract column names from first row, limit to 6 columns
  const allColumns = Object.keys(rows[0] || {}).filter((k) => k !== 'Id')
  const columns = allColumns.slice(0, 6)

  const totalRecords = data.pageInfo?.totalRows ?? data.totalRows ?? rows.length

  return { rows, columns, totalRecords, hasMore: allColumns.length > columns.length }
})

const formatCell = (value: any): string => {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value))
    return value.map((v) => (typeof v === 'object' ? v.title || v.value || JSON.stringify(v) : v)).join(', ')
  if (typeof value === 'object') return value.title || value.value || JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <div v-if="parsed" class="nc-chat-record-table">
    <!-- Header -->
    <div class="flex items-center justify-between px-2.5 py-1.5">
      <div class="flex items-center gap-1.5">
        <GeneralIcon icon="ncGrid" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
        <span v-if="tableName" class="text-[11px] font-medium text-nc-content-gray-subtle">{{ tableName }}</span>
      </div>
      <span class="text-[11px] text-nc-content-gray-muted">
        {{ parsed.totalRecords }} {{ parsed.totalRecords === 1 ? 'record' : 'records' }}
      </span>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto nc-scrollbar-thin">
      <table class="w-full">
        <thead>
          <tr>
            <th class="nc-rt-th">#</th>
            <th v-for="col in parsed.columns" :key="col" class="nc-rt-th">
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in parsed.rows" :key="ri" class="nc-rt-row">
            <td class="nc-rt-td nc-rt-row-num">{{ ri + 1 }}</td>
            <td v-for="col in parsed.columns" :key="col" class="nc-rt-td">
              <span class="truncate block max-w-[180px]" :title="formatCell(row[col])">
                {{ formatCell(row[col]) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer hint -->
    <div v-if="parsed.hasMore" class="px-2.5 py-1 text-[10px] text-nc-content-gray-muted">+ more columns</div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-record-table {
  @apply rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-default overflow-hidden my-1;
}

.nc-rt-th {
  @apply text-left text-[11px] font-semibold text-nc-content-gray-subtle bg-nc-bg-gray-extralight px-2.5 py-1.5 border-b-1 border-nc-border-gray-light whitespace-nowrap;
}

.nc-rt-td {
  @apply text-[12px] text-nc-content-gray px-2.5 py-1 border-b-1 border-nc-border-gray-light;
}

.nc-rt-row:last-child .nc-rt-td {
  @apply border-b-0;
}

.nc-rt-row-num {
  @apply text-nc-content-gray-muted w-8 text-center;
}

.nc-rt-row:hover .nc-rt-td {
  @apply bg-nc-bg-gray-extralight;
}
</style>
