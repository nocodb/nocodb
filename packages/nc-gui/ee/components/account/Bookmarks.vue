<script setup lang="ts">
const {
  bookmarks,
  groups,
  orderedGroups,
  bookmarksByGroup,
  isLoading,
  loadBookmarks,
  removeBookmark,
  updateBookmark,
  addGroup,
  removeGroup,
  updateGroup,
} = useBookmarks()

const { blockBookmarks, showUpgradeToUseBookmarks } = useEeConfig()
const { t } = useI18n()

const isCreatingGroup = ref(false)
const newGroupName = ref('')

async function onCreateGroup() {
  if (!newGroupName.value.trim()) return

  await addGroup({ name: newGroupName.value.trim() })
  newGroupName.value = ''
  isCreatingGroup.value = false
}

async function onDeleteGroup(groupId: string) {
  const { showConfirmModal } = useNcConfirmModal()
  showConfirmModal({
    title: t('general.delete') + ' ' + t('labels.bookmarkGroup'),
    content: t('msg.bookmarkGroupDeleted'),
    okCallback: async () => {
      await removeGroup(groupId)
    },
  })
}

onMounted(() => {
  if (blockBookmarks.value) {
    showUpgradeToUseBookmarks()
    return
  }
  loadBookmarks()
})
</script>

<template>
  <div class="flex flex-col gap-6 p-6 max-w-250">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-nc-content-gray">
        {{ $t('title.bookmarks') }}
      </h1>

      <NcButton size="small" @click="isCreatingGroup = true">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="plus" class="w-4 h-4" />
          {{ $t('labels.createGroup') }}
        </div>
      </NcButton>
    </div>

    <!-- Create group input -->
    <div v-if="isCreatingGroup" class="flex items-center gap-2">
      <a-input
        v-model:value="newGroupName"
        :placeholder="$t('labels.bookmarkGroup')"
        class="!w-60"
        @keyup.enter="onCreateGroup"
        @keyup.escape="isCreatingGroup = false"
      />
      <NcButton size="small" @click="onCreateGroup">
        {{ $t('general.save') }}
      </NcButton>
      <NcButton size="small" type="text" @click="isCreatingGroup = false">
        {{ $t('general.cancel') }}
      </NcButton>
    </div>

    <!-- Loading -->
    <GeneralLoader v-if="isLoading" />

    <!-- Groups -->
    <div v-else class="flex flex-col gap-6">
      <div
        v-for="group in orderedGroups"
        :key="group.id"
        class="flex flex-col gap-2 border-1 border-nc-border-gray-medium rounded-lg p-4"
      >
        <!-- Group header -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-nc-content-gray">
            {{ group.name }}
          </span>

          <NcButton
            v-if="group.name !== 'Ungrouped'"
            type="text"
            size="xs"
            class="!text-nc-content-red-dark"
            @click="onDeleteGroup(group.id!)"
          >
            <GeneralIcon icon="delete" class="w-4 h-4" />
          </NcButton>
        </div>

        <!-- Bookmarks in group -->
        <div
          v-for="bm in bookmarksByGroup[group.id!]"
          :key="bm.id"
          class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-nc-bg-gray-light"
        >
          <GeneralIcon icon="ncBookmark" class="w-4 h-4 text-nc-content-gray-subtle flex-shrink-0" />

          <span class="flex-1 text-sm text-nc-content-gray truncate">
            {{ bm.title }}
          </span>

          <span class="text-xs text-nc-content-gray-subtle capitalize">
            {{ bm.target_type }}
          </span>

          <NcButton
            type="text"
            size="xs"
            class="!text-nc-content-red-dark"
            @click="removeBookmark(bm.id!)"
          >
            <GeneralIcon icon="delete" class="w-4 h-4" />
          </NcButton>
        </div>

        <!-- Empty group -->
        <div
          v-if="!(bookmarksByGroup[group.id!]?.length)"
          class="text-sm text-nc-content-gray-muted px-2 py-1"
        >
          {{ $t('labels.noData') }}
        </div>
      </div>

      <!-- No groups at all -->
      <div v-if="!orderedGroups.length" class="text-sm text-nc-content-gray-muted">
        {{ $t('labels.noData') }}
      </div>
    </div>
  </div>
</template>
