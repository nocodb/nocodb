<script lang="ts" setup>
import type { TeamV3V3Type } from 'nocodb-sdk'
import type { TeamIconProps } from './Icon.vue'

interface Props {
  team: TeamV3V3Type
  disabled?: boolean
  iconProps?: TeamIconProps
  showMembersCount?: boolean
  showBreadcrumb?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  iconProps: () => ({
    size: 'base',
  }),
  disabled: false,
  showMembersCount: true,
  showBreadcrumb: false,
})

const { team, disabled, showBreadcrumb } = toRefs(props)

const workspaceStore = useWorkspace()

const { getTeamBreadcrumb } = workspaceStore

const breadcrumb = computed(() => {
  if (!showBreadcrumb.value) return []
  return getTeamBreadcrumb(team.value.id)
})
</script>

<template>
  <div class="w-full flex gap-3 items-center">
    <GeneralTeamIcon v-bind="iconProps" :team="team" class="flex-none" />
    <div class="flex flex-1 max-w-[calc(100%_-_44px)] flex-col">
      <div class="flex items-center gap-1">
        <NcTooltip
          class="truncate max-w-full capitalize font-semibold"
          :class="{
            'text-nc-content-gray': !disabled,
            'text-nc-content-gray-muted': disabled,
          }"
          show-on-truncate-only
        >
          <template #title>
            {{ team.title }}
          </template>
          {{ team.title }}
        </NcTooltip>
        <slot name="title-append" />
      </div>
      <div
        v-if="showBreadcrumb && breadcrumb.length > 1"
        class="flex items-center gap-0.5 text-[11px] text-nc-content-gray-subtle2 truncate"
      >
        <template v-for="(crumb, idx) in breadcrumb" :key="crumb.id">
          <span :class="idx === breadcrumb.length - 1 ? 'text-nc-content-gray-subtle font-medium' : ''" class="truncate max-w-20">
            {{ crumb.title }}
          </span>
          <GeneralIcon v-if="idx < breadcrumb.length - 1" icon="ncArrowRight" class="h-3 w-3 flex-none" />
        </template>
      </div>
      <NcTooltip
        v-else-if="showMembersCount"
        class="truncate max-w-full text-xs"
        :class="{ 'text-nc-content-gray-muted': disabled, 'text-nc-content-gray-subtle2': !disabled }"
        show-on-truncate-only
      >
        <template #title> {{ team.members_count }} {{ $t('labels.members') }} </template>
        {{ team.members_count }} {{ $t('labels.members') }}
      </NcTooltip>
    </div>
  </div>
</template>
