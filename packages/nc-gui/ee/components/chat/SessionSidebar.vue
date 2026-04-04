<script setup lang="ts">
import type { ChatSessionType } from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  sessions: ChatSessionType[]
  activeSessionId?: string | null
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activeSessionId: null,
  isLoading: false,
})

const emit = defineEmits<{
  select: [sessionId: string]
  delete: [sessionId: string]
  rename: [sessionId: string, title: string]
  newChat: []
  close: []
}>()

const { sessions, activeSessionId } = toRefs(props)

const { t } = useI18n()

const searchQuery = ref('')
const isSearchOpen = ref(false)
const searchInputRef = ref()

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref()

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter((s) => s.title?.toLowerCase().includes(q))
})

interface SessionGroup {
  label: string
  sessions: ChatSessionType[]
}

const groupedSessions = computed<SessionGroup[]>(() => {
  const now = dayjs()
  const todayStart = now.startOf('day')
  const weekAgoStart = now.subtract(7, 'day').startOf('day')

  const today: ChatSessionType[] = []
  const last7Days: ChatSessionType[] = []
  const older: ChatSessionType[] = []

  for (const session of filteredSessions.value) {
    const updated = dayjs(session.updated_at)
    if (updated.isAfter(todayStart)) {
      today.push(session)
    } else if (updated.isAfter(weekAgoStart)) {
      last7Days.push(session)
    } else {
      older.push(session)
    }
  }

  const groups: SessionGroup[] = []
  if (today.length) groups.push({ label: t('labels.today'), sessions: today })
  if (last7Days.length) groups.push({ label: t('labels.previous7Days'), sessions: last7Days })
  if (older.length) groups.push({ label: t('labels.older'), sessions: older })

  return groups
})

const toggleSearch = () => {
  isSearchOpen.value = !isSearchOpen.value
  if (isSearchOpen.value) {
    nextTick(() => {
      const el = searchInputRef.value?.$el?.querySelector?.('input') ?? searchInputRef.value
      el?.focus?.()
    })
  } else {
    searchQuery.value = ''
  }
}

const onSearchBlur = () => {
  if (!searchQuery.value.trim()) {
    isSearchOpen.value = false
  }
}

const focusRenameInput = () => {
  const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
  el?.focus?.()
  const nativeInput = el?.$el?.querySelector?.('input') ?? el
  nativeInput?.select?.()
}

const startRename = (session: ChatSessionType) => {
  renamingId.value = session.id!
  renameValue.value = session.title || ''
  // Delay focus — NcDropdown steals focus on unmount
  setTimeout(() => nextTick(() => focusRenameInput()), 100)
}

const confirmRename = () => {
  const id = renamingId.value
  if (!id) return
  renamingId.value = null

  const trimmed = renameValue.value.trim()
  if (trimmed) {
    emit('rename', id, trimmed)
  }
}

const cancelRename = () => {
  renamingId.value = null
}

const onKeyDown = (e: KeyboardEvent) => {
  e.stopPropagation()
  if (e.key === 'Escape') {
    cancelRename()
  } else if (e.key === 'Enter') {
    confirmRename()
  }
}
</script>

