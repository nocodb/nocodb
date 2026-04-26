<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const route = useRoute()

const { resolvedProject } = storeToRefs(useBases())

const { open: openBaseTrash } = useBaseTrash()

const { isUIAllowed } = useRoles()

const visible = ref(false)

const canSeeBaseTrash = computed(() => isUIAllowed('baseTrashList'))

const canSeeSnapshots = computed(() => isUIAllowed('manageSnapshot'))

const showHistoryTrigger = computed(() => canSeeBaseTrash.value || canSeeSnapshots.value)

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
    placement="rightBottom"
    overlay-class-name="!min-w-55 nc-history-menu-dropdown"
    :align="{ offset: [0, 3] }"
  >
    <slot>
      <div v-e="['c:sidebar:history']" class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-history-btn">
        <div class="nc-mini-sidebar-btn" :class="{ active: visible }">
          <GeneralIcon icon="ncHistory" class="h-4 w-4 !stroke-transparent" />
        </div>
      </div>
    </slot>

    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItemLabel>
          <span class="normal-case">
            {{ $t('labels.history') }}
          </span>
        </NcMenuItemLabel>

        <PaymentUpgradeBadgeProvider v-if="canSeeSnapshots" :feature="PlanFeatureTypes.FEATURE_EE_CORE">
          <template #default="{ click }">
            <NcMenuItem
              data-testid="nc-sidebar-history-menu-snapshots"
              inner-class="w-full"
              @click="click(PlanFeatureTypes.FEATURE_EE_CORE, isEeUI ? openSnapshots : undefined)"
            >
              <div v-e="['c:sidebar:history-menu:snapshots']" class="flex gap-2 items-center w-full">
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
              data-testid="nc-sidebar-history-menu-trash"
              inner-class="w-full"
              @click="click(PlanFeatureTypes.FEATURE_EE_CORE, isEeUI ? onTrashClick : undefined)"
            >
              <div v-e="['c:sidebar:history-menu:trash']" class="flex gap-2 items-center w-full">
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
  <NcSpanHidden v-else />
</template>

<style lang="scss">
.nc-history-menu-dropdown.nc-history-menu-dropdown {
  overflow: visible !important;

  &::before {
    content: '';
    position: absolute;
    left: -6px;
    bottom: 13px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid var(--nc-border-gray-medium);
  }

  &::after {
    content: '';
    position: absolute;
    left: -5px;
    bottom: 14px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid var(--nc-bg-default);
  }
}
</style>
