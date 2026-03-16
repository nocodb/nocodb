<script setup lang="ts">
import type { ChatSessionType } from 'nocodb-sdk'

interface Props {
  sessionTitle: string
  activeSession?: ChatSessionType | null
  sessionList: ChatSessionType[]
  isFullScreen: boolean
  isSidebarOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activeSession: null,
})

const emit = defineEmits<{
  newChat: []
  close: []
  toggleFullScreen: []
  toggleSidebar: []
  selectSession: [sessionId: string]
  deleteSession: [sessionId: string]
  renameSession: [sessionId: string, title: string]
}>()

const { sessionTitle, sessionList, activeSession, isFullScreen, isSidebarOpen } = toRefs(props)

const { t } = useI18n()

const showSessionList = ref(false)

watch(isFullScreen, (val) => {
  if (val) showSessionList.value = false
})

const onSelectSession = (sessionId: string) => {
  showSessionList.value = false
  emit('selectSession', sessionId)
}

const renamingSessionId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref()

const focusRenameInput = () => {
  const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
  el?.focus?.()
  const nativeInput = el?.$el?.querySelector?.('input') ?? el
  nativeInput?.select?.()
}

const startRename = (sessionId: string | undefined, currentTitle: string) => {
  if (!sessionId) return
  renamingSessionId.value = sessionId
  renameValue.value = currentTitle || ''
  nextTick(() => focusRenameInput())
}

const confirmRename = () => {
  const id = renamingSessionId.value
  if (!id) return
  renamingSessionId.value = null

  const trimmed = renameValue.value.trim()
  if (trimmed) {
    emit('renameSession', id, trimmed)
  }
}

const cancelRename = () => {
  renamingSessionId.value = null
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
    class="h-[var(--topbar-height)] flex items-center justify-between gap-2 px-3 border-b-1 border-nc-border-gray-medium bg-nc-bg-default flex-none"
  >
    <div class="flex items-center gap-1.5 min-w-0 flex-1">
      <NcTooltip v-if="isFullScreen && !isSidebarOpen" :title="t('labels.openSidebar')" placement="bottom" :arrow="false">
        <NcButton size="small" type="text" class="nc-chat-header-btn flex-none" @click="emit('toggleSidebar')">
          <GeneralIcon icon="doubleLeftArrow" class="!text-lg -mt-0.5 transform rotate-180" />
        </NcButton>
      </NcTooltip>

      <GeneralIcon icon="ncAutoAwesome" class="flex-none w-4 h-4 text-nc-content-brand" />

      <a-input
        v-if="renamingSessionId"
        ref="renameInputRef"
        v-model:value="renameValue"
        data-testid="nc-chat-rename-input"
        class="!bg-transparent !flex-1 !min-w-0 !rounded-md !h-7 !text-bodyBold !px-1.5 nc-input-shadow"
        :style="{ fontWeight: 'inherit' }"
        @blur="confirmRename"
        @keydown.stop="onKeyDown($event)"
        @click.stop
      />

      <template v-else>
        <NcDropdown
          v-if="!isFullScreen && sessionList.length > 0"
          v-model:visible="showSessionList"
          placement="bottomLeft"
          :trigger="['click']"
          class="min-w-0 flex-1"
        >
          <button
            class="flex items-center gap-1 min-w-0 max-w-[200px] px-1.5 py-0.5 rounded transition-colors hover:bg-nc-bg-gray-light cursor-pointer"
            @dblclick.stop="sessionTitle && startRename(activeSession?.id, activeSession?.title || '')"
          >
            <span class="text-bodyBold text-nc-content-gray truncate">
              {{ sessionTitle || 'NocoAI' }}
            </span>
            <GeneralIcon
              icon="chevronDown"
              class="flex-none w-3.5 h-3.5 text-nc-content-gray-subtle transition-transform duration-200"
              :class="{ 'rotate-180': showSessionList }"
            />
          </button>

          <template #overlay>
            <div class="nc-chat-session-menu py-1.5 min-w-[280px] max-w-[360px]">
              <template v-if="sessionList.length > 0">
                <div class="px-3 py-1">
                  <span class="text-captionSmBold text-nc-content-gray-muted uppercase tracking-wider">
                    {{ t('labels.recentChats') }}
                  </span>
                </div>

                <div class="flex flex-col gap-y-0.5 max-h-[280px] overflow-y-auto nc-scrollbar-thin">
                  <div
                    v-for="session in sessionList"
                    :key="session.id"
                    class="group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                    :class="{ 'bg-nc-bg-brand-soft': session.id === activeSession?.id }"
                    @click="onSelectSession(session.id!)"
                  >
                    <NcTooltip class="flex-1 min-w-0 truncate text-bodyDefaultSm" show-on-truncate-only>
                      <template #title>{{ session.title }}</template>
                      <span
                        :class="
                          session.id === activeSession?.id ? 'text-nc-content-brand font-medium' : 'text-nc-content-gray-subtle'
                        "
                      >
                        {{ session.title }}
                      </span>
                    </NcTooltip>

                    <NcButton
                      size="xxsmall"
                      type="text"
                      class="flex-none !bg-transparent hover:!bg-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      @click.stop="emit('deleteSession', session.id!)"
                    >
                      <GeneralIcon icon="delete" class="w-3.5 h-3.5 text-nc-content-gray-muted hover:text-nc-content-red" />
                    </NcButton>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </NcDropdown>

        <span
          v-else
          class="text-bodyBold text-nc-content-gray truncate cursor-default"
          @dblclick="sessionTitle && activeSession?.id && startRename(activeSession.id, activeSession.title || '')"
        >
          {{ sessionTitle || 'NocoAI' }}
        </span>
      </template>
    </div>

    <div class="flex items-center gap-1">
      <NcButton size="small" type="secondary" class="nc-chat-new-btn" @click="emit('newChat')">
        <div class="flex items-center gap-1">
          <span class="text-bodyDefaultSm">{{ t('labels.newChat') }}</span>
          <GeneralIcon icon="plus" class="w-3.5 h-3.5 -mr-0.5" />
        </div>
      </NcButton>

      <NcTooltip :title="isFullScreen ? t('labels.exitFullScreen') : t('labels.fullScreen')" placement="bottom" :arrow="false">
        <NcButton
          size="small"
          type="text"
          class="nc-chat-header-btn"
          data-testid="nc-chat-fullscreen-btn"
          @click="emit('toggleFullScreen')"
        >
          <GeneralIcon :icon="isFullScreen ? 'minimize' : 'maximize'" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>

      <NcTooltip :title="t('general.close')" placement="bottom" :arrow="false">
        <NcButton size="small" type="text" class="nc-chat-header-btn" data-testid="nc-chat-close-btn" @click="emit('close')">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-new-btn {
  @apply !h-7 !px-2.5 !gap-0.5 !rounded-lg;
}

.nc-chat-header-btn {
  @apply !bg-transparent hover:!bg-transparent;

  :deep(svg) {
    @apply w-4 h-4;
    color: var(--nc-content-gray-muted);
    transition: color 150ms ease;
  }

  &:hover :deep(svg) {
    color: var(--nc-content-gray);
  }
}
</style>
