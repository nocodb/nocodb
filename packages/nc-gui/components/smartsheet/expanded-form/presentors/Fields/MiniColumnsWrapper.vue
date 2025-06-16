<script setup lang="ts">
const { fields, hiddenFields } = useExpandedFormStoreOrThrow()
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
      svg.nc-icon:not(.invisible):not(.nc-column-context-menu) {
        @apply !w-4 !h-4 !mx-0;
      }
    }
  }
}
</style>
