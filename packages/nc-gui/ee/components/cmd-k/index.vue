<script lang="ts" setup>
import { useMagicKeys, whenever } from '@vueuse/core'
// import { useNuxtApp } from '#app'
import { commandScore } from './command-score'
import type { ComputedRef, VNode } from '#imports'
import { iconMap, onClickOutside } from '#imports'

interface CmdAction {
  id: string
  title: string
  hotkey?: string
  parent?: string
  handler?: Function
  scopePayload?: any
  icon?: VNode | string
  keywords?: string[]
  section?: string
}

const props = defineProps<{
  open: boolean
  data: CmdAction[]
  scope?: string
  placeholder?: string
  hotkey?: string
  loadTemporaryScope?: (scope: { scope: string; data: any }) => void
}>()

const emits = defineEmits(['update:open', 'scope'])

const vOpen = useVModel(props, 'open', emits)

// const { $e } = useNuxtApp()

const activeScope = ref('root')

const modalEl = ref<HTMLElement>()

const cmdInputEl = ref<HTMLInputElement>()

const cmdInput = ref('')

const renderCmdOrCtrlKey = () => {
  return isMac() ? '⌘' : 'CTRL'
}

const selected = ref<string>()

const formattedData: ComputedRef<(CmdAction & { weight: number })[]> = computed(() => {
  const rt: (CmdAction & { weight: number })[] = []
  for (const el of props.data) {
    rt.push({
      ...el,
      parent: el.parent || 'root',
      weight: commandScore(`${el.section}${el.title}${el.keywords?.join()}`, cmdInput.value),
    })
  }
  return rt
})

const nestedScope = computed(() => {
  if (activeScope.value === 'root') return [{ id: 'root', label: 'Home' }]
  const rt = []
  let parent = activeScope.value
  while (parent !== 'root') {
    const parentEl = formattedData.value.find((el) => el.id === parent)
    rt.push({ id: parent, label: parentEl?.title || 'Home' })
    parent = parentEl?.parent || 'root'
  }
  rt.push({ id: 'root', label: 'Home' })
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
    if (cmdInput.value === '') {
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
  if (cmdInput.value === '') return actionList.value
  actionList.value.sort((a, b) => {
    if (a.weight > b.weight) return -1
    if (a.weight < b.weight) return 1
    return 0
  })
  return actionList.value.filter((el) => el.weight > 0)
})

const actionListGroupedBySection = computed(() => {
  const rt: { [key: string]: CmdAction[] } = {}
  searchedActionList.value.forEach((el) => {
    if (el.section) {
      if (!rt[el.section]) rt[el.section] = []
      rt[el.section].push(el)
    } else {
      if (!rt.default) rt.default = []
      rt.default.push(el)
    }
  })
  return rt
})

const keys = useMagicKeys()


const { ctrl_k } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'k' && e.type === 'keydown')
      e.preventDefault()
  },
})

