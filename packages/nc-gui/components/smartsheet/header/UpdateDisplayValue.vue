<script setup lang="ts">
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  value?: boolean
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { eventBus } = useSmartsheetStoreOrThrow()

const { fields } = useViewColumnsOrThrow()

const meta = inject(MetaInj, ref())

const searchField = ref('')

const column = toRef(props, 'column')

const value = useVModel(props, 'value')

const selectedField = ref()

const isLoading = ref(false)

const filteredColumns = computed(() => {
  const columns = meta.value?.columnsById ?? {}

  return (fields.value ?? [])
    .filter((f) => !isVirtualCol(columns[f.fk_column_id]))
    .filter((c) => c.title.toLowerCase().includes(searchField.value.toLowerCase()))
})

const changeDisplayField = async () => {
  isLoading.value = true

  try {
    await $api.dbTableColumn.primaryColumnSet(selectedField?.value?.fk_column_id as string)

    await getMeta(meta?.value?.id as string, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    value.value = false
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

onMounted(() => {
  searchField.value = ''
  selectedField.value = fields.value?.find((f) => f.fk_column_id === column.value.id)
})
</script>

<template>
  <NcModal v-model:visible="value" size="small">
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-base text-gray-800 font-semibold">{{ $t('labels.searchDisplayValue') }}</h1>
        <div class="text-gray-600 flex items-center gap-1">
          {{ $t('labels.selectYourNewTitleFor') }}

          <span class="bg-gray-100 inline-flex items-center gap-1 px-1 rounded-md">
            <component :is="iconMap.table" />
            {{ meta?.title ?? meta?.table_name }}
          </span>
        </div>
      </div>

      <div class="flex w-full gap-2 justify-between items-center">
        <a-input v-model:value="searchField" class="w-full h-8 flex-1" size="small" :placeholder="$t('placeholder.searchFields')">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
          </template>
        </a-input>
      </div>

      <div class="border-1 rounded-md h-[250px] nc-scrollbar-md border-gray-200">
        <div
          v-for="col in filteredColumns"
          :key="col.fk_column_id"
          :class="{
            'bg-gray-100': selectedField === col,
          }"
          :data-testid="`nc-display-field-update-menu-${col.title}`"
          class="px-3 py-1 flex flex-row items-center rounded-md hover:bg-gray-100"
          @click.stop="selectedField = col"
        >
          <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[5px] pr-2">
            <component :is="getIcon(meta.columnsById[col.fk_column_id])" class="!w-3.5 !h-3.5 !text-gray-500" />
            <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
              <template #title>
                {{ col.title }}
              </template>
              <template #default>{{ col.title }}</template>
            </NcTooltip>
          </div>

          <div class="flex-1" />

          <component :is="iconMap.check" v-if="selectedField === col" class="!w-4 !h-4 !text-brand-500" />
        </div>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="value = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :disabled="!selectedField || selectedField.fk_column_id === column.id"
          :loading="isLoading"
          size="small"
          @click="changeDisplayField"
        >
          {{ $t('labels.changeDisplayValueField') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
