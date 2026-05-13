<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const route = useRoute()

const { resolvedProject } = storeToRefs(useBases())

const { open: openBaseTrash } = useBaseTrash()

const { isUIAllowed } = useRoles()

const { undo, redo, isUndoRedoInFlight, inFlightDirection } = useUndoRedo()

const visible = ref(false)

const canSeeBaseTrash = computed(() => isUIAllowed('baseTrashList'))

const canSeeSnapshots = computed(() => isUIAllowed('manageSnapshot'))

const canSeeUndoRedo = computed(() => isUIAllowed('undo'))

const showHistoryTrigger = computed(() => canSeeBaseTrash.value || canSeeSnapshots.value || canSeeUndoRedo.value)

const cmdKey = renderCmdOrCtrlKey(true)

const shiftKey = isMac() ? '⇧' : 'Shift'

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

        <NcMenuItem
          v-if="canSeeUndoRedo"
          data-testid="nc-topbar-history-menu-undo"
          inner-class="w-full"
          :disabled="isUndoRedoInFlight"
          @click="undo"
        >
          <div v-e="['c:topbar:history-menu:undo']" class="flex gap-2 items-center w-full">
            <GeneralLoader v-if="inFlightDirection === 'undo'" class="h-4 w-4" />
            <GeneralIcon v-else icon="ncUndo" class="h-4 w-4 text-nc-content-gray-subtle2" />
            <div class="flex-1">{{ $t('labels.undo') }}</div>
            <span class="nc-shortcut-hint">{{ cmdKey }} Z</span>
          </div>
        </NcMenuItem>

        <NcMenuItem
          v-if="canSeeUndoRedo"
          data-testid="nc-topbar-history-menu-redo"
          inner-class="w-full"
          :disabled="isUndoRedoInFlight"
          @click="redo"
        >
          <div v-e="['c:topbar:history-menu:redo']" class="flex gap-2 items-center w-full">
            <GeneralLoader v-if="inFlightDirection === 'redo'" class="h-4 w-4" />
            <GeneralIcon v-else icon="ncRedo" class="h-4 w-4 text-nc-content-gray-subtle2" />
            <div class="flex-1">{{ $t('labels.redo') }}</div>
            <span class="nc-shortcut-hint">{{ cmdKey }} {{ shiftKey }} Z</span>
          </div>
        </NcMenuItem>

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
