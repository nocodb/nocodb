<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    isNew: boolean
    // Telemetry namespace — modal uses 'c:row-expand', panel uses 'c:row-expand-panel'.
    telemetryPrefix?: 'c:row-expand' | 'c:row-expand-panel'
    // Compact (panel) vs default (modal) sizing.
    compact?: boolean
  }>(),
  {
    telemetryPrefix: 'c:row-expand',
    compact: false,
  },
)

const searchQuery = defineModel<string>('searchQuery', { default: '' })

const hideBlankFields = defineModel<boolean>('hideBlankFields', { default: false })
</script>

<template>
  <div
    class="nc-expanded-form-field-filters flex-shrink-0 flex items-center border-b border-nc-border-gray-medium bg-nc-bg-gray-extralight"
    :class="[props.compact ? 'h-8 gap-3 px-3' : 'gap-3 min-h-7 p-4 xs:(px-2 py-0 min-h-[48px])']"
  >
    <div class="flex-1 min-w-0 flex items-center gap-2">
      <GeneralIcon icon="search" class="flex-none text-nc-content-gray-muted" :class="[props.compact ? 'h-3 w-3' : 'h-4 w-4']" />
      <input
        v-model="searchQuery"
        type="text"
        class="nc-expanded-form-search-input flex-1 min-w-0 bg-transparent border-none outline-none text-nc-content-gray placeholder-nc-content-gray-muted focus:(outline-none border-none ring-0 shadow-none)"
        :class="[props.compact ? 'text-xs' : 'text-sm']"
        :placeholder="$t('placeholder.searchFields')"
        data-testid="nc-expanded-form-search-input"
        @keydown.esc.stop.prevent="searchQuery = ''"
      />
      <NcButton
        v-if="searchQuery"
        v-e="[`${props.telemetryPrefix}:search:clear`]"
        class="nc-expanded-form-search-clear flex-none !px-0"
        :class="[props.compact ? '!w-4 !h-4 !min-w-4' : '!w-5 !h-5 !min-w-5']"
        data-testid="nc-expanded-form-search-clear"
        type="text"
        size="xxsmall"
        @click="searchQuery = ''"
      >
        <GeneralIcon icon="close" class="h-3 w-3 text-nc-content-gray-muted" />
      </NcButton>
    </div>
    <NcTooltip :disabled="!props.isNew" :title="$t('tooltip.notAvailableForNewRecord')" placement="top">
      <label
        v-e="hideBlankFields ? [`${props.telemetryPrefix}:hide-blank:off`] : [`${props.telemetryPrefix}:hide-blank:on`]"
        class="flex-none flex items-center gap-1.5 select-none whitespace-nowrap text-nc-content-gray-subtle"
        :class="[
          props.compact ? 'text-xs' : 'text-sm',
          { 'cursor-pointer': !props.isNew, 'opacity-50 cursor-not-allowed': props.isNew },
        ]"
        data-testid="nc-expanded-form-hide-blank-label"
      >
        <NcCheckbox
          v-model:checked="hideBlankFields"
          :disabled="props.isNew"
          data-testid="nc-expanded-form-hide-blank-checkbox"
          :size="props.compact ? 'small' : 'default'"
        />
        <span>{{ $t('labels.hideBlankFields') }}</span>
      </label>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped>
.nc-expanded-form-search-input,
.nc-expanded-form-search-input:focus,
.nc-expanded-form-search-input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}
</style>
