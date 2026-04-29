import { useStorage } from '@vueuse/core'

export type ExpandedFormMode = 'panel' | 'modal'

const STORAGE_KEY = 'nc-expanded-form-mode'

// Browser-level preference (localStorage, not tied to user). CE is always
// 'modal' since the panel doesn't exist there. Mobile / public views ignore
// this preference and force the modal regardless.
export const useExpandedFormMode = createSharedComposable(() => {
  const mode = useStorage<ExpandedFormMode>(STORAGE_KEY, 'panel')

  const toggle = () => {
    mode.value = mode.value === 'panel' ? 'modal' : 'panel'
  }

  return { mode, toggle }
})
