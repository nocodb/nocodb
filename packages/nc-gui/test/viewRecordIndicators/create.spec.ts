import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type VueWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { ViewTypes } from 'nocodb-sdk'
import Create from 'nocodb:ViewCreate.vue'
import { createRequest, message, updateRequest } from './fixtures/create-context'

const wrappers: VueWrapper[] = []

const modal = defineComponent({
  props: ['visible'],
  setup(_props, { slots }) {
    return () => h('section', [slots.default?.()])
  },
})
const form = defineComponent({
  setup(_props, { expose, slots }) {
    expose({ validateFields: async () => true, clearValidate: vi.fn() })
    return () => h('form', slots.default?.())
  },
})
const formItem = defineComponent({
  setup(_props, { slots }) {
    return () => h('div', slots.default?.())
  },
})
const input = defineComponent({
  props: ['value'],
  emits: ['update:value'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.value,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
      })
  },
})
const button = defineComponent({
  props: ['disabled', 'loading'],
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled || props.loading,
        },
        slots.default?.(),
      )
  },
})
const indicatorSettings = defineComponent({
  name: 'SmartsheetToolbarViewRecordIndicatorsSettings',
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('button', {
        'data-testid': 'enable-record-indicators',
        'disabled': props.disabled,
        'onClick': () => emit('update:modelValue', { ...props.modelValue, showCount: true, boldNonEmpty: true }),
      })
  },
})

const globals = {
  components: {
    ...Object.fromEntries(
      [
        'AiToggleButton',
        'AiWizardTabs',
        'GeneralIcon',
        'GeneralLoader',
        'GeneralViewIcon',
        'NcCheckbox',
        'NcSelect',
        'NcTooltip',
        'PaymentUpgradeBadge',
        'PaymentUpgradeBadgeProvider',
        'SmartsheetHeaderIcon',
        'ARadio',
        'ARadioGroup',
        'ASelect',
        'ASelectOption',
        'ATag',
        'ATextarea',
      ].map((name) => [name, formItem]),
    ),
    AInput: input,
    NcModal: modal,
    NcButton: button,
    AForm: form,
    AFormItem: formItem,
    SmartsheetToolbarViewRecordIndicatorsSettings: indicatorSettings,
  },
  directives: { e: () => undefined },
  stubs: { Transition: false },
  mocks: { $t: (key: string) => key },
}

function mountCreate() {
  const wrapper = mount(Create, {
    props: { modelValue: true, type: ViewTypes.GRID, baseId: 'base-1', tableId: 'table-1' },
    global: globals,
  })
  wrappers.push(wrapper)
  return wrapper
}

function createButton(wrapper: VueWrapper) {
  const result = wrapper.findAll('button').find((candidate) => candidate.text().includes('createView'))
  if (!result) throw new Error('Create button was not rendered')
  return result
}

beforeEach(() => {
  setActivePinia(createPinia())
  createRequest.mockReset()
  updateRequest.mockReset()
  message.error.mockClear()
  message.toast.mockClear()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('actual Create.vue record-indicator lifecycle', () => {
  it('resets indicator settings on reopen and makes no metadata update for the next default create', async () => {
    createRequest.mockResolvedValueOnce({ id: 'first-view', base_id: 'base-1', fk_model_id: 'table-1', meta: {} })
    createRequest.mockResolvedValueOnce({ id: 'second-view', base_id: 'base-1', fk_model_id: 'table-1', meta: {} })
    updateRequest.mockImplementation(async (id, updates) => ({ id, base_id: 'base-1', fk_model_id: 'table-1', ...updates }))

    const wrapper = mountCreate()
    await wrapper.get('[data-testid="enable-record-indicators"]').trigger('click')
    await createButton(wrapper).trigger('click')
    await flushPromises()
    expect(updateRequest).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 550))

    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(createRequest).toHaveBeenCalledTimes(2)
    expect(updateRequest).toHaveBeenCalledOnce()
  })

  it('uses the click-time setting snapshot when the dialog closes and reopens during create', async () => {
    let resolveCreate!: (value: Record<string, unknown>) => void
    createRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
    )
    updateRequest.mockImplementation(async (id, updates) => ({ id, base_id: 'base-1', fk_model_id: 'table-1', ...updates }))

    const wrapper = mountCreate()
    await wrapper.get('[data-testid="enable-record-indicators"]').trigger('click')
    await createButton(wrapper).trigger('click')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    resolveCreate({ id: 'snapshot-view', base_id: 'base-1', fk_model_id: 'table-1', meta: {} })
    await flushPromises()

    expect(updateRequest).toHaveBeenCalledWith('snapshot-view', {
      meta: {
        sidebarIndicators: { showCount: true, boldNonEmpty: true, refreshAmount: 1, refreshUnit: 'days' },
      },
    })
  })

  it('emits the created view and keeps its original metadata after a post-create settings failure', async () => {
    const created = { id: 'created-view', base_id: 'base-1', fk_model_id: 'table-1', meta: { icon: 'bell' } }
    createRequest.mockResolvedValueOnce(created)
    const rejected = new Error('update rejected')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    updateRequest.mockRejectedValueOnce(rejected)

    const wrapper = mountCreate()
    await wrapper.get('[data-testid="enable-record-indicators"]').trigger('click')
    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(message.error).toHaveBeenCalledWith('labels.viewRecordIndicators.createUpdateFailed')
    expect(log).toHaveBeenCalledWith('Failed to apply record indicators after create', rejected)
    expect(wrapper.emitted('created')).toEqual([[created]])
    expect(created.meta).toEqual({ icon: 'bell' })
  })

  it('does not add a metadata request for a default create', async () => {
    createRequest.mockResolvedValueOnce({ id: 'default-view', base_id: 'base-1', fk_model_id: 'table-1', meta: { icon: 'bell' } })
    const wrapper = mountCreate()
    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(createRequest).toHaveBeenCalledOnce()
    expect(updateRequest).not.toHaveBeenCalled()
    expect(wrapper.emitted('created')).toHaveLength(1)
  })
})
