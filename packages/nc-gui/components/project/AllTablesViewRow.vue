<script setup lang="ts">
import { type ViewType, ViewTypes, viewTypeAlias } from 'nocodb-sdk'

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
  const recordViewType = props.record.type as ViewTypes
  const defaultView = 'view'
  const viewTypeSegment = recordViewType === ViewTypes.GRID ? defaultView : viewTypeAlias[recordViewType] ?? defaultView

  // Check if `sharedViewUrl` fn in the SharePage.vue and in other places should be changed
  // if the below url is changed
  return encodeURI(`${dashboardUrl?.value}#/nc/${viewTypeSegment}/${props.record.uuid}`)
})
</script>

<template>
  <div
    v-if="column.key === 'name'"
    class="w-full flex items-center gap-3 max-w-full text-gray-800"
    :style="{ marginLeft: indentation }"
    data-testid="proj-view-view_item-title"
  >
    <GeneralViewIcon :meta="record" class="text-[1.125rem]" />
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
        <NcBadge color="green" size="xs" class="h-4 text-nc-content-green-dark" :border="false">
          <GeneralIcon icon="globe" />
        </NcBadge>
      </NcTooltip>
    </a>
  </div>
</template>
