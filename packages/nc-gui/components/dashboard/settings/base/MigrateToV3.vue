<script setup lang="ts">
import { BaseVersion } from 'nocodb-sdk'

const { t } = useI18n()
const { $api } = useNuxtApp()

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const route = useRoute()

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const isLoading = ref(false)
const isModalVisible = ref(false)

const changes = computed(() => [
  t('msg.migrateToV3.changeDuplicate'),
  t('msg.migrateToV3.changeApi'),
  t('msg.migrateToV3.changeScale'),
])

const considerations = computed(() => [t('msg.migrateToV3.considerApis'), t('msg.migrateToV3.considerPermanent')])

const migrateToV3 = async () => {
  if (!baseId.value) return

  isLoading.value = true
  try {
    await $api.base.update(baseId.value, {
      version: BaseVersion.V3,
    })

    message.toast(t('msg.success.baseUpgradedToV3'))

    await basesStore.loadProject(baseId.value, true)

    isModalVisible.value = false

    // The row that brought us here is gone once the base is on v3.
    const query = { ...route.query, settings: 'base-type' }
    delete query.tab
    await navigateTo({ query })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <!-- Title and description live in the shell header. -->
  <div
    data-testid="nc-settings-subtab-migrate-to-v3"
    class="flex flex-col h-full px-20 pb-6 pt-3 overflow-auto nc-scrollbar-thin"
  >
    <div class="flex flex-col w-full max-w-3xl gap-6">
      <div class="flex flex-col border-1 rounded-lg border-nc-border-gray-medium">
        <div class="flex flex-col gap-2 px-3 py-3">
          <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-emphasis">
            {{ $t('msg.migrateToV3.whatChanges') }}
          </div>
          <ul class="m-0 pl-5 flex flex-col gap-1.5 text-bodyDefaultSm text-nc-content-gray-subtle2">
            <li v-for="line in changes" :key="line">{{ line }}</li>
          </ul>
        </div>

        <div class="flex flex-col gap-2 px-3 py-3 border-t-1 border-nc-border-gray-medium">
          <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-emphasis">
            {{ $t('msg.migrateToV3.considerations') }}
          </div>
          <ul class="m-0 pl-5 flex flex-col gap-1.5 text-bodyDefaultSm text-nc-content-gray-subtle2">
            <li v-for="line in considerations" :key="line">{{ line }}</li>
          </ul>
        </div>
      </div>

      <NcAlert type="warning" show-icon :message="$t('msg.migrateToV3.recommendation')" />

      <div>
        <NcButton size="small" type="primary" data-testid="nc-migrate-to-v3-button" @click="isModalVisible = true">
          {{ $t('labels.migrateToV3') }}
        </NcButton>
      </div>
    </div>

    <GeneralModal v-model:visible="isModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="mb-4 text-lg font-semibold text-nc-content-gray-emphasis">
          {{ $t('labels.migrateToV3') }}
        </div>

        <div class="mb-1 text-bodyDefaultSm font-medium text-nc-content-gray-emphasis">
          {{ $t('msg.migrateToV3.confirmTitle') }}
        </div>

        <div class="mb-4 text-bodyDefaultSm text-nc-content-gray-subtle2">
          {{ $t('msg.migrateToV3.confirmDesc') }}
        </div>

        <div class="flex flex-col gap-2 mb-4">
          <div v-for="line in considerations" :key="line" class="flex items-start gap-2">
            <GeneralIcon icon="alertTriangle" class="flex-none text-nc-content-orange-medium mt-0.5 w-4 h-4" />
            <span class="text-bodyDefaultSm text-nc-content-gray">{{ line }}</span>
          </div>
        </div>

        <div class="flex gap-2 pt-4 border-t-1 border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isModalVisible = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            type="primary"
            size="small"
            :loading="isLoading"
            data-testid="nc-migrate-to-v3-confirm-btn"
            @click="migrateToV3"
          >
            {{ $t('msg.migrateToV3.confirmCta') }}
            <template #loading>{{ $t('msg.migrateToV3.migrating') }}</template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
