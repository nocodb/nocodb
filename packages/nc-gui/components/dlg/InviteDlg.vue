<script lang="ts" setup>
import type { TeamV3V3Type, UserType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  type?: 'base' | 'workspace' | 'organization'
  isTeam?: boolean
  baseId?: string
  emails?: string[]
  workspaceId?: string
  users?: Array<Pick<UserType, 'email'>>
  teams?: Array<TeamV3V3Type>
  existingTeamIds?: string[]
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createTable')"
    :show-separator="false"
    size="medium"
    class="nc-invite-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-row text-xl font-semibold items-center gap-x-2">
        {{
          type === 'organization'
            ? 'Invite Members to Workspaces'
            : type === 'base'
            ? isTeam
              ? $t('activity.addTeamsToBase')
              : $t('activity.addMember')
            : isTeam
            ? $t('activity.addTeamsToWorkspace')
            : $t('activity.inviteToWorkspace')
        }}
      </div>
    </template>

    <DlgInviteForm
      :active="dialogShow"
      :type="type"
      :is-team="isTeam"
      :base-id="baseId"
      :emails="emails"
      :workspace-id="workspaceId"
      :users="users"
      :teams="teams"
      :existing-team-ids="existingTeamIds"
      @close="dialogShow = false"
    />
  </NcModal>
</template>

<style lang="scss">
// The picker dropdown is absolutely positioned underneath the email input,
// but ant-modal's body clips overflow by default. Allow visible overflow only
// for this dialog so the dropdown isn't cut off when it extends past the
// modal's inner edge.
.nc-invite-dlg .ant-modal-body,
.nc-invite-dlg .ant-modal-content {
  overflow: visible !important;
}
</style>
