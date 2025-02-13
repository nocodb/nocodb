<script setup lang="ts">
import { isSystemColumn } from 'nocodb-sdk'

/* interface */

const meta = inject(MetaInj, ref())

/* flags */

const maintainDefaultViewOrder = ref(false)
const useMetaFields = ref(false)

const { fieldsMap, isLocalMode } = useViewColumnsOrThrow()

/* fields */

const injectedFields = computedInject(FieldsInj, (_fields) => {
  if (useMetaFields.value) {
    if (maintainDefaultViewOrder.value) {
      return (meta.value?.columns ?? [])
        .filter((col) => !isSystemColumn(col))
        .sort((a, b) => {
          return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
        })
    }

    return (meta.value?.columns ?? []).filter((col) => !isSystemColumn(col))
  }
  return _fields?.value ?? []
})

const fields = computed(() => injectedFields.value ?? [])

const hiddenFields = computed(() => {
  // todo: figure out when meta.value is undefined
  return (meta.value?.columns ?? [])
    .filter(
      (col) =>
        !fields.value?.includes(col) &&
        (isLocalMode.value && col?.id && fieldsMap.value[col.id] ? fieldsMap.value[col.id]?.initialShow : true),
    )
    .filter((col) => !isSystemColumn(col))
})
</script>

<template>
  <SmartsheetExpandedFormPresentorsFieldsColumns
    :fields="fields"
    :hidden-fields="hiddenFields"
    :is-loading="false"
    force-vertical-mode
    class="mini-columns-wrapper"
  />
</template>

<style lang="scss">
.mini-columns-wrapper {
  .nc-expanded-cell-header {
    @apply !bg-transparent;
    .nc-cell-name-wrapper {
      @apply !px-0;
      .name.truncate {
        @apply flex items-center pl-2;
        span {
          @apply !text-xs font-weight-500 !leading-[14px];
        }
      }
      svg.nc-icon:not(.invisible) {
        @apply !w-4 !h-4 !mx-0;
      }
    }
  }
}
</style>
