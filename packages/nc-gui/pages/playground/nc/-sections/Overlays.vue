<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

type ModalSize = keyof typeof modalSizes | 'small' | 'medium' | 'large'

type ConfirmType = 'error' | 'success' | 'warning' | 'info'

const MODAL_SIZES: ModalSize[] = ['xs', 'sm', 'md', 'lg', 'xl', 'feature', 'fullscreen']

const LEGACY_SIZES: ModalSize[] = ['small', 'medium', 'large']

const CONFIRM_TYPES: ConfirmType[] = ['info', 'success', 'warning', 'error']

const DRAWER_PLACEMENTS = ['bottom', 'right', 'left', 'top'] as const

const { showInfoModal, showSuccessModal, showWarningModal, showErrorModal } = useNcConfirmModal()

const activeModalSize = ref<ModalSize | null>(null)

const activeConfirmType = ref<ConfirmType | null>(null)

const activeDrawer = ref<(typeof DRAWER_PLACEMENTS)[number] | null>(null)

const isPopoverOpen = ref(false)

const isModalOpen = computed({
  get: () => !!activeModalSize.value,
  set: (v: boolean) => {
    if (!v) activeModalSize.value = null
  },
})

const isConfirmOpen = computed({
  get: () => !!activeConfirmType.value,
  set: (v: boolean) => {
    if (!v) activeConfirmType.value = null
  },
})

const isDrawerOpen = computed({
  get: () => !!activeDrawer.value,
  set: (v: boolean) => {
    if (!v) activeDrawer.value = null
  },
})

const CONFIRM_COPY: Record<ConfirmType, { title: string; content: string; okText: string }> = {
  info: { title: 'New version available', content: 'Reload to get the latest improvements.', okText: 'Reload' },
  success: { title: 'Import complete', content: '1,248 records were imported into Campaigns.', okText: 'View table' },
  warning: {
    title: 'Delete field?',
    content: 'Budget will be removed from every view. This cannot be undone.',
    okText: 'Delete',
  },
  error: { title: 'Sync failed', content: 'The Postgres connection timed out after 30 seconds.', okText: 'Retry' },
}

function openComposableModal(type: ConfirmType) {
  const props = { ...CONFIRM_COPY[type], showCancelBtn: true, okCallback: () => message.success(`${type} confirmed`) }
  if (type === 'info') showInfoModal(props)
  else if (type === 'success') showSuccessModal(props)
  else if (type === 'warning') showWarningModal(props)
  else showErrorModal(props)
}
</script>

<template>
  <PgSection
    id="overlays"
    title="Modals, drawers & popovers"
    source="NcModal · NcModalConfirm · useNcConfirmModal · NcDrawer · NcPopover"
  >
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="NcModal" hint="modalSizes + legacy sizes">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <NcButton v-for="size in MODAL_SIZES" :key="size" size="small" type="secondary" @click="activeModalSize = size">
              {{ size }}
            </NcButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <NcButton v-for="size in LEGACY_SIZES" :key="size" size="small" type="text" @click="activeModalSize = size">
              {{ size }} (legacy)
            </NcButton>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcModalConfirm" hint="component + useNcConfirmModal()">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <NcButton v-for="t in CONFIRM_TYPES" :key="t" size="small" type="secondary" @click="activeConfirmType = t">
              {{ t }}
            </NcButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <NcButton v-for="t in CONFIRM_TYPES" :key="t" size="small" type="text" @click="openComposableModal(t)">
              show{{ t.charAt(0).toUpperCase() + t.slice(1) }}Modal
            </NcButton>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcDrawer" hint="placements">
        <div class="flex flex-wrap gap-2">
          <NcButton v-for="p in DRAWER_PLACEMENTS" :key="p" size="small" type="secondary" @click="activeDrawer = p">{{
            p
          }}</NcButton>
        </div>
      </PgDemo>

      <PgDemo label="NcPopover">
        <NcPopover v-model="isPopoverOpen" placement="bottom" width="280px">
          <template #trigger="{ open }">
            <NcButton size="small" type="secondary" @click="open">Open popover</NcButton>
          </template>
          <template #content="{ close }">
            <div class="p-4 flex flex-col gap-2">
              <div class="text-captionBold">Invite teammates</div>
              <div class="text-captionSm text-nc-content-gray-subtle">They'll get editor access to this base.</div>
              <NcButton size="small" @click="close">Got it</NcButton>
            </div>
          </template>
        </NcPopover>
      </PgDemo>
    </div>

    <NcModal v-model:visible="isModalOpen" :size="activeModalSize ?? 'md'">
      <template #header>
        <div class="flex items-center gap-2 w-full">
          <GeneralIcon icon="table" class="w-5 h-5" />
          <span class="text-subHeading2">Create table</span>
          <code class="ml-auto text-captionXs text-nc-content-gray-muted">size="{{ activeModalSize }}"</code>
        </div>
      </template>
      <div class="flex flex-col gap-3 py-4">
        <a-input class="nc-input-sm nc-input-shadow" placeholder="Table name" />
        <a-textarea class="nc-input-sm nc-input-shadow" :rows="3" placeholder="Description (optional)" />
        <div class="flex justify-end gap-2">
          <NcButton size="small" type="secondary" @click="isModalOpen = false">Cancel</NcButton>
          <NcButton size="small" @click="isModalOpen = false">Create table</NcButton>
        </div>
      </div>
    </NcModal>

    <NcModalConfirm
      v-if="activeConfirmType"
      v-model:visible="isConfirmOpen"
      :type="activeConfirmType"
      :title="CONFIRM_COPY[activeConfirmType].title"
      :content="CONFIRM_COPY[activeConfirmType].content"
      :ok-text="CONFIRM_COPY[activeConfirmType].okText"
      @ok="isConfirmOpen = false"
      @cancel="isConfirmOpen = false"
    />

    <NcDrawer v-model:visible="isDrawerOpen" :placement="activeDrawer ?? 'bottom'" title="Record details" closable>
      <div class="p-4 flex flex-col gap-3">
        <div class="text-caption text-nc-content-gray-subtle">placement="{{ activeDrawer }}"</div>
        <a-input class="nc-input-sm nc-input-shadow" value="Spring launch campaign" />
        <NcButton size="small" @click="isDrawerOpen = false">Close</NcButton>
      </div>
    </NcDrawer>
  </PgSection>
</template>