<template>
  <div
    class="nc-chat-session-sidebar flex flex-col h-full border-r-1 rtl:border-r-0 rtl:border-l-1 border-nc-border-gray-medium bg-nc-bg-gray-sidebar"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between gap-2 px-3 h-[var(--topbar-height)] border-b-1 border-nc-border-gray-medium flex-none"
    >
      <span class="text-bodyBold text-nc-content-gray">{{ t('labels.chats') }}</span>

      <div class="flex items-center gap-0.5">
        <NcTooltip :title="t('general.search')" placement="bottom" :arrow="false">
          <NcButton
            size="small"
            type="text"
            class="!bg-transparent hover:!bg-nc-bg-gray-light"
            :class="{ '!bg-nc-bg-brand': isSearchOpen }"
            @click="toggleSearch"
          >
            <GeneralIcon icon="search" class="w-4 h-4" :class="isSearchOpen ? 'text-nc-content-brand' : ''" />
          </NcButton>
        </NcTooltip>

        <NcTooltip :title="t('labels.closeSidebar')" placement="bottom" :arrow="false">
          <NcButton
            size="small"
            type="text"
            class="!bg-transparent hover:!bg-nc-bg-gray-light !text-nc-content-gray-muted"
            @click="emit('close')"
          >
            <GeneralIcon icon="doubleLeftArrow" class="!text-lg -mt-0.5" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- New Chat button -->
    <div class="px-1.5 pt-2 flex-none">
      <NcButton
        v-e="['c:chat:session:new:sidebar']"
        type="text"
        size="small"
        full-width
        class="nc-chat-new-session-btn !text-nc-content-gray-subtle !hover:text-nc-content-gray !w-full !px-2.5"
        @click="emit('newChat')"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncPlusCircle" class="!text-nc-content-brand" />
          <span>{{ t('labels.newChat') }}</span>
        </div>
      </NcButton>
    </div>
    <div v-if="isSearchOpen" class="px-2 pt-2 flex-none">
      <a-input
        ref="searchInputRef"
        v-model:value="searchQuery"
        :placeholder="t('general.search')"
        allow-clear
        class="!rounded-lg nc-input-shadow"
        @click.stop
        @blur="onSearchBlur"
        @keydown.esc.stop="toggleSearch"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
        </template>
      </a-input>
    </div>
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-1.5 pb-2 pt-1">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <GeneralLoader />
      </div>

      <div v-else-if="!filteredSessions.length" class="px-3 py-4 text-captionSm text-nc-content-gray-muted text-center">
        {{ searchQuery ? t('labels.noResults') : t('labels.noChatsYet') }}
      </div>

      <template v-else>
        <div v-for="group in groupedSessions" :key="group.label" class="mb-1">
          <div class="px-2.5 pt-3 pb-1">
            <span class="text-captionXsBold text-nc-content-gray-subtle uppercase tracking-wider">
              {{ group.label }}
            </span>
          </div>

          <div class="flex flex-col gap-y-0.5">
            <div
              v-for="session in group.sessions"
              :key="session.id"
              class="group flex items-center gap-1 px-2.5 h-8 rounded-md cursor-pointer transition-colors"
              :class="session.id === activeSessionId ? 'bg-nc-bg-brand' : 'hover:bg-nc-bg-gray-medium'"
              @click="renamingId !== session.id && emit('select', session.id!)"
            >
              <a-input
                v-if="renamingId === session.id"
                ref="renameInputRef"
                v-model:value="renameValue"
                class="!bg-transparent !flex-1 !min-w-0 !rounded-md !h-6 !text-bodyDefaultSm !px-1.5 nc-input-shadow"
                :style="{ fontWeight: 'inherit' }"
                @blur="confirmRename"
                @keydown.stop="onKeyDown($event)"
                @click.stop
              />

              <NcTooltip v-else class="flex-1 min-w-0 truncate text-bodyDefaultSm" show-on-truncate-only placement="right">
                <template #title>{{ session.title }}</template>
                <span
                  :class="session.id === activeSessionId ? 'text-nc-content-brand font-medium' : 'text-nc-content-gray-subtle'"
                >
                  {{ session.title }}
                </span>
              </NcTooltip>
              <NcDropdown v-if="renamingId !== session.id" :trigger="['click']" placement="bottomRight">
                <NcButton
                  size="xxsmall"
                  type="text"
                  class="flex-none !bg-transparent hover:!bg-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  @click.stop
                >
                  <GeneralIcon icon="threeDotVertical" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
                </NcButton>

                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem @click="startRename(session)">
                      <GeneralIcon icon="rename" />
                      {{ t('general.rename') }}
                    </NcMenuItem>
                    <NcDivider />
                    <NcMenuItem danger @click="emit('delete', session.id!)">
                      <GeneralIcon icon="delete" />
                      {{ t('general.delete') }}
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-session-sidebar {
  width: 260px;
  min-width: 260px;
}

.nc-chat-new-session-btn {
  @apply !justify-start !rounded-lg;

  &:hover {
    @apply !bg-nc-bg-gray-medium;
  }
}
</style>
