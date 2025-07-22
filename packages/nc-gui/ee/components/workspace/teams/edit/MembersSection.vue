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
  <NcTable
    :is-data-loading="false"
    :columns="membersColumns"
    :data="membersData"
    :bordered="false"
    row-height="56px"
    disable-table-scroll
    force-sticky-header
    header-row-height="44px"
    table-toolbar-class-name="pt-6"
    class="nc-field-permissions-table flex-1"
  >
    <template #tableToolbar>
      <div class="flex items-center justify-between min-h-8">
        <h3 class="text-nc-content-gray-emphasis text-bodyBold mb-0">{{ $t('labels.members') }}</h3>
        <div class="flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
    </template>
  </NcTable>
</template>

<style lang="scss" scoped></style>
