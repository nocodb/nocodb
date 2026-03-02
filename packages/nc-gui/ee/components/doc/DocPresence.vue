<script lang="ts" setup>
import { PresencePageType } from 'nocodb-sdk'

const { activeCollaborators, presenceEnabled } = usePresence()
const { isFeatureEnabled } = useBetaFeatureToggle()

const canTogglePresence = computed(() => isFeatureEnabled(FEATURE_FLAG.PRESENCE_VISIBILITY_TOGGLE))

const { baseTables } = storeToRefs(useTablesStore())
const { viewsByTable } = storeToRefs(useViewsStore())
const { dashboards } = storeToRefs(useDashboardStore())
const { activeBaseWorkflows } = storeToRefs(useWorkflowStore())
const { activeBaseScripts } = storeToRefs(useScriptStore())
const { documents } = storeToRefs(useDocumentsStore())
const { baseId } = storeToRefs(useBase())

const MAX_VISIBLE = 3
const MAX_TOOLTIP_NAMES = 10

const visibleCollaborators = computed(() => activeCollaborators.value.slice(0, MAX_VISIBLE))
const overflowCount = computed(() => Math.max(0, activeCollaborators.value.length - MAX_VISIBLE))
const overflowTooltipNames = computed(() => activeCollaborators.value.slice(MAX_VISIBLE, MAX_VISIBLE + MAX_TOOLTIP_NAMES))
const remainingAfterTooltip = computed(() => Math.max(0, activeCollaborators.value.length - MAX_VISIBLE - MAX_TOOLTIP_NAMES))

const toUserProp = (collab: (typeof activeCollaborators.value)[number]) => ({
  email: collab.email,
  display_name: collab.display_name,
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
  if (collab.pageType === PresencePageType.DOCUMENT) {
    const allDocs = documents.value.get(baseId.value!) || []
    const doc = allDocs.find((d) => d.id === collab.resourceId)
    return doc?.title ? `Doc: ${doc.title}` : 'A document'
  }
  const tableName = tableNameMap.value.get(collab.resourceId || '') || ''
  if (!tableName) return ''
  const views = viewsByTable.value.get(`${baseId.value}:${collab.resourceId}`) || []
  const viewName = views.find((v) => v.id === collab.viewId)?.title || ''
  return viewName ? `${tableName} › ${viewName}` : tableName
}
</script>

<template>
  <div
    v-if="isEeUI && (activeCollaborators.length || canTogglePresence)"
    role="group"
    class="nc-doc-presence flex items-center gap-1"
  >
    <div v-if="presenceEnabled && activeCollaborators.length" class="flex items-center -space-x-1.5">
      <NcTooltip
        v-for="(collab, index) in visibleCollaborators"
        :key="collab.userId"
        class="nc-doc-presence-avatar"
        :style="{ zIndex: MAX_VISIBLE - index }"
      >
        <template #title>
          <div class="flex flex-col gap-0.5 min-w-24">
            <div class="text-bodySm capitalize">{{ extractUserDisplayNameOrEmail(toUserProp(collab)) }}</div>
            <div v-if="getLocationLabel(collab)" class="text-[10px] text-gray-400 leading-tight">
              {{ getLocationLabel(collab) }}
            </div>
          </div>
        </template>
        <GeneralUserIcon
          :user="toUserProp(collab)"
          size="medium"
          class="ring-2 cursor-default"
          :style="{ '--tw-ring-color': collab.color }"
          :aria-label="`${collab.display_name} is in this base`"
          tabindex="0"
        />
      </NcTooltip>

      <NcTooltip v-if="overflowCount > 0" class="nc-doc-presence-avatar" :style="{ zIndex: 0 }">
        <template #title>
          <div class="text-xs space-y-0.5 max-w-48">
            <div v-for="collab in overflowTooltipNames" :key="collab.userId" class="truncate">
              {{ collab.display_name }}
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
        v-e="['c:doc:presence:visibility:toggle']"
        @click="presenceEnabled = !presenceEnabled"
      >
        <GeneralIcon :icon="presenceEnabled ? 'ncEye' : 'ncEyeOff'" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style scoped>
.nc-doc-presence-avatar {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.nc-doc-presence {
  transition: width 0.2s ease, opacity 0.2s ease;
}
</style>
