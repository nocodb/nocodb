<script lang="ts" setup>
import { NcMarkdownParser } from '~/helpers/tiptap'

interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const baseStore = useBase()

const { base, managedAppVersionsInfo, managedAppVersions, isManagedAppMaster, isManagedAppInstaller } = storeToRefs(baseStore)

const isUpdating = ref(false)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(10)

// Use versions from store (already loaded by loadCurrentVersion)
const allVersions = computed(() => managedAppVersions.value || [])

// Paginated versions for display
const paginatedVersions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return allVersions.value.slice(start, end)
})

const totalVersions = computed(() => allVersions.value.length)

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  return parseStringDateTime(dateString, 'MMM DD, YYYY, hh:mm A')
}

const parseChangelog = (changelog: string) => {
  if (!changelog) return ''
  return NcMarkdownParser.parse(
    changelog,
    {
      enableMention: false,
      maxBlockTokens: undefined,
    },
    true,
  )
}

// Installer app helpers
const isCurrentVersion = (version: any) => {
  return managedAppVersionsInfo.value.current?.id === version.id
}

const isAvailableUpdate = (version: any) => {
  return managedAppVersionsInfo.value.updateAvailable && managedAppVersionsInfo.value.published?.id === version.id
}

// Master app helpers
const isLiveVersion = (version: any) => {
  return managedAppVersionsInfo.value.published?.id === version.id
}

const isDraftVersion = (version: any) => {
  return version.status === 'draft'
}

const showUpdateButton = false

const updateToVersion = async (_version: any) => {
  // Todo: Currently we have auto update, we have to use this when we support manual update
}

