<script lang="ts" setup>
interface Props {
  modelValue: boolean
  baseId: string
  email?: string
  /** True when the invitee is also added to the cell. */
  addToRecord?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'invited', emails: string[]): void
}>()

const { t } = useI18n()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const visible = useVModel(props, 'modelValue', emit)

const members = computed(() => (basesUser.value.get(props.baseId) || []).filter((user) => !user.deleted))

const emails = computed(() => (props.email ? [props.email] : undefined))

const submitLabel = computed(() => (props.addToRecord ? t('activity.inviteAndAddToRecord') : t('activity.inviteToBase')))

// Sync: the form closes right after `success`, and the dialog unmounts soon after.
function onSuccess(invitedEmails: string[]) {
  if (invitedEmails?.length) emit('invited', invitedEmails)
}
</script>

<template>
  <NcModal
    v-model:visible="visible"
    :show-separator="false"
    size="medium"
    class="nc-cell-user-invite-dlg"
    wrap-class-name="nc-cell-user-invite-dlg-wrap"
    @keydown.esc="visible = false"
  >
    <template #header>
      <div class="text-xl font-semibold text-nc-content-gray">
        {{ addToRecord ? $t('activity.inviteNewUser') : $t('activity.inviteToBase') }}
      </div>
    </template>

    <DlgInviteForm
      :active="visible"
      type="base"
      :base-id="baseId"
      :emails="emails"
      :users="members"
      :submit-label="submitLabel"
      @success="onSuccess"
      @close="visible = false"
    />
  </NcModal>
</template>

<style lang="scss">
// The email picker drops below the input; let it overflow the modal body.
.nc-cell-user-invite-dlg .ant-modal-body,
.nc-cell-user-invite-dlg .ant-modal-content {
  overflow: visible !important;
}
</style>
