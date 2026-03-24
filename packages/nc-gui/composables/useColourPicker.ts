import { normalizeHexColourWithAlpha } from 'nocodb-sdk'

/**
 * Shared colour-picker logic used by both the cell Editor and the
 * FilterInput components.  Centralises the open/close state, temp colour,
 * picker-key, keyboard listener, and save/cancel handlers.
 */
export function useColourPicker(opts: {
  /** Called with the normalised `#RRGGBB` value when the user clicks Save. */
  onSave: (colour: string) => void
  /** Optional callback when the picker is closed without saving. */
  onClose?: () => void
  /** When true the picker cannot be opened. */
  disabled?: Ref<boolean> | ComputedRef<boolean>
}) {
  const isOpen = ref(false)
  const tempColor = ref<string | null>(null)
  const pickerKey = ref(0)

  const openColorPicker = (initialColour: string) => {
    if (unref(opts.disabled)) return
    pickerKey.value++
    tempColor.value = initialColour
    isOpen.value = true
  }

  const onColorChange = (color: string) => {
    tempColor.value = color
  }

  const save = () => {
    if (tempColor.value) {
      const normalized = normalizeHexColourWithAlpha(tempColor.value)
      if (normalized) {
        opts.onSave(normalized)
      }
    }
    isOpen.value = false
  }

  const close = () => {
    isOpen.value = false
    opts.onClose?.()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isOpen.value) return
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  watch(isOpen, (open) => {
    if (open) {
      document.addEventListener('keydown', onKeyDown)
    } else {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
  })

  return {
    isOpen,
    tempColor,
    pickerKey,
    openColorPicker,
    onColorChange,
    save,
    close,
  }
}
