<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

interface Props {
  name: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
})

const { ncNavigateTo } = useGlobal()

const { isFullScreen } = useChatPanel()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const tablesStore = useTablesStore()

const { activeProjectId } = storeToRefs(useBases())

const resolvedTable = computed(() => {
  if (!props.id || !activeProjectId.value) return undefined
  return tablesStore.activeTables.find((t) => t.id === props.id)
})

const displayName = computed(() => resolvedTable.value?.title || props.name)

const iconMeta = computed<TableType>(() => {
  if (resolvedTable.value) return resolvedTable.value
  return { title: props.name } as TableType
})

const { $e } = useNuxtApp()

const handleClick = () => {
  if (!props.id) return
  $e('c:chat:mention:table')

  if (!resolvedTable.value) {
    message.info(`Table "${displayName.value}" no longer exists`)
    return
  }

  const workspaceId = activeWorkspaceId.value
  const baseId = activeProjectId.value

  if (workspaceId && baseId) {
    if (isFullScreen.value) isFullScreen.value = false

    ncNavigateTo({
      workspaceId,
      baseId,
      tableId: props.id,
      tableTitle: displayName.value,
    })
  }
}
</script>

<template>
  <ChatMarkdownMention :name="displayName" :clickable="!!id" @click="handleClick">
    <template #icon>
      <NcIconTable :table="iconMeta" class="flex-none w-4 h-4 !text-nc-content-gray-emphasis !hover:text-nc-content-gray" />
    </template>
  </ChatMarkdownMention>
</template>

<style lang="scss" scoped></style>
