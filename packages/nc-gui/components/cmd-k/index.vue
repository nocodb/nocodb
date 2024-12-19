<script lang="ts" setup>
import { useMagicKeys, whenever } from '@vueuse/core'
import { commandScore } from './command-score'
import type { CommandPaletteType } from '#imports'

interface CmdAction {
  id: string
  title: string
  hotkey?: string
  parent?: string
  handler?: Function
  scopePayload?: any
  icon?: VNode | string | Record<string, any>
  iconType?: string
  keywords?: string[]
  section?: string
  is_default?: number | null
  iconColor?: string
}

const props = defineProps<{
  open: boolean
  data: CmdAction[]
  scope?: string
  hotkey?: string
  loadTemporaryScope?: (scope: { scope: string; data: any }) => void
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open', 'scope'])

const vOpen = useVModel(props, 'open', emits)

const { t } = useI18n()

const activeScope = ref('root')

const modalEl = ref<HTMLElement>()

const cmdInputEl = ref<HTMLInputElement>()

const cmdInput = ref('')

const debouncedCmdInput = ref('')

const { user } = useGlobal()

const selected = ref<string>()

const cmdkActionsRef = ref<HTMLElement>()

const cmdkActionSelectedRef = ref<HTMLElement>()

const ACTION_HEIGHT = 48

const WRAPPER_HEIGHT = 300

const SCROLL_MARGIN = ACTION_HEIGHT / 2

const { cmdPlaceholder, loadScope, cmdLoading } = useCommandPalette()

const formattedData: ComputedRef<(CmdAction & { weight: number })[]> = computed(() => {
  const rt: (CmdAction & { weight: number })[] = []
  for (const el of props.data) {
    rt.push({
      ...el,
      title: el?.section === 'Views' && el?.is_default ? t('title.defaultView') : el.title,
      icon: el.section === 'Views' && el.is_default ? 'grid' : el.icon,
      parent: el.parent || 'root',
      weight: commandScore(
        `${el.section}${el?.section === 'Views' && el?.is_default ? t('title.defaultView') : el.title}${el.keywords?.join()}`,
        debouncedCmdInput.value,
      ),
    })
  }
  return rt
})

const nestedScope = computed(() => {
  const rt = []
  let parent = activeScope.value
  while (parent !== 'root') {
    const parentId = parent.startsWith('ws-') ? `ws-nav-${parent.split('-')[1]}` : parent
    const parentEl = formattedData.value.find((el) => el.id === parentId)
    rt.push({
      id: parent,
      label: parentEl?.title,
      icon: parentEl?.icon,
      iconType: parentEl?.iconType,
      iconColor: parent.startsWith('ws-') ? parentEl?.iconColor : null,
    })
    parent = parentEl?.parent || 'root'
  }
  return rt.reverse()
})

const isThereAnyActionInScope = (sc: string): boolean => {
  return formattedData.value.some((el) => {
    if (el.parent === sc) {
      if (!el.handler) {
        return isThereAnyActionInScope(el.id)
      }
      return true
    }
    return false
  })
}

const getAvailableScopes = (sc: string) => {
  const tempChildScopes = formattedData.value.filter((el) => el.parent === sc && !el.handler).map((el) => el.id)
  for (const el of tempChildScopes) {
    tempChildScopes.push(...getAvailableScopes(el))
  }
  return tempChildScopes
}

const activeScopes = computed(() => {
  return getAvailableScopes(activeScope.value)
})

const actionList = computed(() => {
  const sections = formattedData.value.filter((el) => el.section).map((el) => el.section)
  formattedData.value.sort((a, b) => {
    if (a.section && b.section) {
      if (sections.indexOf(a.section) < sections.indexOf(b.section)) return -1
      if (sections.indexOf(a.section) > sections.indexOf(b.section)) return 1
      return 0
    }
    if (a.section) return 1
    if (b.section) return -1
    return 0
  })
  return formattedData.value.filter((el) => {
    if (debouncedCmdInput.value === '') {
      if (el.parent === activeScope.value) {
        if (!el.handler) {
          return isThereAnyActionInScope(el.id)
        }
        return true
      }
      return false
    } else {
      if (el.parent === activeScope.value || activeScopes.value.includes(el.parent || 'root')) {
        if (!el.handler) {
          return isThereAnyActionInScope(el.id)
        }
        return true
      }
      return false
    }
  })
})

const searchedActionList = computed(() => {
  if (debouncedCmdInput.value === '') return actionList.value
  actionList.value.sort((a, b) => {
    if (a.weight > b.weight) return -1
    if (a.weight < b.weight) return 1
    return 0
  })
  return actionList.value
    .filter((el) => el.weight > 0)
    .sort((a, b) => b.section?.toLowerCase().localeCompare(a.section?.toLowerCase() as string) || 0)
})

const visibleSections = computed(() => {
  const sections: string[] = []
  searchedActionList.value.forEach((el) => {
    if (el.section && !sections.includes(el.section)) {
      sections.push(el.section)
    }
  })
  return sections
})

const actionListNormalized = computed(() => {
  const rt: (CmdAction | { sectionTitle: string })[] = []
  visibleSections.value.forEach((el) => {
    rt.push({ sectionTitle: el || 'default' })
    rt.push(...searchedActionList.value.filter((el2) => el2.section === el))
  })
  return rt
})

const { list, containerProps, wrapperProps } = useVirtualList(actionListNormalized, {
  itemHeight: ACTION_HEIGHT,
})

const keys = useMagicKeys()

const shiftModifier = keys.shift

const setAction = (action: string) => {
  const oldActionIndex = searchedActionList.value.findIndex((el) => el.id === selected.value)
  selected.value = action
  nextTick(() => {
    const actionIndex = searchedActionList.value.findIndex((el) => el.id === action)
    if (actionIndex === -1) return

    if (actionIndex === 0) {
      containerProps.ref.value?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    } else if (actionIndex === searchedActionList.value.length - 1) {
      containerProps.ref.value?.scrollTo({
        top: actionIndex * ACTION_HEIGHT,
        behavior: 'smooth',
      })
      return
    }

    // check if selected action rendered
    const actionEl = Array.isArray(cmdkActionSelectedRef.value) ? cmdkActionSelectedRef.value[0] : cmdkActionSelectedRef.value

    if (!actionEl || !actionEl.classList?.contains('selected')) {
      // if above the old selected action
      if (actionIndex < oldActionIndex) {
        containerProps.ref.value?.scrollTo({ top: (actionIndex + 1) * ACTION_HEIGHT - SCROLL_MARGIN, behavior: 'smooth' })
      } else {
        containerProps.ref.value?.scrollTo({
          top: (actionIndex + 2) * ACTION_HEIGHT - WRAPPER_HEIGHT + SCROLL_MARGIN,
          behavior: 'smooth',
        })
      }
      return
    }

    // count sections before the selected action
    const sectionBefore = visibleSections.value.findIndex((el) => el === searchedActionList.value[actionIndex].section) + 1

    // check if selected action is visible in the list
    const actionRect = actionEl?.getBoundingClientRect()
    const listRect = cmdkActionsRef.value?.getBoundingClientRect()
    if (actionRect && listRect) {
      if (actionRect.top < listRect.top || actionRect.bottom > listRect.bottom) {
        // if above the old selected action
        if (actionIndex < oldActionIndex) {
          containerProps.ref.value?.scrollTo({
            top: (actionIndex + sectionBefore) * ACTION_HEIGHT - SCROLL_MARGIN,
            behavior: 'smooth',
          })
        } else {
          containerProps.ref.value?.scrollTo({
            top: (actionIndex + 1 + sectionBefore) * ACTION_HEIGHT - WRAPPER_HEIGHT + SCROLL_MARGIN,
            behavior: 'smooth',
          })
        }
      }
    }
  })
}

const setScope = (scope: string) => {
  activeScope.value = scope

  emits('scope', scope)

  nextTick(() => {
    cmdInputEl.value?.focus()
  })
}

const show = () => {
  if (!user.value) return
  if (props.scope === 'disabled') return
  if (!vOpen.value) {
    loadScope()
  }

  vOpen.value = true
  cmdInput.value = ''
  nextTick(() => {
    setScope(props.scope || 'root')
  })
}

const hide = () => {
  vOpen.value = false
}

const fireAction = (action: CmdAction, preview = false) => {
  if (preview) {
    if (action?.scopePayload) {
      setScope(action.scopePayload.scope)
      if (action.scopePayload.data) {
        props.loadTemporaryScope?.(action.scopePayload)
      }
      return
    }
  }
  if (action?.handler) {
    action.handler()
    hide()
  } else {
    setScope(action.id)
  }
}

const updateDebouncedInput = useDebounceFn(() => {
  debouncedCmdInput.value = cmdInput.value

  nextTick(() => {
    cmdInputEl.value?.focus()
  })
}, 100)

watch(cmdInput, () => {
  if (cmdInput.value === '') {
    debouncedCmdInput.value = ''
  } else {
    updateDebouncedInput()
  }
})

whenever(keys.ctrl_k, () => {
  show()
})

whenever(keys.meta_k, () => {
  show()
})

whenever(keys.Escape, () => {
  if (vOpen.value) hide()
})

whenever(keys.ctrl_l, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_l, () => {
  if (vOpen.value) hide()
})

whenever(keys.ctrl_j, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_j, () => {
  if (vOpen.value) hide()
})

whenever(keys.arrowup, () => {
  if (vOpen.value) {
    const idx = searchedActionList.value.findIndex((el) => el.id === selected.value)
    if (idx > 0) {
      setAction(searchedActionList.value[idx - 1].id)
    } else if (idx === 0) {
      setAction(searchedActionList.value[searchedActionList.value.length - 1].id)
    }
  }
})

whenever(keys.arrowdown, () => {
  if (vOpen.value) {
    const idx = searchedActionList.value.findIndex((el) => el.id === selected.value)
    if (idx < searchedActionList.value.length - 1) {
      setAction(searchedActionList.value[idx + 1].id)
    } else if (idx === searchedActionList.value.length - 1) {
      setAction(searchedActionList.value[0].id)
    }
  }
})

whenever(keys.Enter, () => {
  if (vOpen.value) {
    const selectedEl = formattedData.value.find((el) => el.id === selected.value)
    cmdInput.value = ''
    if (selectedEl) {
      fireAction(selectedEl, shiftModifier.value)
    }
  }
})

whenever(keys.Backspace, () => {
  if (vOpen.value && cmdInput.value === '' && activeScope.value !== 'root') {
    const activeEl = formattedData.value.find((el) => el.id === activeScope.value)
    setScope(activeEl?.parent || 'root')
  }
})

onClickOutside(modalEl, () => {
  if (vOpen.value) hide()
})

watch(searchedActionList, () => {
  if (searchedActionList.value.length > 0) {
    setAction(searchedActionList.value[0].id)
  }
})

defineExpose({
  open: show,
  close: hide,
  setScope,
})
</script>

<template>
  <div v-show="vOpen" class="cmdk-modal" :class="{ 'cmdk-modal-active': vOpen }">
    <div ref="modalEl" class="cmdk-modal-content h-[25.25rem]">
      <div class="cmdk-header border-b-1 border-gray-200">
        <div class="cmdk-input-wrapper">
          <GeneralIcon class="h-4 w-4 text-gray-500" icon="search" />
          <div
            v-for="el of nestedScope"
            :key="`cmdk-breadcrumb-${el.id}`"
            v-e="['a:cmdk:setScope']"
            class="flex items-center"
            @click="setScope(el.id)"
          >
            <div
              class="text-gray-600 text-sm cursor-pointer flex gap-2 px-2 py-1 items-center justify-center font-medium capitalize"
            >
              <GeneralLoader v-if="cmdLoading && !el.label" />
              <template v-else>
                <GeneralWorkspaceIcon
                  v-if="el.icon && el.id.startsWith('ws')"
                  :workspace="{
                    title: el.label,
                    id: el.id.split('-')[1],
                    meta: {
                      color: el.iconColor,
                      icon: el.icon,
                      iconType: el.iconType,
                    },
                  }"
                  size="medium"
                />

                <component
                  :is="(iconMap as any)[el.icon]"
                  v-else-if="el.icon && typeof el.icon === 'string' && (iconMap as any)[el.icon]"
                  :class="{
                    '!text-blue-500': el.icon === 'grid',
                    '!text-purple-500': el.icon === 'form',
                    '!text-[#FF9052]': el.icon === 'kanban',
                    '!text-pink-500': el.icon === 'gallery',
                    '!text-maroon-500': el.icon === 'calendar',
                  }"
                  class="cmdk-action-icon"
                />
                <div v-else-if="el.icon" class="cmdk-action-icon max-w-4 flex items-center justify-center">
                  <LazyGeneralEmojiPicker :emoji="el.icon" class="!text-sm !h-4 !w-4" readonly size="small" />
                </div>
                <span
                  class="text-ellipsis truncate capitalize max-w-16"
                  style="word-break: keep-all; white-space: nowrap; display: inline"
                >
                  <NcTooltip show-on-truncate-only>
                    <template #title>
                      {{ el.label }}
                    </template>
                    <span class="text-ellipsis max-w-16">
                      {{ el.label }}
                    </span>
                  </NcTooltip>
                </span>
              </template>
            </div>

            <span class="text-gray-700 text-sm pl-1 font-medium">/</span>
          </div>
          <input ref="cmdInputEl" v-model="cmdInput" class="cmdk-input" type="text" :placeholder="cmdPlaceholder" />
        </div>
      </div>
      <div class="cmdk-body">
        <div ref="cmdkActionsRef" class="cmdk-actions nc-scrollbar-md">
          <div v-if="searchedActionList.length === 0 && cmdLoading" class="w-full h-[250px] flex justify-center items-center">
            <GeneralLoader :size="30" />
          </div>
          <div v-else-if="searchedActionList.length === 0">
            <div class="cmdk-action">
              <div class="cmdk-action-content">No action found.</div>
            </div>
          </div>
          <template v-else>
            <div class="cmdk-action-list">
              <div v-bind="containerProps" :style="`height: ${WRAPPER_HEIGHT}px`">
                <div v-bind="wrapperProps">
                  <div v-for="item in list" :key="item.index" :style="`height: ${ACTION_HEIGHT}px`">
                    <template v-if="'sectionTitle' in item.data">
                      <div
                        class="cmdk-action-section-header capitalize"
                        :style="{
                          height: `${ACTION_HEIGHT}px`,
                        }"
                      >
                        {{ item.data.sectionTitle }}
                      </div>
                    </template>
                    <template v-else>
                      <div
                        :ref="item.data.id === selected ? 'cmdkActionSelectedRef' : undefined"
                        :key="`${item.data.id}-${item.data.id === selected}`"
                        v-e="['a:cmdk:action']"
                        class="cmdk-action group flex items-center"
                        :style="{
                          height: `${ACTION_HEIGHT}px`,
                        }"
                        :class="{ selected: selected === item.data.id }"
                        @mouseenter="setAction(item.data.id)"
                        @click="fireAction(item.data)"
                      >
                        <div class="cmdk-action-content w-full">
                          <GeneralWorkspaceIcon
                            v-if="item.data.icon && item.data.id.startsWith('ws')"
                            :workspace="{
                              title: item.data.title,
                              id: item.data.id.split('-')[2],
                              meta: {
                                color: item.data?.iconColor,
                                icon: item.data?.icon,
                                iconType: item.data?.iconType,
                              },
                            }"
                            class="mr-2"
                            size="medium"
                          />
                          <template v-else-if="item.data.section === 'Bases' || item.data.icon === 'project'">
                            <GeneralBaseIconColorPicker
                              :key="item.data.iconColor"
                              :model-value="item.data.iconColor"
                              type="database"
                              readonly
                            >
                            </GeneralBaseIconColorPicker>
                          </template>
                          <template v-else>
                            <component
                              :is="(iconMap as any)[item.data.icon]"
                              v-if="item.data.icon && typeof item.data.icon === 'string' && (iconMap as any)[item.data.icon]"
                              :class="{
                                '!text-blue-500': item.data.icon === 'grid',
                                '!text-purple-500': item.data.icon === 'form',
                                '!text-[#FF9052]': item.data.icon === 'kanban',
                                '!text-pink-500': item.data.icon === 'gallery',
                                '!text-maroon-500 w-4 h-4': item.data.icon === 'calendar',
                              }"
                              class="cmdk-action-icon"
                            />
                            <div v-else-if="item.data.icon" class="cmdk-action-icon max-w-4 flex items-center justify-center">
                              <LazyGeneralEmojiPicker class="!text-sm !h-4 !w-4" size="small" :emoji="item.data.icon" readonly />
                            </div>
                          </template>
                          <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                            <template #title>
                              {{ item.data.title }}
                            </template>
                            <span class="truncate capitalize mr-4 py-0.5">
                              {{ item.data.title }}
                            </span>
                          </a-tooltip>
                          <div
                            class="bg-gray-200 text-gray-600 cmdk-keyboard hidden text-xs gap-2 p-0.5 items-center justify-center rounded-md ml-auto pl-2"
                          >
                            Enter
                            <div
                              class="bg-white border-1 items-center flex justify-center border-gray-300 text-gray-700 rounded h-5 w-5 px-0.25"
                            >
                              ↩
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <CmdFooter active-cmd="cmd-k" :set-active-cmd-view="setActiveCmdView" />
    </div>
  </div>
