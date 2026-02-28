<script lang="ts" setup>
import { PresencePageType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'

const { activeCollaborators, presenceEnabled, followingUserId, followedCollab, follow, unfollow } = usePresence()
const { isFeatureEnabled } = useBetaFeatureToggle()
const canTogglePresence = computed(() => isFeatureEnabled(FEATURE_FLAG.PRESENCE_VISIBILITY_TOGGLE))
const { baseTables } = storeToRefs(useTablesStore())
const { viewsByTable } = storeToRefs(useViewsStore())
const { dashboards } = storeToRefs(useDashboardStore())
const { activeBaseWorkflows } = storeToRefs(useWorkflowStore())
const { activeBaseScripts } = storeToRefs(useScriptStore())
const { baseId } = storeToRefs(useBase())
const { activeWorkspaceId } = storeToRefs(useWorkspace())
const { ncNavigateTo } = useGlobal()

const MAX_VISIBLE = 3
const MAX_TOOLTIP_NAMES = 10

const visibleCollaborators = computed(() => activeCollaborators.value.slice(0, MAX_VISIBLE))
const overflowCount = computed(() => Math.max(0, activeCollaborators.value.length - MAX_VISIBLE))
const overflowTooltipNames = computed(() => activeCollaborators.value.slice(MAX_VISIBLE, MAX_VISIBLE + MAX_TOOLTIP_NAMES))
const remainingAfterTooltip = computed(() => Math.max(0, activeCollaborators.value.length - MAX_VISIBLE - MAX_TOOLTIP_NAMES))

const toUserProp = (collab: (typeof activeCollaborators.value)[number]) => ({
  email: collab.email,
  display_name: collab.displayName,
  meta: collab.meta,
})

const tableNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const t of baseTables.value.get(baseId.value!) || []) {
    if (t.id && t.title) map.set(t.id, t.title)
  }
  return map
})

const getLocationLabel = (collab: (typeof activeCollaborators.value)[number]) => {
  if (collab.pageType === PresencePageType.DASHBOARD) {
    const name = dashboards.value
      .get(baseId.value!)
      ?.find((d) => d.id === collab.resourceId || d.uuid === collab.resourceId)?.title
    return name ? `Dashboard: ${name}` : 'A dashboard'
  }
  if (collab.pageType === PresencePageType.AUTOMATION) {
    const name = activeBaseWorkflows.value.find((w) => w.id === collab.resourceId)?.title
    return name ? `Automation: ${name}` : 'An automation'
  }
  if (collab.pageType === PresencePageType.SCRIPT) {
    const name = activeBaseScripts.value.find((s) => s.id === collab.resourceId)?.title
    return name ? `Script: ${name}` : 'A script'
  }
  const tableName = tableNameMap.value.get(collab.resourceId || '') || ''
  if (!tableName) return ''
  const views = viewsByTable.value.get(`${baseId.value}:${collab.resourceId}`) || []
  const viewName = views.find((v) => v.id === collab.viewId)?.title || ''
  return viewName ? `${tableName} › ${viewName}` : tableName
}

const navigateToCollaborator = (collab: (typeof activeCollaborators.value)[number]) => {
  if (collab.pageType === PresencePageType.DASHBOARD) {
    if (!collab.resourceId) return
    const baseDashboards = dashboards.value.get(baseId.value!) || []
    if (!baseDashboards.find((d) => d.id === collab.resourceId || d.uuid === collab.resourceId)) {
      message.info("You don't have access to this dashboard")
      return
    }
    ncNavigateTo({ workspaceId: activeWorkspaceId.value, baseId: baseId.value, dashboardId: collab.resourceId })
    return
  }

  if (collab.pageType === PresencePageType.AUTOMATION) {
    if (!collab.resourceId) return
    if (!activeBaseWorkflows.value.find((w) => w.id === collab.resourceId)) {
      message.info("You don't have access to this automation")
      return
    }
    ncNavigateTo({ workspaceId: activeWorkspaceId.value, baseId: baseId.value, workflowId: collab.resourceId })
    return
  }

  if (collab.pageType === PresencePageType.SCRIPT) {
    if (!collab.resourceId) return
    if (!activeBaseScripts.value.find((s) => s.id === collab.resourceId)) {
      message.info("You don't have access to this script")
      return
    }
    ncNavigateTo({ workspaceId: activeWorkspaceId.value, baseId: baseId.value, scriptId: collab.resourceId })
    return
  }

  if (!collab.resourceId) return
  const tables = baseTables.value.get(baseId.value!) || []
  if (!tables.find((t) => t.id === collab.resourceId)) {
    message.info("You don't have access to this table")
    return
  }
  ncNavigateTo({ workspaceId: activeWorkspaceId.value, baseId: baseId.value, tableId: collab.resourceId, viewId: collab.viewId })
}

