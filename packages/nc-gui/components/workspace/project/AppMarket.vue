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
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:visible', 'installed'])

const visible = useVModel(props, 'visible', emit)

const { $api } = useNuxtApp()
const { t } = useI18n()

const sandboxes = ref<SandboxType[]>([])
const loading = ref(false)
const installing = ref<string | null>(null)
const searchQuery = ref('')
const selectedCategory = ref<string | undefined>(undefined)

const categories = computed(() => {
  const cats = new Set<string>()
  sandboxes.value.forEach((sb) => {
    if (sb.category) {
      // Split comma-separated categories
      sb.category.split(',').forEach((cat) => {
        const trimmed = cat.trim()
        if (trimmed) cats.add(trimmed)
      })
    }
  })
  return Array.from(cats).sort()
})

const filteredSandboxes = computed(() => {
  let filtered = sandboxes.value

  if (selectedCategory.value) {
    const selected = selectedCategory.value
    filtered = filtered.filter((sb) => {
      if (!sb.category) return false
      // Check if selected category exists in comma-separated list
      const categories = sb.category.split(',').map((c) => c.trim())
      return categories.includes(selected)
    })
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((sb) => searchCompare([sb.title, sb.description, sb.category], query))
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
  } catch (e: any) {
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
    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    installing.value = null
  }
}

const formatInstallCount = (count: number | null | undefined): string => {
  const num = count || 0
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
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
  <div class="nc-app-market flex flex-col h-full">
    <!-- Header -->
    <div class="nc-app-market-header">
      <div class="flex items-center gap-3">
        <div class="nc-app-market-icon">
          <GeneralIcon icon="ncBox" class="h-5 w-5" />
        </div>
        <div class="flex-1">
          <div class="text-lg font-semibold text-nc-content-gray-emphasis">{{ t('title.appStore') }}</div>
          <div class="text-xs text-nc-content-gray-subtle2">Discover and install managed applications</div>
        </div>

        <NcButton size="small" type="text" @click="visible = false">
          <GeneralIcon icon="close" class="text-nc-content-gray-muted h-4 w-4" />
        </NcButton>
      </div>
    </div>

    <!-- Search and Filter Bar -->
    <div class="nc-app-market-filters">
      <div class="flex gap-3">
        <a-input
          v-model:value="searchQuery"
          class="flex-1 nc-input-sm nc-input-shadow !rounded-lg"
          :placeholder="t('placeholder.searchByTitle')"
          allow-clear
        >
          <template #prefix>
            <GeneralIcon icon="search" class="h-4 w-4 text-nc-content-gray-muted" />
          </template>
        </a-input>

        <NcSelect v-model:value="selectedCategory" class="w-48 nc-select-sm" :placeholder="t('labels.category')" allow-clear>
          <a-select-option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </a-select-option>
        </NcSelect>
      </div>

      <!-- Results count -->
      <div v-if="!loading && filteredSandboxes.length > 0" class="mt-3 text-xs text-nc-content-gray-muted">
        {{ filteredSandboxes.length }} {{ filteredSandboxes.length === 1 ? 'app' : 'apps' }} available
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="flex flex-col items-center gap-3">
          <a-spin size="large" />
          <div class="text-sm text-nc-content-gray-muted">Loading applications...</div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredSandboxes.length === 0" class="nc-app-market-empty">
        <div class="nc-empty-icon">
          <GeneralIcon icon="ncBox" class="h-10 w-10 text-nc-content-gray-muted" />
        </div>
        <div class="text-base font-semibold text-nc-content-gray mb-2">No applications found</div>
        <div class="text-sm text-nc-content-gray-subtle text-center max-w-md">
          {{
            searchQuery || selectedCategory
              ? "Try adjusting your search or filters to find what you're looking for."
              : 'No managed applications are available yet. Be the first to publish one!'
          }}
        </div>
      </div>

      <!-- App List -->
      <div v-else class="nc-app-market-list">
        <div v-for="sandbox in filteredSandboxes" :key="sandbox.id" class="nc-app-item">
          <div class="nc-app-item-content">
            <!-- App Icon & Info -->
            <div class="nc-app-info">
              <div class="nc-app-icon">
                <GeneralIcon icon="ncBox" />
              </div>
              <div class="nc-app-details">
                <div class="nc-app-title-row">
                  <h3 class="nc-app-title">{{ sandbox.title }}</h3>
                  <div v-if="sandbox.category" class="nc-app-categories">
                    <div
                      v-for="cat in sandbox.category
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean)"
                      :key="cat"
                      class="nc-app-category"
                    >
                      <GeneralIcon icon="ncHash" class="h-3 w-3" />
                      <span>{{ cat }}</span>
                    </div>
                  </div>
                </div>
                <p
                  class="nc-app-description"
                  :class="{
                    '!text-nc-content-gray-muted': !sandbox.description,
                  }"
                >
                  {{ sandbox.description || 'No description available' }}
                </p>
                <div class="nc-app-meta">
                  <span class="nc-app-meta-item">
                    <GeneralIcon icon="download" class="h-3.5 w-3.5" />
                    <span class="font-medium">{{ formatInstallCount(sandbox.install_count || 0) }}</span>
                    <span class="text-nc-content-gray-muted">installs</span>
                  </span>
                  <span v-if="sandbox.version" class="nc-app-meta-item">
                    <GeneralIcon icon="gitCommit" class="h-3.5 w-3.5" />
                    <span>v{{ sandbox.version }}</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Install Button -->
            <div class="nc-app-action">
              <NcButton
                :loading="installing === sandbox.id"
                :disabled="!!installing"
                size="small"
                type="primary"
                @click="installSandbox(sandbox)"
              >
                <template #icon>
                  <GeneralIcon icon="download" class="h-4 w-4" />
                </template>
                {{ installing === sandbox.id ? 'Installing...' : t('general.install') }}
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-app-market {
  @apply bg-nc-bg-gray-extralight;
}