</template>

<style lang="scss">
/* TODO Move styles to Windi Classes */
:root {
  --cmdk-secondary-background-color: rgb(230, 230, 230);
  --cmdk-secondary-text-color: rgb(101, 105, 111);
  --cmdk-selected-background: rgb(245, 245, 245);

  --cmdk-icon-color: var(--cmdk-secondary-text-color);
  --cmdk-icon-size: 1.2em;

  --cmdk-modal-background: #fff;
}

.cmdk-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 1000;

  color: rgb(60, 65, 73);
  font-size: 16px;

  .cmdk-key {
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
    height: 1em;
    font-size: 1.25em;
    border-radius: 0.25em;
    background: var(--cmdk-secondary-background-color);
    color: var(--cmdk-secondary-text-color);
    margin-right: 0.2em;
  }

  .cmdk-modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 1;
    -webkit-box-flex: 1;
    flex-grow: 1;
    padding: 0;
    overflow: hidden;
    margin: auto;
    box-shadow: rgb(0 0 0 / 50%) 0px 16px 70px;
    top: 20%;
    border-radius: 16px;
    max-width: 640px;
    background: var(--cmdk-modal-background);
  }

  .cmdk-input-wrapper {
    @apply py-2 px-4 gap-1 flex items-center;
  }

  .cmdk-input {
    @apply text-sm pl-2;
    flex-grow: 1;
    flex-shrink: 0;
    margin: 0;
    border: none;
    appearance: none;
    background: transparent;
    outline: none;
    box-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color) !important;

    caret-color: #3366ff;
    color: rgb(60, 65, 73);
  }

  .cmdk-input::placeholder {
    color: rgb(165, 165, 165);
    opacity: 1;
  }

  .cmdk-input:-ms-input-placeholder {
    color: rgb(165, 165, 165);
  }

  .cmdk-input::-ms-input-placeholder {
    color: rgb(165, 165, 165);
  }

  .cmdk-actions {
    max-height: 310px;
    margin: 0;
    padding: 0;
    list-style: none;
    scroll-behavior: smooth;
    overflow: auto;
    position: relative;

    --scrollbar-track: initial;
    --scrollbar-thumb: initial;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    overflow: overlay;
    scrollbar-width: auto;
    scrollbar-width: thin;
    --scrollbar-thumb: #e1e3e6;
    --scrollbar-track: #fff;

    .cmdk-action {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      outline: none;
      transition: color 0s ease 0s;
      width: 100%;
      font-size: 0.9em;
      border-left: 4px solid transparent;

      .cmdk-keyboard {
        display: none;
      }

      &.selected {
        cursor: pointer;
        background-color: #f4f4f5;
        border-left: 4px solid var(--ant-primary-color);
        outline: none;

        .cmdk-keyboard {
          display: flex;
        }
      }

      .cmdk-action-content {
        display: flex;
        align-items: center;
        flex-shrink: 0.01;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0.75em 1em;
        width: 100%;
      }

      .cmdk-action-icon {
        margin-right: 0.4em;
      }
    }

    .cmdk-action-list {
      display: flex;
      flex-direction: column;
      width: 100%;

      .cmdk-action-section-header {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        font-size: 14px;
        color: #6a7184;
      }
    }
  }

  .cmdk-footer {
    display: flex;
    border-top: 1px solid rgb(230, 230, 230);
    background: rgba(242, 242, 242, 0.4);
    font-size: 0.8em;
    padding: 0 0.6em;
    color: var(--cmdk-secondary-text-color);
    .cmdk-footer-left {
      display: flex;
      flex-grow: 1;
      align-items: center;
      .cmdk-key-helper {
        display: flex;
        align-items: center;
        margin-right: 1.5em;
      }
    }
    .cmdk-footer-right {
      display: flex;
      flex-grow: 1;
      justify-content: flex-end;
      align-items: center;
      .nc-brand-icon {
        margin-left: 0.5em;
      }
    }
  }
}
</style>
