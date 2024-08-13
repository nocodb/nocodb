<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { Group } from '~/lib/types'

const props = defineProps<{
  group: Group
  maxDepth: number
  depth: number
  scrollLeft?: number
}>()

const group = toRef(props, 'group')

const scrollLeft = toRef(props, 'scrollLeft')

const isLocked = inject(IsLockedInj, ref(false))

const getAddnlMargin = (depth: number) => {
  if (props.maxDepth === 3) {
    switch (depth) {
      case 3:
        return 17
      case 2:
        return 0
      case 1:
        return 10
      default:
        return 18
    }
  } else if (props.maxDepth === 2) {
    switch (depth) {
      case 1:
        return 0
      default:
        return 10
    }
  }
}

const { visibleFieldsComputed, updateAggregate, getAggregations } = useViewAggregateOrThrow()
</script>

<template>
  <template v-for="({ field, width, column, value }, index) in visibleFieldsComputed" :key="index">
    <div
      v-if="index === 0 && scrollLeft > 30"
      :style="`width: ${getAddnlMargin(depth, true)}px;min-width: ${getAddnlMargin(depth, true)}px;max-width: ${getAddnlMargin(
        depth,
        true,
      )}px`"
    ></div>
    <NcDropdown
      v-if="field && column?.id"
      :disabled="[UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!) || isLocked"
      overlay-class-name="max-h-64 relative scroll-container nc-scrollbar-thin overflow-auto"
      @click.stop
    >
      <div
        class="flex items-center overflow-x-hidden justify-end group-aggregation hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
        :style="{
          'min-width': width,
          'max-width': width,
          'width': width,
        }"
      >
        <template v-if="![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!)">
          <div
            v-if="field?.aggregation === 'none' || field?.aggregation === null"
            class="text-gray-500 opacity-0 transition group-hover-aggregation"
          >
            <GeneralIcon class="text-gray-500" icon="arrowDown" />
            <span class="text-[10px] font-semibold"> Summary </span>
          </div>

          <NcTooltip
            v-else-if="value !== undefined"
            show-on-truncate-only
            :style="{
              maxWidth: `${field?.width}px`,
            }"
          >
            <div class="flex gap-2 truncate text-nowrap overflow-hidden items-center">
              <span class="text-gray-500 text-[12px] leading-4">
                {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
              </span>

              <span class="text-gray-600 font-semibold text-[12px]">
                {{ formatAggregation(field.aggregation, group.aggregations[column.title], column) }}
              </span>
            </div>

            <template #title>
              <div class="flex gap-2 text-nowrap overflow-hidden items-center">
                <span class="text-[12px] leading-4">
                  {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
                </span>

                <span class="font-semibold text-[12px]">
                  {{ formatAggregation(field.aggregation, group.aggregations[column.title], column) }}
                </span>
              </div>
            </template>
          </NcTooltip>
        </template>
      </div>

      <template #overlay>
        <NcMenu>
          <NcMenuItem
            v-for="(agg, i) in getAggregations(column)"
            :key="i"
            class="!flex-1 nc-aggregation-menu"
            @click="updateAggregate(column.id, agg)"
          >
            <div class="flex !flex-grow-1 !w-full text-[13px] text-gray-800 items-center justify-between">
              {{ $t(`aggregation_type.${agg}`) }}

              <GeneralIcon v-if="field?.aggregation === agg" class="text-brand-500" icon="check" />
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </template>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}

.group-aggregation:hover {
  .group-hover-aggregation {
    @apply opacity-100;
  }
}
</style>