// Reset pagination when modal opens
watch(vVisible, (val) => {
  if (val) {
    currentPage.value = 1
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <DlgManagedAppHeader
      v-model:visible="vVisible"
      :title="$t('general.changelog')"
      :sub-title="$t('labels.versionHistoryAndUpdates')"
    />

    <div class="flex-1 nc-scrollbar-thin">
      <div class="nc-changelog-content">
        <template v-if="allVersions.length > 0">
          <div class="nc-version-cards">
            <div
              v-for="version in paginatedVersions"
              :key="version.id"
              class="nc-version-card"
              :class="{
                'nc-version-card-available': isManagedAppInstaller && isAvailableUpdate(version),
                'nc-version-card-installed': isManagedAppInstaller && isCurrentVersion(version),
                'nc-version-card-live': isManagedAppMaster && isLiveVersion(version),
                'nc-version-card-draft': isManagedAppMaster && isDraftVersion(version),
              }"
            >
              <!-- Version Header -->
              <div class="nc-version-card-header">
                <div class="nc-version-card-title">
                  <span class="nc-version-number">v{{ version.version }}</span>
                  <!-- Installer app badges -->
                  <template v-if="isManagedAppInstaller">
                    <div v-if="isAvailableUpdate(version)" class="nc-version-badge nc-version-badge-available">
                      {{ $t('general.available') }}
                    </div>
                    <div v-else-if="isCurrentVersion(version)" class="nc-version-badge nc-version-badge-installed">
                      {{ $t('general.installed') }}
                    </div>
                  </template>
                  <!-- Master app badges -->
                  <template v-if="isManagedAppMaster">
                    <div v-if="isLiveVersion(version)" class="nc-version-badge nc-version-badge-live">
                      {{ $t('labels.live') }}
                    </div>
                    <div v-else-if="isDraftVersion(version)" class="nc-version-badge nc-version-badge-draft">
                      {{ $t('labels.draft') }}
                    </div>
                  </template>
                </div>
                <span class="nc-version-date">{{ formatDate(version.published_at) }}</span>
              </div>

              <!-- Changelog Content -->
              <div
                v-if="version.release_notes"
                class="nc-version-changelog nc-rich-text-content"
                v-html="parseChangelog(version.release_notes)"
              ></div>
              <div v-else class="nc-version-changelog-empty">
                <span class="text-nc-content-gray-muted text-sm">{{ $t('labels.noChangelogAvailable') }}</span>
              </div>

              <!-- Update Button -->
              <NcButton
                v-if="showUpdateButton && isAvailableUpdate(version)"
                type="primary"
                class="nc-update-btn"
                :loading="isUpdating"
                @click="updateToVersion(version)"
              >
                Update to v{{ version.version }}
              </NcButton>
            </div>
          </div>
        </template>

        <div v-else class="nc-changelog-empty">
          <div class="nc-empty-icon">
            <GeneralIcon icon="file" class="w-10 h-10 text-nc-content-gray-muted" />
          </div>
          <div class="text-base font-semibold text-nc-content-gray mb-1">{{ $t('labels.noVersionsAvailable') }}</div>
          <div class="text-sm text-nc-content-gray-subtle">{{ $t('labels.versionHistoryAppearHere') }}</div>
        </div>
      </div>
    </div>

    <div class="nc-changelog-footer">
      <span class="text-sm text-nc-content-gray-muted">
        {{ $t('msg.currentlyOnVersion', { version: `v${managedAppVersionsInfo.current?.version || '1.0.0'}` }) }}
      </span>
      <div class="flex items-center gap-3">
        <NcPagination
          v-if="totalVersions > pageSize"
          v-model:current="currentPage"
          v-model:page-size="pageSize"
          :total="totalVersions"
          mode="simple"
        />
        <NcButton type="secondary" size="small" @click="vVisible = false"> {{ $t('general.done') }} </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-changelog-content {
  @apply px-4 py-4;
}

.nc-version-cards {
  @apply flex flex-col gap-4;
}

.nc-version-card {
  @apply bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl p-4;
  @apply transition-all duration-200;

  // Installer app states
  &.nc-version-card-available {
    @apply border-nc-border-brand bg-brand-50/30 dark:bg-nc-brand-20/20;
  }

  &.nc-version-card-installed,
  &.nc-version-card-live {
    @apply border-green-200 dark:border-green-600/40 bg-green-50/50 dark:bg-nc-green-20/20;
  }

  &.nc-version-card-draft {
    @apply border-orange-200 dark:border-orange-600/40 bg-orange-50/50 dark:bg-nc-orange-20/20;
  }
}

.nc-version-card-header {
  @apply flex items-center justify-between mb-3;
}

.nc-version-card-title {
  @apply flex items-center gap-2;
}

.nc-version-number {
  @apply font-semibold text-base text-nc-content-brand;
  font-feature-settings: 'tnum' on, 'lnum' on;
}

.nc-version-badge {
  @apply inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold uppercase;

  // Installer app badges
  &.nc-version-badge-available {
    @apply bg-nc-brand-50 dark:bg-nc-brand-20 text-nc-content-brand;
  }

  &.nc-version-badge-installed,
  &.nc-version-badge-live {
    @apply bg-green-100 dark:bg-nc-green-20 text-green-600;
  }

  &.nc-version-badge-draft {
    @apply bg-nc-orange-20 dark:bg-nc-orange-20 text-orange-600;
  }
}

.nc-version-date {
  @apply text-sm text-nc-content-gray-muted;
}

.nc-version-changelog {
  @apply text-sm text-nc-content-gray leading-relaxed;

  :deep(ul) {
    @apply list-none space-y-1.5;
    padding: 0 !important;
    margin: 0 !important;

    li {
      @apply flex items-start gap-2;
      padding: 0 !important;
      margin: 0 !important;

      &::before {
        content: '';
        @apply w-4 h-4 mt-0.5 flex-shrink-0;
        @apply bg-green-500;
        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
        mask-size: contain;
      }
    }
  }

  :deep(p) {
    @apply m-0;
  }
}

.nc-version-changelog-empty {
  @apply py-2;
}

.nc-update-btn {
  @apply w-full mt-4;
}

.nc-changelog-empty {
  @apply flex flex-col items-center justify-center py-16;
}

.nc-empty-icon {
  @apply w-16 h-16 rounded-full bg-nc-bg-gray-light;
  @apply flex items-center justify-center mb-4;
}

.nc-changelog-footer {
  @apply px-4 py-3 border-t-1 border-nc-border-gray-medium;
  @apply flex items-center justify-between;
}
</style>
