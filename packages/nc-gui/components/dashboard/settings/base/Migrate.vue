<script setup lang="ts">
const { $state, $api } = useNuxtApp()

const baseURL = $api.instance.defaults.baseURL

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const migrateConfiguration = ref<{
  migrationUrl?: string
}>({
  migrationUrl: undefined,
})

const migrating = ref(false)

async function migrateData() {
  migrating.value = true
  try {
    const res = await $fetch(`/api/v2/meta/migrate/${baseId.value}`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: migrateConfiguration.value,
    })

    if (res?.msg) {
      message.info(res.msg)
    }
  } catch (e) {
    message.error(e.message)
  } finally {
    migrating.value = false
  }
}

onMounted(async () => {
  try {
    await basesStore.loadProject(baseId.value!, true)
  } catch (e: any) {
    // ignore
  }
})
</script>

<template>
  <!-- Title and description live in the shell header. -->
  <div
    data-testid="nc-settings-subtab-migrate"
    class="flex flex-col h-full nc-shell-gutter pb-6 pt-3 overflow-auto nc-scrollbar-thin"
  >
    <div class="flex flex-col w-full max-w-3xl gap-6">
      <!-- No card: it would be a box around a single field. -->
      <div class="flex flex-col gap-1.5">
        <label class="text-bodyDefaultSm font-medium text-nc-content-gray">{{ $t('labels.migrationUrl') }}</label>
        <a-input
          v-model:value="migrateConfiguration.migrationUrl"
          class="nc-input-sm !rounded-lg nc-input-api-key"
          :placeholder="$t('placeholder.migrationUrl')"
          @press-enter="migrateConfiguration.migrationUrl && migrateData()"
        />
        <div class="text-bodySm text-nc-content-gray-muted">{{ $t('labels.migrationUrlHint') }}</div>
      </div>

      <div>
        <NcButton
          type="primary"
          size="small"
          :loading="migrating"
          :disabled="!migrateConfiguration.migrationUrl"
          data-testid="nc-migrate-btn"
          @click="migrateData"
        >
          {{ $t('general.migrate') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
