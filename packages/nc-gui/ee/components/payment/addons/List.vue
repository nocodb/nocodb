<script lang="ts" setup>
const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value) : _activeWorkspace.value,
)

const addons = computed(() => (activeWorkspace.value?.payment?.addons ?? []).filter((a) => a.status === 'active'))
</script>

<template>
  <div v-if="addons.length" class="nc-billing-addons flex flex-col gap-2">
    <div class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('objects.addons') }}</div>
    <div
      v-for="addon in addons"
      :key="addon.addon_key"
      class="nc-billing-addon-row flex items-center gap-2 text-bodyDefault text-nc-content-gray"
    >
      <GeneralIcon icon="ncCheck" class="w-4 h-4 text-nc-content-green-dark" />
      <span>{{ getAddonLabel(addon.addon_key) }}</span>
    </div>
  </div>
</template>