const hasAccess = (collab: (typeof activeCollaborators.value)[number]) => {
  if (!collab.resourceId) return false
  if (collab.pageType === PresencePageType.DASHBOARD) {
    return !!dashboards.value.get(baseId.value!)?.find((d) => d.id === collab.resourceId || d.uuid === collab.resourceId)
  }
  if (collab.pageType === PresencePageType.AUTOMATION) {
    return !!activeBaseWorkflows.value.find((w) => w.id === collab.resourceId)
  }
  if (collab.pageType === PresencePageType.SCRIPT) {
    return !!activeBaseScripts.value.find((s) => s.id === collab.resourceId)
  }
  return !!(baseTables.value.get(baseId.value!) || []).find((t) => t.id === collab.resourceId)
}

const toggleFollow = (collab: (typeof activeCollaborators.value)[number]) => {
  if (followingUserId.value === collab.userId) {
    unfollow()
  } else {
    follow(collab.userId)
    navigateToCollaborator(collab)
  }
}

watch(followedCollab, (collab) => {
  if (!collab || !hasAccess(collab)) return
  navigateToCollaborator(collab)
})
</script>

<template>
  <div
    v-if="isEeUI && (activeCollaborators.length || canTogglePresence)"
    role="group"
    class="nc-presence-group flex items-center gap-1 pl-1 mr-0.5 border-r-1 border-nc-border-gray-medium pr-2.5"
  >
    <div v-if="presenceEnabled && activeCollaborators.length" class="flex items-center -space-x-1.5">
      <NcTooltip
        v-for="(collab, index) in visibleCollaborators"
        :key="collab.userId"
        class="nc-presence-avatar"
        :style="{ zIndex: MAX_VISIBLE - index }"
      >
        <template #title>
          <div class="flex flex-col gap-1 min-w-28">
            <div class="text-bodySm capitalize">{{ extractUserDisplayNameOrEmail(toUserProp(collab)) }}</div>
            <div v-if="getLocationLabel(collab)" class="text-[10px] text-gray-400 leading-tight">
              {{ getLocationLabel(collab) }}
            </div>
            <div class="flex items-center gap-1 mt-0.5">
              <NcButton
                size="xsmall"
                type="text"
                class="!h-5 !px-1.5 !text-[10px] nc-presence-btn"
                @click="navigateToCollaborator(collab)"
              >
                Go there
              </NcButton>
              <NcButton
                size="xsmall"
                :type="followingUserId === collab.userId ? 'primary' : 'text'"
                class="!h-5 !px-1.5 !text-[10px] nc-presence-follow-btn"
                @click="toggleFollow(collab)"
              >
                {{ followingUserId === collab.userId ? 'Following' : 'Follow' }}
              </NcButton>
            </div>
          </div>
        </template>
        <GeneralUserIcon
          :user="toUserProp(collab)"
          size="medium"
          class="ring-2 cursor-pointer"
          :class="{ 'ring-offset-1': followingUserId === collab.userId }"
          :style="{ '--tw-ring-color': collab.color }"
          :aria-label="`${collab.displayName} is in this base`"
          tabindex="0"
          @click="navigateToCollaborator(collab)"
          @keydown.enter="navigateToCollaborator(collab)"
        />
      </NcTooltip>

      <NcTooltip v-if="overflowCount > 0" class="nc-presence-avatar" :style="{ zIndex: 0 }">
        <template #title>
          <div class="text-xs space-y-0.5 max-w-48">
            <div v-for="collab in overflowTooltipNames" :key="collab.userId" class="truncate">
              {{ collab.displayName }}
              <span v-if="getLocationLabel(collab)" class="text-gray-400"> · {{ getLocationLabel(collab) }} </span>
            </div>
            <div v-if="remainingAfterTooltip > 0" class="text-gray-400">and {{ remainingAfterTooltip }} more</div>
          </div>
        </template>
        <div
          class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ring-2 ring-nc-border-gray-medium cursor-default select-none bg-nc-bg-gray-dark text-nc-content-gray-subtle"
          :aria-label="`${overflowCount} more collaborator${overflowCount === 1 ? '' : 's'}`"
          tabindex="0"
        >
          +{{ overflowCount }}
        </div>
      </NcTooltip>
    </div>
    <NcTooltip v-if="canTogglePresence">
      <template #title>
        {{ presenceEnabled ? 'Hide my presence' : 'Show my presence' }}
      </template>
      <NcButton
        size="xsmall"
        type="text"
        class="!w-6 !h-6 !p-0"
        :aria-label="presenceEnabled ? 'Hide my presence' : 'Show my presence'"
        @click="presenceEnabled = !presenceEnabled"
      >
        <GeneralIcon :icon="presenceEnabled ? 'ncEye' : 'ncEyeOff'" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style scoped>
.nc-presence-avatar {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.nc-presence-group {
  transition: width 0.2s ease, opacity 0.2s ease;
}

.nc-presence-btn:not(:hover) {
  color: var(--nc-content-inverted-primary) !important;
}

.nc-presence-follow-btn:not(:hover) {
  color: var(--nc-content-inverted-primary) !important;
}
</style>
