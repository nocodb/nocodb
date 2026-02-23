<script lang="ts" setup>
import type { NcListItemProps } from '#imports'

/**
 * NcListItem — standalone list-row component.
 *
 * Encapsulates all state-based styling (selected, active, disabled, locked,
 * variant padding, group-header, itemFullWidth) that was previously inlined
 * inside NcList.  Can be used:
 *
 *   1. Inside NcList — NcList drives isSelected / isActive via its own state.
 *   2. Standalone — caller passes isSelected / isActive / isDisabled directly
 *      and handles the `click` / `mouseover` emits itself.
 *
 * Slots mirror NcList's named slots so NcList can forward them unchanged:
 *   - listItemGroupHeader  { option }
 *   - listItem             { option, isSelected }
 *   - listItemExtraLeft    { option, isSelected, searchBasisInfo }
 *   - listItemContent      { option, isSelected, searchBasisInfo }
 *   - listItemExtraRight   { option, isSelected, searchBasisInfo }
 *   - listItemSelectedIcon { option, isSelected }
 */

const props = withDefaults(defineProps<NcListItemProps>(), {
  variant: 'default',
  index: -1,
  optionLabelKey: 'label',
  isSelected: false,
  isActive: false,
  showSelectedOption: true,
  showHoverEffect: true,
  isLocked: false,
  itemFullWidth: false,
  itemClassName: '',
  groupHeaderClassName: '',
  itemTooltipPlacement: 'right',
  groupHeaderHeight: 28,
})

const emits = defineEmits<{
  (e: 'click', option: NcListItemType, index: number, event: MouseEvent): void
  (e: 'mouseover'): void
}>()

const handleClick = (event: MouseEvent) => {
  if (props.option.ncGroupHeader || props.option.ncItemDisabled || props.isLocked) return
  emits('click', props.option, props.index, event)
}

const handleMouseover = () => {
  if (props.option.ncGroupHeader) return
  emits('mouseover')
}
</script>

<template>
  <NcTooltip
    class="flex items-center gap-2 nc-list-item w-full px-2 my-[2px] first-of-type:mt-0 last-of-type:mb-0"
    :class="[
      `nc-list-option-${index}`,
      {
        'nc-list-group-header text-nc-content-gray-muted text-bodySmBold border-t !border-t-nc-border-gray-medium !first-of-type:border-t-transparent flex items-center':
          option.ncGroupHeader,
        'rounded-md': !itemFullWidth && !option.ncGroupHeader,
        'nc-list-option-selected': isSelected,
        'bg-nc-bg-gray-light': !option?.ncItemDisabled && showHoverEffect && isSelected,
        'bg-nc-bg-gray-light nc-list-option-active': !option?.ncItemDisabled && isActive && !option.ncGroupHeader,
        'opacity-60 cursor-not-allowed': option?.ncItemDisabled && !option?.ncGroupHeader,
        'hover:bg-nc-bg-gray-light cursor-pointer': !option?.ncItemDisabled && !option?.ncGroupHeader,
        'py-2': variant === 'default' && !option.ncGroupHeader,
        'py-[5px]': variant === 'medium' && !option.ncGroupHeader,
        'py-[3px]': variant === 'small' && !option.ncGroupHeader,
        '-mx-1 px-3 w-[calc(100%_+_8px)]': variant === 'small' && option.ncGroupHeader,
        '-mx-2 px-4 w-[calc(100%_+_16px)]': variant !== 'small' && option.ncGroupHeader,
        'pointer-events-none': isLocked,
      },
      itemClassName,
      option.ncGroupHeader ? groupHeaderClassName : '',
    ]"
    :style="{
      minHeight: `${groupHeaderHeight}px`,
    }"
    :placement="itemTooltipPlacement"
    :disabled="!option?.ncItemTooltip"
    :attrs="{
      onMouseover: () => handleMouseover(),
    }"
    @click="handleClick"
  >
    <template #title>{{ option.ncItemTooltip }}</template>

    <!-- Group header row -->
    <slot v-if="option.ncGroupHeader" name="listItemGroupHeader" :option="option">
      <div>{{ option.ncGroupHeaderLabel }}</div>
    </slot>

    <!-- Regular item row -->
    <slot v-else name="listItem" :option="option" :is-selected="isSelected">
      <slot name="listItemExtraLeft" :option="option" :is-selected="isSelected" :search-basis-info="searchBasisInfo" />

      <slot name="listItemContent" :option="option" :is-selected="isSelected" :search-basis-info="searchBasisInfo">
        <NcTooltip class="truncate" :class="{ 'flex-1': !searchBasisInfo }" show-on-truncate-only>
          <template #title>{{ option[optionLabelKey] }}</template>
          {{ option[optionLabelKey] }}
        </NcTooltip>
        <div v-if="searchBasisInfo" class="flex-1 flex">
          <NcTooltip :title="searchBasisInfo" class="flex cursor-help">
            <GeneralIcon icon="info" class="flex-none h-3.5 w-3.5 text-nc-content-gray-muted" />
          </NcTooltip>
        </div>
      </slot>

      <slot name="listItemExtraRight" :option="option" :is-selected="isSelected" :search-basis-info="searchBasisInfo" />

      <slot name="listItemSelectedIcon" :option="option" :is-selected="isSelected">
        <GeneralIcon
          v-if="showSelectedOption && isSelected"
          id="nc-selected-item-icon"
          icon="check"
          class="flex-none text-nc-content-brand w-4 h-4"
        />
      </slot>
    </slot>
  </NcTooltip>
</template>
