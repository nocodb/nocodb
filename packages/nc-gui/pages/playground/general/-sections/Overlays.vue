<script setup lang="ts">
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'

const isDeleteOpen = ref(false)

const isModalOpen = ref(false)

const modalSize = ref<'small' | 'medium' | 'large'>('medium')

const isOverlayOpen = ref(false)

async function fakeDelete() {
  await new Promise((resolve) => setTimeout(resolve, 800))
  message.success('Deleted "Customers"')
}

function openModal(size: 'small' | 'medium' | 'large') {
  modalSize.value = size
  isModalOpen.value = true
}
</script>

<template>
  <PgSection id="modals" title="Modals" source="GeneralDeleteModal · GeneralModal">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="DeleteModal" hint="simulated 800ms delete">
        <NcButton size="small" type="danger" @click="isDeleteOpen = true">Delete table</NcButton>
        <GeneralDeleteModal v-model:visible="isDeleteOpen" entity-name="Table" :on-delete="fakeDelete">
          <template #entity-preview>
            <div class="flex items-center gap-2 px-3 py-2 bg-nc-bg-gray-extralight rounded-lg text-caption">
              <GeneralIcon icon="table" class="w-4 h-4" />
              Customers
            </div>
          </template>
        </GeneralDeleteModal>
      </PgDemo>
      <PgDemo label="GeneralModal" hint="legacy sizes">
        <div class="flex gap-2">
          <NcButton
            v-for="s in ['small', 'medium', 'large'] as const"
            :key="s"
            size="small"
            type="secondary"
            @click="openModal(s)"
          >
            {{ s }}
          </NcButton>
        </div>
        <GeneralModal v-model:visible="isModalOpen" :size="modalSize">
          <div class="p-6 flex flex-col gap-3">
            <div class="text-subHeading2 text-nc-content-gray-emphasis">GeneralModal · {{ modalSize }}</div>
            <p class="text-body text-nc-content-gray-subtle">
              Prefer NcModal for new work. This wrapper is kept for older dialogs.
            </p>
            <div class="flex justify-end">
              <NcButton size="small" @click="isModalOpen = false">Close</NcButton>
            </div>
          </div>
        </GeneralModal>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection
    id="overlay"
    title="Overlay"
    source="GeneralOverlay"
    description="Inline mode: absolute inside the nearest positioned parent. Esc closes it."
  >
    <PgDemo :padded="false">
      <div class="relative h-48 p-4">
        <NcButton size="small" type="secondary" @click="isOverlayOpen = true">Show overlay</NcButton>
        <GeneralOverlay
          v-model="isOverlayOpen"
          inline
          class="bg-nc-bg-default/80 backdrop-blur-sm flex items-center justify-center"
        >
          <div class="flex flex-col items-center gap-3">
            <GeneralLoader size="xlarge" class="text-nc-content-brand" />
            <NcButton size="small" type="secondary" @click="isOverlayOpen = false">Dismiss</NcButton>
          </div>
        </GeneralOverlay>
      </div>
    </PgDemo>
  </PgSection>

  <PgSection id="flipping-card" title="Flipping card" source="GeneralFlippingCard">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="Click to flip">
        <GeneralFlippingCard class="h-32 w-full" :triggers="['click']">
          <template #front>
            <div class="h-full rounded-xl bg-nc-bg-brand flex items-center justify-center text-captionBold text-nc-content-brand">
              Front — click me
            </div>
          </template>
          <template #back>
            <div
              class="h-full rounded-xl bg-nc-bg-coloured-purple flex items-center justify-center text-captionBold text-nc-content-purple-dark"
            >
              Back
            </div>
          </template>
        </GeneralFlippingCard>
      </PgDemo>
      <PgDemo label="Auto flip every 2.5s" hint="pauses on hover">
        <GeneralFlippingCard class="h-32 w-full" :triggers="[{ duration: 2500 }]">
          <template #front>
            <div
              class="h-full rounded-xl bg-nc-bg-coloured-green flex items-center justify-center text-captionBold text-nc-content-green-dark"
            >
              Tip 1 of 2
            </div>
          </template>
          <template #back>
            <div
              class="h-full rounded-xl bg-nc-bg-coloured-orange flex items-center justify-center text-captionBold text-nc-content-orange-dark"
            >
              Tip 2 of 2
            </div>
          </template>
        </GeneralFlippingCard>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection
    id="form-banner"
    title="Form banner"
    source="GeneralFormBanner · GeneralFormBranding"
    description="Default artwork when a form has no banner image, plus the form footer wordmark."
  >
    <PgDemo stage="canvas">
      <div class="max-w-2xl mx-auto">
        <GeneralFormBanner />
        <div class="flex justify-center mt-4"><GeneralFormBranding /></div>
      </div>
    </PgDemo>
  </PgSection>
</template>
