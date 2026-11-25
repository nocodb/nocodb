<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { isLinkRecordGroup, parseKey, shouldRenderCell } from '../../../utils/groupbyUtils'
import type { Group } from '~/lib/types'

interface Props {
  group: Group
}

const props = defineProps<Props>()

const { isDark, getColor } = useTheme()

const isColorCodeEnabled = computed(() => parseProp(props.group.column?.meta)?.isColorCodeEnabled !== false)

const isVarTitle = computed(() => props.group.key in GROUP_BY_VARS.VAR_TITLES)

// A single-record Links group is keyed by the record's display value, not a count.
const isLinkRecord = computed(() => isLinkRecordGroup(props.group))

const isChipType = computed(
  () =>
    isLinkRecord.value ||
    [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.LinkToAnotherRecord].includes(props.group.column?.uidt as UITypes),
)

// Same split as the canvas grid header: one chip per option or linked record.
const chips = computed(() => {
  if (isLinkRecord.value) return parseKey(props.group) ?? []
  const parsed = props.group.column?.uidt === UITypes.LinkToAnotherRecord ? parseKey(props.group) : props.group.key
  return (Array.isArray(parsed) ? parsed.flat() : String(parsed ?? '').split(',')).filter((tag) => tag !== '')
})

const cellValue = computed(() => {
  try {
    const parsed = JSON.parse(props.group.key)
    return ncIsObject(parsed) || ncIsArray(parsed) ? parsed : props.group.key
  } catch {
    return props.group.key
  }
})

function chipStyle(color?: string) {
  return {
    backgroundColor: getSelectTypeFieldOptionBgColor({
      isDark: isDark.value,
      color: color || '#ccc',
      getColor,
      isColorCodeEnabled: isColorCodeEnabled.value,
    }),
    color: getSelectTypeFieldOptionTextColor({
      isDark: isDark.value,
      color: color || '#ccc',
      getColor,
      isColorCodeEnabled: isColorCodeEnabled.value,
    }),
  }
}
</script>

<template>
  <div class="nc-gallery-group-value flex items-center flex-wrap gap-1 min-w-0">
    <span v-if="isVarTitle" class="nc-gallery-group-chip rounded-md bg-nc-bg-gray-medium text-nc-content-gray-subtle">
      {{ GROUP_BY_VARS.VAR_TITLES[group.key] }}
    </span>
    <template v-else-if="isChipType">
      <span
        v-for="(tag, tagIndex) of chips"
        :key="`${group.column.id}-${tagIndex}-${tag}`"
        class="nc-gallery-group-chip"
        :class="group.column.uidt === UITypes.LinkToAnotherRecord || isLinkRecord ? 'rounded-md' : 'rounded-xl'"
        :style="chipStyle(group.color?.split(',')[tagIndex] ?? group.color)"
      >
        {{ tag }}
      </span>
    </template>
    <template v-else-if="shouldRenderCell(group.column)">
      <template v-for="(val, ind) of parseKey(group)" :key="ind">
        <SmartsheetGridGroupByLabel v-if="val" :column="group.column" :model-value="val" class="nc-gallery-group-cell" />
        <span v-else class="text-nc-content-gray-disabled">{{ $t('labels.noMappedValue') }}</span>
      </template>
    </template>
    <SmartsheetGridGroupByLabel v-else :column="group.column" :model-value="cellValue" class="nc-gallery-group-cell" />
  </div>
</template>

<style lang="scss" scoped>
.nc-gallery-group-cell {
  @apply min-w-0 max-w-full overflow-hidden;
  max-height: 22px;

  // The header has the room the grid cell doesn't: show the whole date and time.
  :deep(.nc-date-picker .nc-truncate) {
    @apply !w-auto !max-w-none;
  }

  // Rich and Smart Text: run headings and paragraphs together on one line.
  :deep(:is(h1, h2, h3, h4, h5, h6, p, ul, ol, li, blockquote)) {
    @apply inline m-0 p-0 text-inherit leading-inherit;
  }

  :deep(:is(h1, h2, h3, h4, h5, h6, p, li)::after) {
    content: ' ';
  }
}

.nc-gallery-group-chip {
  @apply px-3 text-[13px] leading-[22px] font-semibold truncate max-w-80;
}
</style>
