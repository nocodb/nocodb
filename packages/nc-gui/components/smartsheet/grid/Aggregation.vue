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

const { metas } = useMetas()

const baseStore = useBase()

const { isMysql, isPg } = baseStore

const { meta, isViewOperationsAllowed } = useSmartsheetStoreOrThrow()

const isMmTable = computed(() => !!meta.value?.mm)

// Indexed by distance from the innermost group level.
const getAddnlMargin = (depth: number) => {
  const tier = Math.max((props.maxDepth || 1) - 1 - depth, 0)
  if (tier === 0) return 0
  if (tier === 1) return 10
  return 18 + (tier - 2) * 9
}

const { visibleFieldsComputed, updateAggregate, getAggregations } = useViewAggregateOrThrow()
</script>

<template>
  <template v-for="({ field, width, column, value }, index) in visibleFieldsComputed" :key="index">
    <div
      v-if="index === 0 && scrollLeft > 30"
      :style="`width: ${getAddnlMargin(depth)}px;min-width: ${getAddnlMargin(depth)}px;max-width: ${getAddnlMargin(depth)}px`"
    ></div>
    <NcDropdown
      v-if="field && column?.id"
      :disabled="
        [UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!) ||
        isLocked ||
        !isViewOperationsAllowed ||
        isMmTable
      "
      overlay-class-name="max-h-64 relative scroll-container nc-scrollbar-thin overflow-auto"
      @click.stop
    >
      <div
        class="flex items-center overflow-x-hidden justify-end group-aggregation text-nc-content-gray-muted transition-all transition-linear px-3 py-2"
        :class="{
          'cursor-pointer': !isLocked && isViewOperationsAllowed && !isMmTable,
          'hover:bg-nc-bg-gray-light': isViewOperationsAllowed && !isMmTable,
          'cursor-auto': !isViewOperationsAllowed || isMmTable,
        }"
        :style="{
          'min-width': width,
          'max-width': width,
          'width': width,
        }"
      >
        <template v-if="!isMmTable && ![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!)">
          <div
            v-if="field?.aggregation === 'none' || field?.aggregation === null"
            class="text-nc-content-gray-muted opacity-0 transition"
            :class="{
              'group-hover-aggregation': !isLocked && isViewOperationsAllowed,
            }"
          >
            <GeneralIcon class="text-nc-content-gray-muted" icon="arrowDown" />
            <span class="text-[10px] font-semibold"> {{ $t('labels.summary') }} </span>
          </div>

          <NcTooltip
            v-else-if="value !== undefined"
            show-on-truncate-only
            :style="{
              maxWidth: `${field?.width}px`,
            }"
          >
            <div class="flex gap-2 truncate text-nowrap overflow-hidden items-center">
              <span class="text-nc-content-gray-muted text-[12px] leading-4">
                {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
              </span>

              <span class="text-nc-content-gray-subtle2 font-semibold text-[12px]">
                {{
                  getFormattedAggrationValue(field.aggregation, group.aggregations[column.title], column, [], {
                    meta,
                    metas,
                    isMysql,
                    isPg,
                    col: column,
                  })
                }}
              </span>
            </div>

            <template #title>
              <div class="flex gap-2 text-nowrap overflow-hidden items-center">
                <span class="text-[12px] leading-4">
                  {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
                </span>

                <span class="font-semibold text-[12px]">
                  {{
                    getFormattedAggrationValue(field.aggregation, group.aggregations[column.title], column, [], {
                      meta,
                      metas,
                      isMysql,
                      isPg,
                      col: column,
                    })
                  }}
                </span>
              </div>
            </template>
          </NcTooltip>
        </template>
      </div>

      <template #overlay>
        <NcMenu variant="small">
          <NcMenuItem
            v-for="(agg, i) in getAggregations(column)"
            :key="i"
            class="!flex-1 nc-aggregation-menu"
            @click="updateAggregate(column.id, agg)"
          >
            <div class="flex !flex-grow-1 !w-full text-[13px] text-nc-content-gray items-center justify-between">
              {{ $t(`aggregation_type.${agg}`) }}

              <GeneralIcon v-if="field?.aggregation === agg" class="text-nc-content-brand" icon="check" />
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
