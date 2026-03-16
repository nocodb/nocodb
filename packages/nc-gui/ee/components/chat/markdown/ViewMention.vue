<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'

interface Props {
  name: string
  id?: string
  tableId?: string
  type?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  tableId: undefined,
  type: undefined,
})

const { ncNavigateTo } = useGlobal()

const { isFullScreen } = useChatPanel()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { activeProjectId } = storeToRefs(useBases())

const { viewsByTable } = storeToRefs(useViewsStore())

const resolvedView = computed(() => {
  if (!props.id || !props.tableId || !activeProjectId.value) return undefined

  const key = `${activeProjectId.value}:${props.tableId}`
  const views = viewsByTable.value.get(key)
  return views?.find((v) => v.id === props.id)
})

const displayName = computed(() => resolvedView.value?.title || props.name)

const resolvedType = computed(() => {
  const raw = resolvedView.value?.type ?? props.type
  if (raw == null) return undefined
  return typeof raw === 'string' ? Number(raw) : raw
})

const iconMeta = computed<ViewType>(() => {
  if (resolvedView.value) return resolvedView.value
  return { title: props.name, type: resolvedType.value } as ViewType
})

const { $e } = useNuxtApp()

const handleClick = () => {
  if (!props.id || !props.tableId) return
  $e('c:chat:mention:view')

  if (!resolvedView.value) {
    message.info(`View "${displayName.value}" no longer exists`)
    return
  }

  const workspaceId = activeWorkspaceId.value
  const baseId = activeProjectId.value

  if (workspaceId && baseId) {
    if (isFullScreen.value) isFullScreen.value = false

    ncNavigateTo({
      workspaceId,
      baseId,
      tableId: props.tableId,
      viewId: props.id,
      viewTitle: displayName.value,
    })
  }
}
</script>

<template>
  <ChatMarkdownMention :name="displayName" :clickable="!!id && !!tableId" @click="handleClick">
    <template #icon>
      <NcIconView :view="iconMeta" class="flex-none w-4 h-4" />
    </template>
  </ChatMarkdownMention>
</template>

<style lang="scss" scoped></style>
