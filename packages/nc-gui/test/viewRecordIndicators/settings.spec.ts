import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type VueWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { ViewType } from 'nocodb-sdk'
import { ViewLockType } from 'nocodb-sdk'
import Settings from 'nocodb:ViewRecordIndicatorsSettings.vue'
import Dialog from 'nocodb:ViewRecordIndicatorsDialog.vue'
import { readViewRecordIndicators } from 'nocodb:viewRecordIndicators'
import type { ViewRecordIndicatorSettings } from '../../lib/viewRecordIndicators'
import { allowedPermissions, message, updateRequest, useViewsStore, user } from './fixtures/ui-context'

const wrappers: VueWrapper[] = []
const checkbox = defineComponent({
  props: ['checked', 'disabled'],
  emits: ['update:checked'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h('label', attrs, [
        h('input', {
          type: 'checkbox',
          checked: props.checked,
          disabled: props.disabled,
          onChange: (event: Event) => emit('update:checked', (event.target as HTMLInputElement).checked),
        }),
        slots.default?.(),
      ])
  },
})
const numberInput = defineComponent({
  props: ['value', 'disabled'],
  emits: ['update:value'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        type: 'number',
        value: props.value,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
      })
  },
})
const select = defineComponent({
  props: ['value', 'disabled'],
  emits: ['update:value'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'select',
        {
          ...attrs,
          value: props.value,
          disabled: props.disabled,
          onChange: (event: Event) => emit('update:value', (event.target as HTMLSelectElement).value),
        },
        slots.default?.(),
      )
  },
})
const option = defineComponent({
  props: ['value'],
  setup(props, { slots }) {
    return () => h('option', { value: props.value }, slots.default?.())
  },
})
const button = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled || props.loading,
          onClick: () => {
            if (!props.disabled && !props.loading) emit('click')
          },
        },
        slots.default?.(),
      )
  },
})
const modal = defineComponent({
  props: ['visible'],
  setup(props, { slots }) {
    return () => (props.visible ? h('section', [slots.header?.(), slots.default?.()]) : null)
  },
})
const globals = {
  components: {
    NcCheckbox: checkbox,
    AInputNumber: numberInput,
    NcSelect: select,
    ASelectOption: option,
    NcButton: button,
    NcModal: modal,
    SmartsheetToolbarViewRecordIndicatorsSettings: Settings,
  },
  mocks: { $t: (key: string) => key },
}

function mountSettings(disabled = false) {
  const model = ref(readViewRecordIndicators(undefined))
  const host = defineComponent({
    setup() {
      return () =>
        h(Settings, {
          'modelValue': model.value,
          disabled,
          'onUpdate:modelValue': (value: ViewRecordIndicatorSettings) => {
            model.value = value
          },
        })
    },
  })
  const wrapper = mount(host, { global: globals })
  wrappers.push(wrapper)
  return { wrapper, model }
}

function mountDialog(overrides: Partial<ViewType> = {}) {
  const view = {
    id: 'target-view',
    base_id: 'base-1',
    fk_model_id: 'table-1',
    title: 'Needs review',
    show: true,
    type: 3,
    lock_type: ViewLockType.Collaborative,
    meta: { icon: 'bell', extra: { keep: true } },
    ...overrides,
  }
  const store = useViewsStore()
  store.viewsByTable.set('base-1:table-1', [view])
  updateRequest.mockImplementation(async (id, updates) => ({ ...view, ...updates, id }))
  const wrapper = mount(Dialog, { props: { modelValue: true, view }, global: globals })
  wrappers.push(wrapper)
  return { wrapper, store, view }
}

async function toggleCount(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="view-indicators-show-count"] input').setValue(true)
}