const setAction = (action: string) => {
  selected.value = action
  nextTick(() => {
    const actionIndex = searchedActionList.value.findIndex((el) => el.id === action)
    if (actionIndex === -1) return
    if (actionIndex === 0) {
      document.querySelector('.cmdk-actions')?.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (actionIndex === searchedActionList.value.length - 1) {
      document.querySelector('.cmdk-actions')?.scrollTo({ top: 999999, behavior: 'smooth' })
    } else {
      document.querySelector('.cmdk-action.selected')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  })
}

const selectFirstAction = () => {
  if (searchedActionList.value.length > 0) {
    setAction(searchedActionList.value[0].id)
  } else {
    selected.value = undefined
  }
}

const setScope = (scope: string) => {
  activeScope.value = scope

  emits('scope', scope)

  nextTick(() => {
    cmdInputEl.value?.focus()
    selectFirstAction()
  })
}

const show = () => {
  if (props.scope === 'disabled') return
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

whenever(keys.ctrl_k, () => {
  show()
})

whenever(keys.meta_k, () => {
  show()
})


whenever(ctrl_k, () => show())

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
    if (selectedEl) {
      fireAction(selectedEl, keys.shift.value)
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

defineExpose({
  open: show,
  close: hide,
  setScope,
})
</script>

<template>
  <div v-show="vOpen" class="cmdk-modal" :class="{ 'cmdk-modal-active': vOpen }">
    <div ref="modalEl" class="cmdk-modal-content">
      <div class="cmdk-header">
        <div class="cmdk-breadcrumbs">
          <div
            v-for="el of nestedScope"
            :key="`cmdk-breadcrumb-${el.id}`"
            :class="`cmdk-breadcrumb-item${activeScope === el.id ? ' is-active' : ''}`"
            @click="setScope(el.id)"
          >
            {{ el.label }}
          </div>
        </div>
        <div class="cmdk-input-wrapper">
          <input
            ref="cmdInputEl"
            v-model="cmdInput"
            class="cmdk-input"
            type="text"
            :placeholder="props.placeholder"
            @input="selectFirstAction"
          />
        </div>
      </div>
      <div class="cmdk-body">
        <div class="cmdk-actions">
          <div v-if="searchedActionList.length === 0">
            <div class="cmdk-action">
              <div class="cmdk-action-content">No action found.</div>
            </div>
          </div>
          <template v-else>
            <div
              v-for="[title, section] of Object.entries(actionListGroupedBySection)"
              :key="`cmdk-section-${title}`"
              class="cmdk-action-section"
            >
              <div v-if="title !== 'default'" class="cmdk-action-section-header">{{ title }}</div>
              <div class="cmdk-action-section-body">
                <div
                  v-for="act of section"
                  :key="act.id"
                  class="cmdk-action"
                  :class="{ selected: selected === act.id }"
                  @mouseenter="setAction(act.id)"
                  @click="fireAction(act)"
                >
                  <div class="cmdk-action-content">
                    <component
                      :is="(iconMap as any)[act.icon]"
                      v-if="act.icon && typeof act.icon === 'string' && (iconMap as any)[act.icon]"
                      class="cmdk-action-icon"
                    />
                    <component :is="act.icon" v-else-if="act.icon" class="cmdk-action-icon" />
                    {{ act.title }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="cmdk-footer">
        <div class="flex justify-center w-full py-2">
          <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
            <MdiFileOutline class="h-4 w-4" />
            Document
            <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ renderCmdOrCtrlKey() }} J </span>
          </div>
          <div class="flex flex-grow-1 text-brand-500 w-full text-sm items-center gap-2 justify-center">
            <MdiMapMarkerOutline class="h-4 w-4" />
            Quick Navigation
            <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ renderCmdOrCtrlKey() }} K </span>
          </div>
          <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
            <MdiClockOutline class="h-4 w-4" />
            Recent
            <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ renderCmdOrCtrlKey() }} L </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
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
    border-radius: 0.5em;
    max-width: 600px;
    background: var(--cmdk-modal-background);
  }

  .cmdk-input-wrapper {
    display: flex;
    border-bottom: 1px solid rgb(230, 230, 230);
  }

  .cmdk-input {
    padding: 1.25em;
    flex-grow: 1;
    flex-shrink: 0;
    margin: 0px;
    border: none;
    appearance: none;
    font-size: 1.125em;
    background: transparent;
    outline: none;
    box-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color) !important;

    caret-color: pink;
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

  .cmdk-breadcrumbs {
    display: inline-flex;
    overflow: hidden;
    padding: 1em 4em 0px 1em;
  }

  .cmdk-breadcrumb-item {
    background: #edf1f5;
    text-align: center;
    line-height: 1.2em;
    border-radius: 0.25em;
    border: 0px;
    cursor: pointer;
    padding: 0.1em 0.5em;
    color: var(--cmdk-secondary-text-color);
    margin-right: 0.5em;
    outline: none;
    font-size: 0.8em;
  }

  .cmdk-breadcrumb-item.is-active {
    background: #edf1f5;
  }

  .cmdk-breadcrumb-item:hover,
  .cmdk-breadcrumb-item.is-active:hover {
    background: #c9cdd2;
  }

  .cmdk-actions {
    max-height: 235px;
    margin: 0px;
    padding: 0.5em 0px;
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
      border-left: 2px solid transparent;

      &.selected {
        cursor: pointer;
        background-color: rgb(248, 249, 251);
        border-left: 2px solid var(--ant-primary-color);
        outline: none;
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

    .cmdk-action-section {
      display: flex;
      flex-direction: column;
      width: 100%;

      .cmdk-action-section-header {
        display: flex;
        align-items: center;
        padding: 0.2em 1em;
        font-size: 0.8em;
        color: rgb(144, 149, 157);
      }
    }
  }

  .cmdk-footer {
    display: flex;
    border-top: 1px solid rgb(230, 230, 230);
    background: rgba(242, 242, 242, 0.4);
    font-size: 0.8em;
    padding: 0.3em 0.6em;
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
