<script lang="ts" setup>
import type { ViewPageType } from '~/lib/types'

const { onViewsTabChange } = useViewsStore()

const { openedViewsTab } = storeToRefs(useViewsStore())

const isPublic = inject(IsPublicInj, ref(false))

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const { toolGroups } = useTableToolsNav()

const { isPanelExpanded: isExtensionPanelExpanded } = useExtensions()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { blockExtensions, showUpgradeToUseExtensions, communityMode } = useEeConfig()

// Hidden on public/shared views (no schema editing) and on mobile, matching the
// old Data | Details toggle's gating. Mounted across the grid/gallery/kanban/
// calendar/list toolbar plus the timeline/gantt toolbars, so the gate lives here.
const isVisible = computed(() => !isPublic.value && !isSharedBase.value && !isMobileMode.value)

const isShellOpen = computed(() => openedViewsTab.value !== 'view')

const isDropdownOpen = ref(false)

const visibleGroups = computed(() => toolGroups.value.filter((group) => group.items.length))

// Opens the side panel, not a shell tool.
const showExtensions = computed(() => (isEeUI || isFeatureEnabled(FEATURE_FLAG.EXTENSIONS)) && !communityMode.value)

function openTool(slug: string) {
  isDropdownOpen.value = false
  onViewsTabChange(slug as ViewPageType)
}

function openExtensions() {
  isDropdownOpen.value = false

  if (blockExtensions.value) {
    showUpgradeToUseExtensions({ triggerSource: 'toolbar-extensions' })
    return
  }

  isExtensionPanelExpanded.value = true
}
</script>

<template>
  <NcDropdown
    v-if="isVisible"
    v-model:visible="isDropdownOpen"
    placement="bottomRight"
    overlay-class-name="nc-table-tools-dropdown"
  >
    <NcTooltip :title="$t('general.tools')" placement="bottom" :disabled="isDropdownOpen">
      <NcButton
        v-e="['c:table:tools']"
        class="nc-table-tools-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="text"
        data-testid="nc-table-tools-btn"
        :class="{ '!bg-nc-bg-gray-medium': isShellOpen || isDropdownOpen }"
      >
        <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <NcMenu variant="small" class="!min-w-56" data-testid="nc-table-tools-menu">
        <template v-for="(group, index) in visibleGroups" :key="group.label">
          <NcDivider v-if="index > 0" />
          <NcMenuItemLabel class="!text-[10px] tracking-wide">{{ group.label }}</NcMenuItemLabel>
          <NcMenuItem
            v-for="item in group.items"
            :key="item.slug"
            v-e="[`c:table:tools-shell:${item.ev ?? item.slug}`]"
            :data-testid="`nc-table-tools-menu-${item.slug}`"
            @click="openTool(item.slug)"
          >
            <GeneralIcon :icon="item.icon" class="!h-4 !w-4" />
            {{ item.title }}
          </NcMenuItem>
          <!-- Extensions closes the last (Developer) section. -->
          <NcMenuItem
            v-if="showExtensions && index === visibleGroups.length - 1"
            v-e="['c:extension-toggle']"
            data-testid="nc-table-tools-menu-extensions"
            @click="openExtensions"
          >
            <GeneralIcon icon="ncPuzzleOutline" class="!h-4 !w-4 !stroke-transparent" />
            {{ $t('general.extensions') }}
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>
