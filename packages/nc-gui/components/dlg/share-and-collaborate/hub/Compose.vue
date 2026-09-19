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
  focus: () => void
  submit: () => Promise<void>
  canSubmit: boolean
  isLoading: boolean
  recipientCount: number
} | null>(null)

const rootRef = ref<HTMLElement>()

/**
 * The screen mounts into an already-open modal, so nothing refocuses for us, and
 * the form's own focus lands before the modal transition has settled.
 *
 * Timers rather than requestAnimationFrame: rAF does not fire while the tab is
 * backgrounded, which silently skipped the focus entirely.
 */
onMounted(() => {
  let tries = 0

  const tryFocus = () => {
    const input = rootRef.value?.querySelector<HTMLInputElement>('.nc-invite-email-box input')

    if (input && document.contains(input)) {
      input.focus()
      if (document.activeElement === input) return
    }

    if (tries++ < 20) setTimeout(tryFocus, 25)
  }

  nextTick(tryFocus)
})

const sendLabel = computed(() => {
  const count = formRef.value?.recipientCount || 0
  if (!count) return t('activity.invitePeople')

  return t('activity.invitePeopleCount', { count }, count)
})
</script>

<template>
  <div ref="rootRef" class="flex flex-col gap-5 px-7 pt-5 pb-7">
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
      data-testid="nc-hub-send-invites"
      :disabled="!formRef?.canSubmit"
      :loading="!!formRef?.isLoading"
      @click="formRef?.submit()"
    >
      {{ sendLabel }}
    </NcButton>
  </div>
</template>
