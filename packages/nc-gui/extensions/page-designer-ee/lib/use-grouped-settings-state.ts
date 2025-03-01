import { PageDesignerPayloadInj } from './context'

const map = new Map<string, boolean>()

export function useGroupedSettingsState(title: string) {
  const { extension } = useExtensionHelperOrThrow()
  const payload = inject(PageDesignerPayloadInj)
  const key = computed(() => `${extension.value.id}${title}${payload?.value.currentWidgetId ?? -1}`)
  const state = computed(() => map.get(key.value) ?? true)
  function updateState(val: boolean) {
    map.set(key.value, val)
  }
  return { state, updateState }
}
