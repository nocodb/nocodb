<script lang="ts" setup>
import type { UserFieldRecordType } from 'nocodb-sdk'

interface Props {
  user: Partial<UserFieldRecordType>
  canInvite?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['invite'])

const name = computed(() => extractUserDisplayNameOrEmail(props.user))
</script>

<template>
  <div class="nc-user-no-access-card w-68 max-w-[80vw]" @mousedown.stop @click.stop>
    <div class="flex items-center gap-3 px-3 py-3">
      <GeneralUserIcon :user="user" size="base" class="flex-none" />
      <div class="min-w-0 flex flex-col">
        <NcTooltip show-on-truncate-only class="truncate text-bodyBold text-nc-content-gray">
          <template #title>{{ name }}</template>
          {{ name }}
        </NcTooltip>
        <NcTooltip
          v-if="user.email && user.email !== name"
          show-on-truncate-only
          class="truncate text-bodySm text-nc-content-gray-muted"
        >
          <template #title>{{ user.email }}</template>
          {{ user.email }}
        </NcTooltip>
      </div>
    </div>
    <div
      class="flex items-center justify-between gap-2 px-3 py-1.5 bg-nc-bg-gray-extralight border-t-1 border-nc-border-gray-light"
    >
      <span class="text-bodySm text-nc-content-gray-subtle2">{{ $t('labels.noBaseAccess') }}</span>
      <NcButton
        v-if="canInvite && user.email"
        v-e="['c:base:invite:cell:open', { source: 'removed-user' }]"
        size="xsmall"
        type="text"
        class="nc-user-no-access-invite-btn -mr-1.5 !px-1.5 !text-bodySmBold !text-nc-content-brand"
        data-testid="nc-user-cell-invite-to-base"
        @click="emit('invite')"
      >
        {{ $t('activity.inviteToBase') }}
      </NcButton>
    </div>
  </div>
</template>
