<script lang="ts" setup>
import type { TeamV3V3Type } from 'nocodb-sdk'
import type { TeamIconProps } from './Icon.vue'

interface Props {
  team: TeamV3V3Type
  disabled?: boolean
  iconProps?: TeamIconProps
  showMembersCount?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  iconProps: () => ({
    size: 'base',
  }),
  disabled: false,
  showMembersCount: true,
})

const { team, disabled } = toRefs(props)
</script>

<template>
  <div class="w-full flex gap-3 items-center">
    <GeneralTeamIcon v-bind="iconProps" :team="team" class="flex-none" />
    <div
      class="flex flex-1 max-w-[calc(100%_-_44px)]"
      :class="{
        'flex-col': showMembersCount,
        'items-center': !showMembersCount,
      }"
    >
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
      </div>
      <NcTooltip
        v-if="showMembersCount"
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
