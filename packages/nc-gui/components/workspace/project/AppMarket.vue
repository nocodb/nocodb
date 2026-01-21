<script lang="ts" setup>
interface SandboxType {
  id: string
  title: string
  description?: string
  category?: string
  version?: string
  install_count?: number
}

interface Props {
  workspaceId: string
}

const props = defineProps<Props>()

const emit = defineEmits(['close', 'installed'])

const { $api } = useNuxtApp()
const { t } = useI18n()

const visible = ref(true)
const sandboxes = ref<SandboxType[]>([])
const loading = ref(false)
const installing = ref<string | null>(null)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)

// Watch visible to emit close when modal is closed by clicking outside
watch(visible, (newVal) => {
  if (!newVal) {
    emit('close')
  }
})

const categories = computed(() => {
  const cats = new Set<string>()
  sandboxes.value.forEach((sb) => {
    if (sb.category) cats.add(sb.category)
  })
  return Array.from(cats).sort()
})

const filteredSandboxes = computed(() => {
  let filtered = sandboxes.value

  if (selectedCategory.value) {
    filtered = filtered.filter((sb) => sb.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (sb) =>
        sb.title?.toLowerCase().includes(query) ||
        sb.description?.toLowerCase().includes(query) ||
        sb.category?.toLowerCase().includes(query),
    )
  }

  return filtered
})

const loadSandboxes = async () => {
  if (!props.workspaceId) {
    console.error('WorkspaceId is required')
    return
  }

  if (typeof props.workspaceId !== 'string') {
    console.error('WorkspaceId must be a string, got:', typeof props.workspaceId, props.workspaceId)
    return
  }

  loading.value = true
  try {
    const response = await $api.internal.getOperation(props.workspaceId, NO_SCOPE, {
      operation: 'sandboxStoreList',
    })

    sandboxes.value = response?.list || []
  } catch (e) {
    console.error('API error:', e)
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    loading.value = false
  }
}

const installSandbox = async (sandbox: SandboxType) => {
  installing.value = sandbox.id
  try {
    await $api.internal.postOperation(
      props.workspaceId,
      NO_SCOPE,
      {
        operation: 'sandboxInstall',
      },
      {
        sandboxId: sandbox.id,
        target_workspace_id: props.workspaceId,
      },
    )

    message.success(t('msg.success.baseInstalled'))
    emit('installed', sandbox)
    emit('close')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    installing.value = null
  }
}

watch(
  () => props.workspaceId,
  (newVal) => {
    if (newVal) {
      loadSandboxes()
    }
  },
  { immediate: true },
)
</script>

<template>
  <NcModal v-model:visible="visible" :footer="null" size="large" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-3">
        <GeneralIcon icon="ncStore" class="h-5 w-5" />
        <span>{{ t('labels.appMarket') }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-4 h-[600px]">
      <!-- Search and Filter Bar -->
      <div class="flex gap-3">
        <a-input v-model:value="searchQuery" class="flex-1" :placeholder="t('placeholder.searchByTitle')" allow-clear>
          <template #prefix>
            <GeneralIcon icon="search" class="h-4 w-4 text-gray-500" />
          </template>
        </a-input>

        <a-select v-model:value="selectedCategory" class="w-48" :placeholder="t('labels.category')" allow-clear>
          <a-select-option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </a-select-option>
        </a-select>
      </div>

      <!-- Sandbox List -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <a-spin size="large" />
      </div>

      <div v-else-if="filteredSandboxes.length === 0" class="flex flex-col items-center justify-center h-full gap-3">
        <GeneralIcon icon="inbox" class="h-16 w-16 text-gray-400" />
        <span class="text-gray-500">{{ t('msg.info.noSandboxesFound') }}</span>
      </div>

      <div v-else class="flex flex-col gap-3 overflow-y-auto pr-2">
        <div
          v-for="sandbox in filteredSandboxes"
          :key="sandbox.id"
          class="nc-sandbox-card border-1 border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
          @click="installSandbox(sandbox)"
        >
          <div class="flex gap-4">
            <div class="flex-1">
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex-1">
                  <h3 class="text-base font-semibold text-gray-800 mb-1">{{ sandbox.title }}</h3>
                  <p class="text-sm text-gray-600 line-clamp-2">{{ sandbox.description }}</p>
                </div>
                <NcButton
                  :loading="installing === sandbox.id"
                  :disabled="!!installing"
                  size="small"
                  type="primary"
                  @click.stop="installSandbox(sandbox)"
                >
                  <template #icon>
                    <GeneralIcon icon="download" />
                  </template>
                  {{ t('general.install') }}
                </NcButton>
              </div>

              <div class="flex items-center gap-4 text-xs text-gray-500 mt-3">
                <span v-if="sandbox.category" class="flex items-center gap-1">
                  <GeneralIcon icon="tag" class="h-3 w-3" />
                  {{ sandbox.category }}
                </span>
                <span class="flex items-center gap-1">
                  <GeneralIcon icon="download" class="h-3 w-3" />
                  {{ sandbox.install_count || 0 }} {{ t('labels.installs') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-sandbox-card {
  &:hover {
    @apply border-brand-500;
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
