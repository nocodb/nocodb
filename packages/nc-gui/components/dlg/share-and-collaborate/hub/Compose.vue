<script lang="ts" setup>
/** The invite screen: one field, one role, one button. */
const props = defineProps<{
  active: boolean
  baseId?: string
  users?: Array<{ email?: string }>
}>()

const emit = defineEmits(['back', 'sent'])

const { t } = useI18n()

const formRef = ref<{
  submit: () => Promise<void>
  canSubmit: boolean
  isLoading: boolean
  recipientCount: number
} | null>(null)

const sendLabel = computed(() => {
  const count = formRef.value?.recipientCount || 0
  if (!count) return t('activity.invitePeople')

  return t('activity.invitePeopleCount', { count }, count)
})
</script>

<template>
  <div class="flex flex-col gap-4 px-6 pt-4 pb-5">
    <DlgInviteForm
      ref="formRef"
      :active="props.active"
      type="base"
      :base-id="props.baseId"
      :users="props.users"
      layout="compose"
      :show-footer="false"
      @success="emit('sent', $event)"
      @close="emit('back')"
    />

    <NcButton
      type="primary"
      size="medium"
      class="nc-hub-invite-btn !w-full"
      full-width
      data-testid="nc-hub-send-invites"
      :disabled="!formRef?.canSubmit"
      :loading="!!formRef?.isLoading"
      @click="formRef?.submit()"
    >
      <span class="flex w-full items-center justify-center">{{ sendLabel }}</span>
    </NcButton>
  </div>
</template>