beforeEach(() => {
  setActivePinia(createPinia())
  allowedPermissions.value = new Set(['viewCreateOrEdit', 'fieldAdd'])
  user.value = { id: 'owner-1' }
  updateRequest.mockReset()
  message.error.mockClear()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('actual shared indicator settings controls', () => {
  it('starts with independent disabled options and a daily refresh', async () => {
    const { wrapper, model } = mountSettings()
    expect(model.value).toEqual({ showCount: false, boldNonEmpty: false, refreshAmount: 1, refreshUnit: 'days' })
    expect((wrapper.get('[data-testid="view-indicators-refresh-amount"]').element as HTMLInputElement).value).toBe('1')
    expect((wrapper.get('[data-testid="view-indicators-refresh-unit"]').element as HTMLSelectElement).value).toBe('days')
    await toggleCount(wrapper)
    expect(model.value.showCount).toBe(true)
    expect(model.value.boldNonEmpty).toBe(false)
    await wrapper.get('[data-testid="view-indicators-bold-nonempty"] input').setValue(true)
    await wrapper.get('[data-testid="view-indicators-refresh-amount"]').setValue('3')
    await wrapper.get('[data-testid="view-indicators-refresh-unit"]').setValue('hours')
    expect(model.value).toEqual({ showCount: true, boldNonEmpty: true, refreshAmount: 3, refreshUnit: 'hours' })
    expect(updateRequest).not.toHaveBeenCalled()
  })

  it('shows invalid empty input instead of silently saving it as zero', async () => {
    const { wrapper, model } = mountSettings()
    await wrapper.get('[data-testid="view-indicators-refresh-amount"]').setValue('')
    expect(model.value.refreshAmount).toBe(0)
    expect(wrapper.get('[role="alert"]').text()).toContain('invalidInterval')
    expect(updateRequest).not.toHaveBeenCalled()
  })

  it('does not change the model when controls are disabled', async () => {
    const { wrapper, model } = mountSettings(true)
    await toggleCount(wrapper)
    expect(model.value.showCount).toBe(false)
    expect((wrapper.get('[data-testid="view-indicators-refresh-amount"]').element as HTMLInputElement).disabled).toBe(true)
  })
})

describe('actual existing-view indicator settings dialog', () => {
  it('does not save unchanged defaults', async () => {
    const { wrapper } = mountDialog()
    expect((wrapper.get('[data-testid="view-indicators-save"]').element as HTMLButtonElement).disabled).toBe(true)
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    expect(updateRequest).not.toHaveBeenCalled()
  })

  it('merges the latest action-target metadata and preserves unrelated settings', async () => {
    const { wrapper, store, view } = mountDialog()
    await toggleCount(wrapper)
    const latestMeta = { icon: 'new-icon', extra: { keep: true }, sidebarIndicators: { futureOption: 'preserve' } }
    store.viewsByTable.set('base-1:table-1', [{ ...view, meta: latestMeta }])
    store.viewsByTable.set('another-base:another-table', [
      { ...view, id: 'not-the-target', base_id: 'another-base', fk_model_id: 'another-table', meta: { icon: 'other' } },
    ])
    await nextTick()
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    await flushPromises()
    expect(updateRequest).toHaveBeenCalledExactlyOnceWith('target-view', {
      meta: {
        ...latestMeta,
        sidebarIndicators: {
          futureOption: 'preserve',
          showCount: true,
          boldNonEmpty: false,
          refreshAmount: 1,
          refreshUnit: 'days',
        },
      },
    })
    expect(wrapper.emitted('updated')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('retains the dialog and original view when the metadata request fails', async () => {
    const { wrapper, view } = mountDialog()
    await toggleCount(wrapper)
    updateRequest.mockRejectedValue(new Error('update rejected'))
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    await flushPromises()
    expect(message.error).toHaveBeenCalledExactlyOnceWith('update rejected')
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(view.meta).toEqual({ icon: 'bell', extra: { keep: true } })
    expect(wrapper.find('[data-testid="view-record-indicator-settings"]').exists()).toBe(true)
  })

  it('blocks writes if edit permission changes while the dialog is open', async () => {
    const { wrapper } = mountDialog()
    await toggleCount(wrapper)
    allowedPermissions.value = new Set()
    await nextTick()
    expect((wrapper.get('[data-testid="view-indicators-save"]').element as HTMLButtonElement).disabled).toBe(true)
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    expect(updateRequest).not.toHaveBeenCalled()
  })

  it('does not submit a second metadata write while the first save is pending', async () => {
    const { wrapper, view } = mountDialog()
    await toggleCount(wrapper)
    let resolveSave!: (value: ViewType) => void
    updateRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    expect(updateRequest).toHaveBeenCalledOnce()
    resolveSave({ ...view, meta: { sidebarIndicators: { showCount: true } } })
    await flushPromises()
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })

  it('allows an editor to configure their own personal view', async () => {
    allowedPermissions.value = new Set(['viewCreateOrEdit'])
    const { wrapper } = mountDialog({ lock_type: ViewLockType.Personal, owned_by: 'owner-1' })
    await toggleCount(wrapper)
    expect((wrapper.get('[data-testid="view-indicators-save"]').element as HTMLButtonElement).disabled).toBe(false)
    await wrapper.get('[data-testid="view-indicators-save"]').trigger('click')
    await flushPromises()
    expect(updateRequest).toHaveBeenCalledExactlyOnceWith('target-view', expect.any(Object))
  })

  it.each([{ lock_type: ViewLockType.Locked }, { lock_type: ViewLockType.Personal, owned_by: 'someone-else' }])(
    'keeps the existing locked and personal-view edit restrictions',
    async (view) => {
      allowedPermissions.value = new Set(['viewCreateOrEdit'])
      const { wrapper } = mountDialog(view)
      await toggleCount(wrapper)
      expect((wrapper.get('[data-testid="view-indicators-save"]').element as HTMLButtonElement).disabled).toBe(true)
      expect(updateRequest).not.toHaveBeenCalled()
    },
  )
})
