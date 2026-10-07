<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const TIMEZONES: NcListItemType[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New York' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney', ncItemDisabled: true, ncItemTooltip: 'Not available on Free plan' },
]

const FIELDS: NcListItemType[] = [
  { value: 'title', label: 'Title', ncGroupHeaderLabel: 'Text' },
  { value: 'notes', label: 'Notes', ncGroupHeaderLabel: 'Text' },
  { value: 'budget', label: 'Budget', ncGroupHeaderLabel: 'Numbers' },
  { value: 'spend', label: 'Spend', ncGroupHeaderLabel: 'Numbers' },
  { value: 'launch', label: 'Launch date', ncGroupHeaderLabel: 'Dates' },
]

const WEBHOOKS = [
  { id: 'hk1', title: 'Notify Slack on new lead' },
  { id: 'hk2', title: 'Sync to HubSpot' },
  { id: 'hk3', title: 'Send invoice email' },
  { id: 'hk4', title: 'Archive closed deals' },
]

const MEMBERS = [
  { id: 1, name: 'Priya Raman', email: 'priya@acme.dev', role: 'Owner', lastActive: '2 min ago' },
  { id: 2, name: 'Lucas Meyer', email: 'lucas@acme.dev', role: 'Creator', lastActive: '1 hour ago' },
  { id: 3, name: 'Aiko Tanaka', email: 'aiko@acme.dev', role: 'Editor', lastActive: 'Yesterday' },
  { id: 4, name: 'Omar Haddad', email: 'omar@acme.dev', role: 'Commenter', lastActive: '3 days ago' },
  { id: 5, name: 'Sofia Rossi', email: 'sofia@acme.dev', role: 'Viewer', lastActive: 'Last week' },
]

const TABLE_COLUMNS: NcTableColumnProps[] = [
  { key: 'name', title: 'Member', minWidth: 220, dataIndex: 'name', showOrderBy: true },
  { key: 'role', title: 'Role', minWidth: 120, width: 140, dataIndex: 'role', showOrderBy: true },
  { key: 'lastActive', title: 'Last active', minWidth: 120, width: 160, dataIndex: 'lastActive' },
  { key: 'action', title: '', minWidth: 60, width: 60, justify: 'justify-end' },
]

const timezone = ref<RawValueType>('Asia/Kolkata')

const selectedFields = ref<MultiSelectRawValueType>(['title', 'budget'])

const selectedHook = ref<string>()

const orderBy = ref<Record<string, SordDirectionType>>({})

const isTableLoading = ref(false)

const sortedMembers = computed(() => {
  const [field, dir] = Object.entries(orderBy.value).find(([, d]) => d) ?? []
  if (!field || !dir) return MEMBERS
  return [...MEMBERS].sort((a, b) => {
    const cmp = String(a[field as keyof (typeof MEMBERS)[number]]).localeCompare(
      String(b[field as keyof (typeof MEMBERS)[number]]),
    )
    return dir === 'asc' ? cmp : -cmp
  })
})
</script>

<template>
  <PgSection id="lists" title="Lists & tables" source="NcList · NcListWithSearch · NcTable">
    <!-- auto-fill, not lg:grid-cols-3: the token editor narrows the page without changing the viewport.
         NcList / NcListWithSearch are w-64 by default, so each frame hugs its list like the dropdown it lives in -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      <PgDemo label="NcList" hint="single select, disabled item">
        <div class="w-fit max-w-full mx-auto rounded-lg border-1 border-nc-border-gray-medium">
          <NcList v-model:value="timezone" :open="true" :list="TIMEZONES" :close-on-select="false" variant="small" />
        </div>
      </PgDemo>

      <PgDemo label="NcList" hint="multi-select, grouped">
        <div class="w-fit max-w-full mx-auto rounded-lg border-1 border-nc-border-gray-medium">
          <NcList
            v-model:value="selectedFields"
            :open="true"
            :list="FIELDS"
            is-multi-select
            :close-on-select="false"
            variant="small"
          >
            <template #headerExtraRight>
              <NcBadge :border="false" color="brand" class="mr-2">{{ selectedFields.length }} fields</NcBadge>
            </template>
          </NcList>
        </div>
      </PgDemo>

      <PgDemo label="NcListWithSearch">
        <div class="w-fit max-w-full mx-auto rounded-lg border-1 border-nc-border-gray-medium">
          <NcListWithSearch
            :is-parent-open="true"
            search-input-placeholder="Search webhooks"
            :option-config="{ selectOptionEvent: undefined, optionClassName: '' }"
            :options="WEBHOOKS"
            :selected-option-id="selectedHook"
            filter-field="title"
            show-selected-option
            disable-mascot
            class="max-h-72"
            @selected="(hook) => (selectedHook = hook.id)"
          >
            <template #bottom>
              <a-divider style="margin: 4px 0" />
              <div
                class="flex items-center justify-between px-2 py-2 rounded-md text-sm text-nc-content-brand cursor-pointer hover:bg-nc-bg-gray-light"
              >
                Create webhook
                <GeneralIcon icon="plus" />
              </div>
            </template>
          </NcListWithSearch>
        </div>
      </PgDemo>
    </div>

    <PgDemo label="NcTable" hint="sortable headers · custom cells · loading">
      <template #actions>
        <NcSwitch v-model:checked="isTableLoading" size="xsmall"><span class="text-captionSm">Loading</span></NcSwitch>
      </template>
      <!-- no fixed height: NcTable grows to min-h-120 while loading, which a fixed box would clip -->
      <div>
        <NcTable
          v-model:order-by="orderBy"
          :columns="TABLE_COLUMNS"
          :data="sortedMembers"
          :is-data-loading="isTableLoading"
          row-height="48px"
          header-row-height="40px"
          class="h-full"
        >
          <template #bodyCell="{ column, record }">
            <div v-if="column.key === 'name'" class="flex items-center gap-3 min-w-0">
              <GeneralUserIcon :user="{ email: record.email, display_name: record.name }" size="base" />
              <div class="min-w-0">
                <div class="text-captionBold truncate">{{ record.name }}</div>
                <div class="text-captionSm text-nc-content-gray-muted truncate">{{ record.email }}</div>
              </div>
            </div>
            <NcBadge v-else-if="column.key === 'role'" :border="false" :color="record.role === 'Owner' ? 'purple' : 'gray'">
              <span class="text-captionSm px-1">{{ record.role }}</span>
            </NcBadge>
            <NcButton v-else-if="column.key === 'action'" size="xsmall" type="text" icon-only>
              <template #icon><GeneralIcon icon="threeDotVertical" /></template>
            </NcButton>
            <span v-else class="text-caption text-nc-content-gray-subtle">{{ record[column.dataIndex as string] }}</span>
          </template>
        </NcTable>
      </div>
    </PgDemo>
  </PgSection>
</template>
