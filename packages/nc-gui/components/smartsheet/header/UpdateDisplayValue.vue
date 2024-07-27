<script setup lang="ts">
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

interface Props {
  column: ColumnType
  value?: boolean
}

const props = defineProps<Props>()

const baseStore = useBase()

const { loadTables } = baseStore

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const column = toRef(props, 'column')

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const value = useVModel(props, 'value')

const searchField = ref('')
</script>

<template>
  <NcModal v-model:visible="value" size="small">
    <div class="flex flex-col gap-3">
      <h1 class="text-base text-gray-800 font-semibold">{{ $t('labels.searchDisplayValue') }}</h1>
      <div class="text-gray-900">
        {{
          $t('labels.selectYourNewTitleFor', {
            table: relatedModel?.title,
          })
        }}
      </div>

      <div class="flex w-full gap-2 justify-between items-center">
        <a-input v-model:value="searchField" class="w-full h-8 flex-1" size="small" :placeholder="$t('placeholder.searchFields')">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
          </template>
        </a-input>
        <div class="flex items-center gap-2">
          <NcButton size="small" type="text" @click="clearAll"> {{ $t('labels.clearAll') }} </NcButton>
          <NcButton size="small" type="text" @click="selectAll"> {{ $t('general.addAll') }} </NcButton>
        </div>
      </div>

      <div class="border-1 rounded-md h-[250px] nc-scrollbar-md border-gray-200">
        <Draggable v-model="filteredColumns" item-key="id" ghost-class="nc-lookup-menu-items-ghost">
          <template #item="{ element: field }">
            <div
              :key="field.id"
              :data-testid="`nc-lookup-add-menu-${field.title}`"
              class="px-3 py-1 flex flex-row items-center rounded-md hover:bg-gray-100"
              @click.stop="selectedFields[field.id] = !selectedFields[field.id]"
            >
              <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />
              <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[5px] pr-2">
                <component :is="getIcon(field)" class="!w-3.5 !h-3.5 !text-gray-500" />
                <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                  <template #title>
                    {{ field.title }}
                  </template>
                  <template #default>{{ field.title }}</template>
                </NcTooltip>

                <NcCheckbox v-model:checked="selectedFields[field.id]" size="default" />
              </div>

              <div class="flex-1" />
            </div>
          </template>
        </Draggable>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :loading="isLoading"
          :disabled="!Object.values(selectedFields).filter(Boolean).length"
          size="small"
          @click="createLookups"
        >
          {{
            $t('general.addLookupField', {
              count: Object.values(selectedFields).filter(Boolean).length || '',
            })
          }}
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
