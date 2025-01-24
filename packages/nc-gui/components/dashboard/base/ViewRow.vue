<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'

const props = defineProps<{
  column: NcTableColumnProps
  record: ViewType
}>()

const indentation = `31px`

const isPubliclyShared = computed(() => !!props.record.uuid)

const maxTitleWidth = computed(() => `calc(100% - 28px - ${indentation} - ${isPubliclyShared.value ? '120px' : '0px'})`)
</script>

<template>
  <div
    v-if="column.key === 'name'"
    class="w-full flex items-center gap-3 max-w-full text-gray-800"
    :style="{ marginLeft: indentation }"
    data-testid="proj-view-view_item-title"
  >
    <GeneralViewIcon :meta="record" />
    <NcTooltip class="truncate font-weight-600" :style="{ maxWidth: maxTitleWidth }" show-on-truncate-only>
      <template #title>
        {{ record?.title }}
      </template>
      {{ record?.title }}
    </NcTooltip>
    <NcBadge v-if="isPubliclyShared" color="green" size="xs" class="font-weight-500" :border="false">
      {{ $t('labels.sharedPublicly') }}
    </NcBadge>
  </div>
</template>
