<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { parseKey, shouldRenderCell } from '../../../utils/groupbyUtils'
import type { Group } from '~/lib/types'

interface Props {
  group: Group
}

const props = defineProps<Props>()

const { isDark, getColor } = useTheme()

const isColorCodeEnabled = computed(() => parseProp(props.group.column?.meta)?.isColorCodeEnabled !== false)

const isVarTitle = computed(() => props.group.key in GROUP_BY_VARS.VAR_TITLES)

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
    <template v-if="group.column.uidt === UITypes.MultiSelect && !isVarTitle">
      <span
        v-for="[tagIndex, tag] of Object.entries(group.key.split(','))"
        :key="`${group.column.id}-${tag}`"
        class="nc-gallery-group-chip rounded-xl"
        :style="chipStyle(group.color?.split(',')[+tagIndex])"
      >
        {{ tag }}
      </span>
    </template>
    <template v-else-if="!isVarTitle && shouldRenderCell(group.column)">
      <template v-for="(val, ind) of parseKey(group)" :key="ind">
        <SmartsheetGridGroupByLabel v-if="val" :column="group.column" :model-value="val" />
        <span v-else class="text-nc-content-gray-disabled">{{ $t('labels.noMappedValue') }}</span>
      </template>
    </template>
    <span v-else-if="isVarTitle" class="nc-gallery-group-chip rounded-md bg-nc-bg-gray-medium text-nc-content-gray-subtle">
      {{ GROUP_BY_VARS.VAR_TITLES[group.key] }}
    </span>
    <span
      v-else
      class="nc-gallery-group-chip"
      :class="group.column.uidt === UITypes.SingleSelect ? 'rounded-xl' : 'rounded-md'"
      :style="chipStyle(group.color)"
    >
      {{ parseKey(group)?.join(', ') }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.nc-gallery-group-chip {
  @apply px-3 text-[13px] leading-[22px] font-semibold truncate max-w-80;
}
</style>
