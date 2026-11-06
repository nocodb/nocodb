<script setup lang="ts">
interface Props {
  message: string
  // Public form link; shown as "Open form" only when the view is shared.
  formUrl?: string
}

const props = defineProps<Props>()

const isPublic = inject(IsPublicInj, ref(false))

const isInterfaceUi = useIsInterfaceUi()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// Public pages and interface widgets have no views sidebar to switch from.
const canSwitchView = computed(() => !isPublic.value && !isInterfaceUi.value)

function openForm() {
  if (props.formUrl) window.open(props.formUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="nc-mobile-unsupported-view p-6 bg-nc-bg-default flex flex-col items-start gap-2">
    <div class="text-nc-content-gray text-lg font-semibold">
      {{ $t('labels.availableInDesktop') }}
    </div>
    <div class="text-nc-content-gray-muted text-sm">
      {{ message }}
    </div>
    <div v-if="formUrl || canSwitchView" class="flex flex-wrap gap-2 mt-2">
      <NcButton v-if="formUrl" type="primary" size="small" data-testid="nc-mobile-unsupported-open-form" @click="openForm">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="externalLink" class="h-4 w-4" />
          {{ $t('labels.openForm') }}
        </div>
      </NcButton>
      <NcButton
        v-if="canSwitchView"
        type="secondary"
        size="small"
        data-testid="nc-mobile-unsupported-switch-view"
        @click="isLeftSidebarOpen = true"
      >
        {{ $t('labels.switchView') }}
      </NcButton>
    </div>
  </div>
</template>
