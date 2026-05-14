<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const route = useRoute()

const { resolvedProject } = storeToRefs(useBases())

const { open: openBaseTrash } = useBaseTrash()

const { isUIAllowed } = useRoles()

const { undo, redo, isUndoRedoInFlight, inFlightDirection, isDisabledByEnv } = useUndoRedo()

const visible = ref(false)

const canSeeBaseTrash = computed(() => isUIAllowed('baseTrashList'))

const canSeeSnapshots = computed(() => isUIAllowed('manageSnapshot'))

const canSeeUndoRedo = computed(() => isUIAllowed('undo'))

const showHistoryTrigger = computed(() => canSeeBaseTrash.value || canSeeSnapshots.value || canSeeUndoRedo.value)

const cmdKey = renderCmdOrCtrlKey(true)

const shiftKey = isMac() ? '⇧' : 'Shift'

const undoRedoActions = [
  {
    direction: 'undo' as const,
    icon: 'ncUndo',
    labelKey: 'labels.undo',
    shortcut: `${cmdKey} Z`,
    handler: undo,
  },
  {
    direction: 'redo' as const,
    icon: 'ncRedo',
    labelKey: 'labels.redo',
    shortcut: `${cmdKey} ${shiftKey} Z`,
    handler: redo,
  },
]

function openSnapshots() {
  const baseId = resolvedProject.value?.id
  const wsId = route.params.typeOrId
  if (!baseId || !wsId) return
  visible.value = false
  navigateTo(`/${wsId}/${baseId}/settings/snapshots`)
}

function onTrashClick() {
  visible.value = false
  openBaseTrash()
}
</script>

<template>
  <NcDropdown
    v-if="showHistoryTrigger"
    v-model:visible="visible"
    placement="bottomRight"
    overlay-class-name="!min-w-55"
    :align="{ offset: [0, 6] }"
  >
    <NcTooltip placement="bottom" :disabled="visible">
      <template #title>{{ $t('labels.history') }}</template>
      <NcButton
        v-e="['c:topbar:history']"
        type="text"
        size="small"
        class="nc-topbar-history-btn"
        :class="{ '!bg-nc-bg-brand !text-nc-content-brand': visible }"
        data-testid="nc-topbar-history-btn"
      >
        <GeneralIcon icon="ncHistory" class="w-4 h-4 !stroke-transparent" />
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItemLabel>
          <span class="normal-case">
            {{ $t('labels.history') }}
          </span>
        </NcMenuItemLabel>

        <NcTooltip v-if="canSeeUndoRedo" placement="left" :disabled="!isDisabledByEnv">
          <template #title>{{ $t('labels.undoRedoDisabledByAdmin') }}</template>
          <NcMenuItem
            v-for="action in undoRedoActions"
            :key="action.direction"
            :data-testid="`nc-topbar-history-menu-${action.direction}`"
            inner-class="w-full"
            :disabled="isDisabledByEnv || isUndoRedoInFlight"
            @click="action.handler"
          >
            <div v-e="[`c:topbar:history-menu:${action.direction}`]" class="flex gap-2 items-center w-full">
              <GeneralLoader v-if="inFlightDirection === action.direction" class="h-4 w-4" />
              <GeneralIcon v-else :icon="action.icon" class="h-4 w-4 text-nc-content-gray-subtle2" />
              <div class="flex-1">{{ $t(action.labelKey) }}</div>
              <span class="nc-shortcut-hint">{{ action.shortcut }}</span>
            </div>
          </NcMenuItem>
        </NcTooltip>

        <PaymentUpgradeBadgeProvider v-if="canSeeSnapshots" :feature="PlanFeatureTypes.FEATURE_EE_CORE">
          <template #default="{ click }">
            <NcMenuItem
              data-testid="nc-topbar-history-menu-snapshots"
              inner-class="w-full"
              @click="click(PlanFeatureTypes.FEATURE_EE_CORE, isEeUI ? openSnapshots : undefined)"
            >
              <div v-e="['c:topbar:history-menu:snapshots']" class="flex gap-2 items-center w-full">
                <GeneralIcon icon="camera" class="h-4 w-4 text-nc-content-gray-subtle2" />
                <div class="flex-1">{{ $t('labels.snapshots') }}</div>
                <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_EE_CORE" show-as-lock />
              </div>
            </NcMenuItem>
          </template>
        </PaymentUpgradeBadgeProvider>

        <PaymentUpgradeBadgeProvider v-if="canSeeBaseTrash" :feature="PlanFeatureTypes.FEATURE_EE_CORE">
          <template #default="{ click }">
            <NcMenuItem
              data-testid="nc-topbar-history-menu-trash"
              inner-class="w-full"
              @click="click(PlanFeatureTypes.FEATURE_EE_CORE, isEeUI ? onTrashClick : undefined)"
            >
              <div v-e="['c:topbar:history-menu:trash']" class="flex gap-2 items-center w-full">
                <GeneralIcon icon="ncTrash2" class="h-4 w-4 text-nc-content-gray-subtle2" />
                <div class="flex-1">{{ $t('title.baseTrash') }}</div>
                <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_EE_CORE" show-as-lock />
              </div>
            </NcMenuItem>
          </template>
        </PaymentUpgradeBadgeProvider>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
.nc-shortcut-hint {
  @apply text-nc-content-gray-muted text-bodySm tracking-wide;
}
</style>
