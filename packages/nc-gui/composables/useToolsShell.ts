import { message } from 'ant-design-vue'

/**
 * A registration that an editing tool body hands to the Tools shell so the
 * single, unified save bar can observe its dirty state and delegate save/reset
 * back to the tool. The tool keeps full ownership of its save internals — the
 * shell only observes and forwards.
 */
export interface ToolSaveRegistration {
  isDirty: Ref<boolean>
  isSaving?: Ref<boolean>
  canSave?: Ref<boolean>
  save: () => Promise<boolean> | boolean
  reset: () => void
}

const [useProvideToolsShell, useToolsShellState] = useInjectionState(() => {
  const { t } = useI18n()

  const registration = shallowRef<ToolSaveRegistration | null>(null)

  // The save bar shows only while a tool has registered (i.e. an editing tool
  // that opts into the batch-save model). Auto-save tools never register.
  const hasSaveBar = computed(() => registration.value !== null)

  const isDirty = computed(() => !!registration.value?.isDirty.value)

  const isSaving = computed(() => !!registration.value?.isSaving?.value)

  const canSave = computed(() => registration.value?.canSave?.value ?? true)

  const registerSaveHandler = (reg: ToolSaveRegistration) => {
    registration.value = reg
  }

  const unregister = (reg?: ToolSaveRegistration) => {
    // Only clear if the caller still owns the slot (guards against a newly
    // mounted tool's registration being wiped by the previous tool's unmount).
    if (!reg || registration.value === reg) {
      registration.value = null
    }
  }

  const save = async () => {
    if (!registration.value || !isDirty.value || !canSave.value) return

    const ok = await registration.value.save()

    if (ok) message.success(t('msg.toast.changesSaved'))
  }

  const reset = () => {
    registration.value?.reset()
  }

  return { hasSaveBar, isDirty, isSaving, canSave, registerSaveHandler, unregister, save, reset }
})

export { useProvideToolsShell }

/**
 * Consumer hook. Returns `undefined` when used outside the shell (e.g. when a
 * tool is opened standalone in its legacy modal) so callers can no-op safely.
 */
export function useToolsShell() {
  return useToolsShellState()
}
