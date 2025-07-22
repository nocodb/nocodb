<script lang="ts" setup>
interface Props {
  team: TeamType
  tableToolbarClassName?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { team } = toRefs(props)

const { t } = useI18n()

const membersData = ref([])

const searchQuery = ref('')

const filterMembers = computed(() => {
  if (!searchQuery.value) return membersData.value ?? []

  return membersData.value.filter((member) => searchCompare([member.display_name, member.email], searchQuery.value))
})
// NcTable columns configuration
const membersColumns = [
  {
    key: 'select',
    title: '',
    width: 70,
    minWidth: 70,
  },
  {
    key: 'member_name',
    title: t('objects.member'),
  },
  {
    key: 'workspace_role',
    title: t('labels.workspaceRole'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'workspace_role',
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const selected = reactive<{
  [key: number]: boolean
}>({})

const toggleSelectAll = (value: boolean) => {
  filterMembers.value.forEach((_, i) => {
    selected[i] = value
  })
}

const customRow = (_record: Record<string, any>, recordIndex: number) => ({
  class: `${selected[recordIndex] ? 'selected' : ''} last:!border-b-0 !cursor-default`,
})
</script>

<template>
  <div class="nc-modal-teams-edit-content-section mt-6">
    <div class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('labels.members') }}</div>
    <NcTable
      :is-data-loading="false"
      :columns="membersColumns"
      :data="membersData"
      :bordered="false"
      row-height="56px"
      disable-table-scroll
      force-sticky-header
      header-row-height="44px"
      table-toolbar-class-name="pt-0"
      class="nc-field-permissions-table flex-1"
      :custom-row="customRow"
    >
      <template #tableToolbar>
        <div class="flex items-center justify-between min-h-8">
          <a-input
            v-model:value="searchQuery"
            allow-clear
            class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
            :placeholder="`${$t('general.search')}...`"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>

          <div>
            <NcButton size="small" type="secondary" inner-class="!gap-2 text-nc-content-brand">
              <template #icon>
                <GeneralIcon icon="ncUserPlus" class="h-4 w-4" />
              </template>
              {{ $t('activity.addMembers') }}
            </NcButton>
          </div>
        </div>
      </template>
    </NcTable>
  </div>
</template>

<style lang="scss" scoped></style>
