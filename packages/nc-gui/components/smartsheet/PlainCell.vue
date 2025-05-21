<script lang="ts" setup>
import { type BoolType, type ColumnType } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  modelValue: any
  bold?: BoolType
  italic?: BoolType
  underline?: BoolType
}

const props = defineProps<Props>()

const meta = inject(MetaInj)

const { t } = useI18n()

const { metas } = useMetas()

const column = toRef(props, 'column')

const { sqlUis } = storeToRefs(useBase())

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const { isXcdbBase, isMssql, isMysql } = useBase()

const sqlUi = ref(
  column.value?.source_id && sqlUis.value[column.value?.source_id]
    ? sqlUis.value[column.value?.source_id]
    : Object.values(sqlUis.value)[0],
)

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const parsedValue = computed(() => {
  if (!meta?.value) return ''

  return parsePlainCellValue(props.modelValue, {
    col: column.value,
    abstractType: abstractType.value,
    meta: meta.value,
    metas: metas.value,
    baseUsers: basesUser.value,
    isMssql,
    isMysql,
    isXcdbBase,
    t,
  })
})
</script>

<template>
  <span
    class="plain-cell before:px-1"
    :class="{
      '!font-bold': bold,
      '!italic': italic,
      'underline': underline,
    }"
    data-testid="nc-plain-cell"
  >
    {{ parsedValue }}
  </span>
</template>

<style lang="scss" scoped>
.plain-cell {
  font-synthesis: initial !important;
  &::before {
    content: '•';
    padding: 0 4px;
    display: inline-block;
    text-decoration: none !important;
  }
  &:first-child::before {
    content: '';
    padding: 0;
  }
  &:first-child {
    padding-left: 0;
  }
}
</style>
