import { message } from 'ant-design-vue'

/** Where `ShellActions` teleports a pane's action row: the header band's action zone. */
export const SHELL_ACTIONS_TARGET = '#nc-shell-actions'

/**
 * A registration that an editing pane hands to its shell so the single, unified
 * save bar can observe its dirty state and delegate save/reset back to the pane.
 * The pane keeps full ownership of its save internals — the shell only observes
 * and forwards.
 */
export interface ShellSaveRegistration {
  isDirty: Ref<boolean>
  isSaving?: Ref<boolean>
  canSave?: Ref<boolean>
  save: () => Promise<boolean> | boolean
  reset: () => void
}

const [useProvideShell, useShellState] = useInjectionState(() => {
  const { t } = useI18n()

  const registration = shallowRef<ShellSaveRegistration | null>(null)

  /**
   * A pane that drills in registers how to step back out. Escape then unwinds
   * the drill-in before it closes the shell, so one press never loses two levels.
   * Returns true when it handled the press.
   */
  const backHandler = shallowRef<(() => boolean) | null>(null)

  const registerBackHandler = (fn: () => boolean) => {
    backHandler.value = fn
  }

  const unregisterBackHandler = (fn?: () => boolean) => {
    if (!fn || backHandler.value === fn) backHandler.value = null
  }

  const goBack = () => !!backHandler.value?.()

  // The save bar shows only while a pane has registered (i.e. an editing pane
  // that opts into the batch-save model). Auto-save panes never register.
  const hasSaveBar = computed(() => registration.value !== null)

  const isDirty = computed(() => !!registration.value?.isDirty.value)

  const isSaving = computed(() => !!registration.value?.isSaving?.value)

  const canSave = computed(() => registration.value?.canSave?.value ?? true)

  const registerSaveHandler = (reg: ShellSaveRegistration) => {
    registration.value = reg
  }

  const unregister = (reg?: ShellSaveRegistration) => {
    // Only clear if the caller still owns the slot (guards against a newly
    // mounted pane's registration being wiped by the previous pane's unmount).
    if (!reg || registration.value === reg) {
      registration.value = null
    }
  }

  const save = async () => {
    if (!registration.value || !isDirty.value || !canSave.value) return

    const ok = await registration.value.save()

    if (ok) message.toast(t('msg.toast.changesSaved'))
  }

  const reset = () => {
    registration.value?.reset()
  }

  return {
    hasSaveBar,
    isDirty,
    isSaving,
    canSave,
    registerSaveHandler,
    unregister,
    save,
    reset,
    registerBackHandler,
    unregisterBackHandler,
    goBack,
  }
})

export { useProvideShell }

/**
 * Consumer hook. Returns `undefined` when used outside a shell (e.g. when a pane
 * is opened standalone in its legacy modal) so callers can no-op safely.
 */
export function useShell() {
  return useShellState()
}
