<script lang="ts" setup>
import type { UserType } from 'nocodb-sdk'

interface Props {
  user: UserType
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const { user, disabled } = toRefs(props)
</script>

<template>
  <div class="w-full flex gap-3 items-center">
    <template v-if="user?.email">
      <GeneralUserIcon size="base" :user="user" :disabled="disabled" class="flex-none" />
      <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
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
              {{ extractUserDisplayNameOrEmail(user) }}
            </template>
            {{ extractUserDisplayNameOrEmail(user) }}
          </NcTooltip>
        </div>
        <NcTooltip
          class="truncate max-w-full text-xs"
          :class="{ 'text-nc-content-gray-muted': disabled, 'text-nc-content-gray-subtle2': !disabled }"
          show-on-truncate-only
        >
          <template #title>
            {{ user.email }}
          </template>
          {{ user.email }}
        </NcTooltip>
      </div>
    </template>
    <div v-else>
      {{ user?.id || user?.fk_user_id }}
    </div>
  </div>
</template>