.nc-app-market-header {
  @apply px-6 py-4 bg-nc-bg-default border-b-1 border-nc-border-gray-light;
}

.nc-app-market-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm;
  background: linear-gradient(135deg, var(--nc-content-brand) 0%, var(--nc-content-blue-medium) 100%);
  box-shadow: 0 2px 4px rgba(51, 102, 255, 0.15);
}

.nc-app-market-filters {
  @apply px-6 py-4 bg-nc-bg-default border-b-1 border-nc-border-gray-light;
}

.nc-app-market-empty {
  @apply flex flex-col items-center justify-center h-full p-8;
}

.nc-empty-icon {
  @apply w-20 h-20 rounded-full bg-nc-bg-gray-light flex items-center justify-center mb-4;
}

.nc-app-market-list {
  @apply p-6;
}

.nc-app-item {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl mb-3 relative overflow-hidden;
  @apply transition-all duration-200 ease-in-out;

  &::before {
    @apply absolute left-0 top-0 bottom-0 w-1 bg-nc-content-brand opacity-0;
    @apply transition-opacity duration-200 ease-in-out;
    content: '';
  }

  &:hover {
    @apply border-nc-border-brand transform translate-x-0.5;
    box-shadow: 0 4px 12px rgba(51, 102, 255, 0.08);

    &::before {
      @apply opacity-100;
    }

    .nc-app-icon {
      @apply transform scale-105;
      box-shadow: 0 4px 8px rgba(51, 102, 255, 0.15);
    }
  }

  &:last-child {
    @apply mb-0;
  }
}

.nc-app-item-content {
  @apply flex items-center gap-4 px-4 py-3;
}

.nc-app-info {
  @apply flex gap-3 flex-1 min-w-0;
}

.nc-app-icon {
  @apply w-10 h-10 rounded-lg border-1 border-nc-border-gray-light flex items-center justify-center flex-shrink-0 text-nc-content-brand;
  @apply transition-all duration-200 ease-in-out;
  background: linear-gradient(135deg, var(--nc-bg-brand) 0%, var(--nc-bg-blue-light) 100%);

  :deep(svg) {
    @apply w-5 h-5;
  }
}

.nc-app-details {
  @apply flex-1 min-w-0;
}

.nc-app-title-row {
  @apply flex items-center gap-2 mb-1.5;
}

.nc-app-title {
  @apply text-base font-semibold text-nc-content-gray-emphasis m-0 truncate flex-shrink-0;
}

.nc-app-categories {
  @apply flex items-center gap-2 flex-wrap;
}

.nc-app-category {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 bg-nc-bg-gray-light border-1 border-nc-border-gray-light;
  @apply rounded-full text-xs text-nc-content-gray-subtle whitespace-nowrap flex-shrink-0;
}

.nc-app-description {
  @apply text-sm text-nc-content-gray-subtle m-0 mb-2 leading-normal line-clamp-2;
}

.nc-app-meta {
  @apply flex items-center gap-4 text-xs text-nc-content-gray-subtle2;
}

.nc-app-meta-item {
  @apply flex items-center gap-1.5;
}

.nc-app-action {
  @apply flex-shrink-0;
}

// Responsive adjustments
@media (max-width: 768px) {
  .nc-app-item-content {
    @apply flex-col items-start gap-4;
  }

  .nc-app-action {
    @apply w-full;

    :deep(button) {
      @apply w-full;
    }
  }

  .nc-app-title-row {
    @apply flex-wrap;
  }
}
</style>
