<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'

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

const { activeProjectId } = storeToRefs(useBases())

const dashboardStore = useDashboardStore()

const resolvedDashboard = computed(() => {
  if (!props.id || !activeProjectId.value) return undefined

  const baseDashboards = dashboardStore.dashboards.get(activeProjectId.value)
  return baseDashboards?.find((d) => d.id === props.id)
})

const displayName = computed(() => resolvedDashboard.value?.title || props.name)

const iconMeta = computed<DashboardType>(() => {
  if (resolvedDashboard.value) return resolvedDashboard.value
  return { title: props.name } as DashboardType
})

const { $e } = useNuxtApp()

const handleClick = () => {
  if (!props.id) return
  $e('c:chat:mention:dashboard')

  if (!resolvedDashboard.value) {
    message.info(`Dashboard "${displayName.value}" no longer exists`)
    return
  }

  const workspaceId = activeWorkspaceId.value
  const baseId = activeProjectId.value

  if (workspaceId && baseId) {
    if (isFullScreen.value) isFullScreen.value = false

    ncNavigateTo({
      workspaceId,
      baseId,
      dashboardId: props.id,
      dashboardTitle: displayName.value,
    })
  }
}
</script>

<template>
  <ChatMarkdownMention :name="displayName" :clickable="!!id" @click="handleClick">
    <template #icon>
      <NcIconDashboard :dashboard="iconMeta" class="flex-none w-4 h-4" />
    </template>
  </ChatMarkdownMention>
</template>

<style lang="scss" scoped></style>
