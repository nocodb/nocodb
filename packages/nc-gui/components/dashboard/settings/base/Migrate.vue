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
  await basesStore.loadProject(baseId.value!, true)
})
</script>

<template>
  <div data-testid="nc-settings-subtab-visibility" class="item-card flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">Migrate Data To NocoDB</div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">Easily migrate your data to NocoDB Cloud</div>

    <div class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium">
      <div class="flex w-full px-3 py-2 gap-2 flex-col">
        <div class="flex flex-col w-full gap-1">
          <a-form ref="form" name="quick-migrate-form" layout="horizontal" class="m-0">
            <a-form-item class="!m-0">
              <div class="flex items-end">
                <label> Migration URL </label>
              </div>
              <a-input
                v-model:value="migrateConfiguration.migrationUrl"
                placeholder="Enter migration URL for destination"
                class="!rounded-lg !my-2 nc-input-api-key"
              />
            </a-form-item>
          </a-form>

          <NcButton type="primary" :loading="migrating" :disabled="!migrateConfiguration.migrationUrl" @click="migrateData">
            Migrate
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>
