<script lang="ts" setup>
import type { TeamV3V3Type, UserType } from 'nocodb-sdk'
import { InviteLinkScope } from 'nocodb-sdk'

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

const { t } = useI18n()

const { $e } = useNuxtApp()

const dialogShow = useVModel(props, 'modelValue', emit)

const { load: loadInviteLinks } = useInviteLinks()

/**
 * Only the workspace invite gets a link. Base settings and the team pickers are
 * deliberately untouched: a team link would hand out membership of a group, not
 * of a thing, which is a different grant.
 */
const showLinks = computed(() => props.type === 'workspace' && !props.isTeam && !!props.workspaceId)

const screen = ref<'main' | 'links' | 'edit'>('main')

const editLinkId = ref('')

const editLinkIsNew = ref(false)

const heading = computed(() => {
  if (screen.value === 'links') return t('activity.inviteLinks')
  if (screen.value === 'edit') return t(editLinkIsNew.value ? 'activity.newInviteLink' : 'activity.editInviteLink')

  if (props.type === 'organization') return 'Invite Members to Workspaces'

  if (props.type === 'base') return props.isTeam ? t('activity.addTeamsToBase') : t('activity.addMember')

  return props.isTeam ? t('activity.addTeamsToWorkspace') : t('activity.inviteToWorkspace')
})

function openEditLink(linkId: string, isNew = false) {
  $e('c:share:ws:link:edit', { isNew })

  editLinkId.value = linkId
  editLinkIsNew.value = isNew
  screen.value = 'edit'
}

function goMain() {
  screen.value = 'main'
}

function openLinks() {
  $e('c:share:ws:links')
  screen.value = 'links'
}

watch(dialogShow, (open) => {
  if (!open) {
    screen.value = 'main'
    return
  }

  if (showLinks.value) {
    loadInviteLinks({ scope: InviteLinkScope.WORKSPACE, workspaceId: props.workspaceId })
  }
})
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
        <NcButton v-if="screen !== 'main'" type="text" size="xsmall" class="!px-0 !w-7" @click="goMain">
          <GeneralIcon icon="ncArrowLeft" class="w-4 h-4" />
        </NcButton>
        {{ heading }}
      </div>
    </template>

    <template v-if="screen === 'main'">
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

      <!-- Its own card: the form above ends in its own footer, so without one
           the link block reads as stranded under those buttons. -->
      <div v-if="showLinks" class="mt-5 p-4 rounded-xl bg-nc-bg-gray-extralight">
        <DlgShareAndCollaborateHubLinkBlock @manage="openLinks" />
      </div>
    </template>

    <DlgShareAndCollaborateHubLinks v-else-if="screen === 'links'" class="!px-0" @edit-link="openEditLink" />

    <DlgShareAndCollaborateHubEditLink v-else class="!px-0" :link-id="editLinkId" :is-new="editLinkIsNew" @done="goMain" />
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
