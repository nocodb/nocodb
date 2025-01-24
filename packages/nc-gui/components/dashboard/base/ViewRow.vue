<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const props = defineProps<{
  column: NcTableColumnProps
  record: ViewType
}>()

const indentation = `32px`

const { dashboardUrl } = useDashboard()

const isPubliclyShared = computed(() => !!props.record.uuid)

const maxTitleWidth = computed(() => `calc(100% - 28px - ${indentation} - ${isPubliclyShared.value ? '30px' : '0px'})`)

const sharedViewUrl = computed(() => {
  if (!isPubliclyShared.value) return

  let viewType
  switch (props.record.type) {
    case ViewTypes.FORM:
      viewType = 'form'
      break
    case ViewTypes.KANBAN:
      viewType = 'kanban'
      break
    case ViewTypes.GALLERY:
      viewType = 'gallery'
      break
    case ViewTypes.MAP:
      viewType = 'map'
      break
    default:
      viewType = 'view'
  }

  return encodeURI(`${dashboardUrl?.value}#/nc/${viewType}/${props.record.uuid}`)
})
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
    <a v-if="isPubliclyShared" :href="sharedViewUrl" target="_blank" @click.stop>
      <NcTooltip>
        <template #title>
          {{ $t('labels.sharedPublicly') }}
        </template>
        <NcBadge color="green" size="xs" class="h-4" :border="false">
          <GeneralIcon icon="globe" />
        </NcBadge>
      </NcTooltip>
    </a>
  </div>
</template>
