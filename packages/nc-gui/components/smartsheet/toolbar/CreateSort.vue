<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
}>()

const emits = defineEmits(['created'])

const { isParentOpen } = toRefs(props)

const inputRef = ref()

const search = ref('')

const activeFieldIndex = ref(-1)

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow(activeView, meta)

const { sorts } = useViewSorts(activeView)

const options = computed<ColumnType[]>(
  () =>
    meta.value?.columns
      ?.filter((c: ColumnType) => {
        if (c.uidt === UITypes.Links) {
          return true
        }
        if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
          if (isHiddenCol(c)) {
            /** ignore mm relation column, created by and last modified by system field */
            return false
          }

          return (
            /** hide system columns if not enabled */
            showSystemFields.value
          )
        } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
          return false
        } else {
          /** ignore hasmany and manytomany relations if it's using within sort menu */
          return !(
            isLinksOrLTAR(c) &&
            ![RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
              (c.colOptions as LinkToAnotherRecordType).type as RelationTypes,
            )
          )
          /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
        }
      })
      .filter((c: ColumnType) => !sorts.value.find((s) => s.fk_column_id === c.id))
      .filter((c: ColumnType) => c.title?.toLowerCase().includes(search.value.toLowerCase())) ?? [],
)

const onClick = (column: ColumnType) => {
  emits('created', column)
}

watch(
  isParentOpen,
  () => {
    if (!isParentOpen.value) return

    search.value = ''
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  search.value = ''
  activeFieldIndex.value = -1
})

const onArrowDown = () => {
  activeFieldIndex.value = Math.min(activeFieldIndex.value + 1, options.value.length - 1)
}

const onArrowUp = () => {
  activeFieldIndex.value = Math.max(activeFieldIndex.value - 1, 0)
}
</script>

<template>
  <div
    class="flex flex-col w-full pt-2 w-80 nc-sort-create-modal"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(options[activeFieldIndex])"
  >
    <div class="w-full pb-3 px-2" @click.stop>
      <a-input
        ref="inputRef"
        v-model:value="search"
        :placeholder="$t('msg.selectFieldToSort')"
        class="nc-toolbar-dropdown-search-field-input"
      >
        <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
      ></a-input>
    </div>

    <div class="flex-col w-full max-h-100 nc-scrollbar-thin !overflow-y-auto px-2 pb-2">
      <div v-if="!options.length" class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6">
        <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[164px] flex-none" />

        {{ $t('title.noResultsMatchedYourSearch') }}
      </div>

      <div
        v-for="(option, index) in options"
        :key="index"
        v-e="['c:sort:add:column:select']"
        class="flex flex-row h-10 items-center gap-x-1.5 px-2 rounded-md hover:bg-gray-100 cursor-pointer nc-sort-column-search-item"
        :class="{
          'bg-gray-100': activeFieldIndex === index,
        }"
        @click="onClick(option)"
      >
        <SmartsheetHeaderIcon :column="option" />
        <NcTooltip class="truncate" show-on-truncate-only>
          <template #title> {{ option.title }}</template>
          <span>
            {{ option.title }}
          </span>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>
