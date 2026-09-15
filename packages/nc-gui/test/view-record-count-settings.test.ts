import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref, toRef } from 'vue'
import { useVModel } from '@vueuse/core'
import { ViewLockType, ViewTypes } from 'nocodb-sdk'
import RecordCount from '~/components/dlg/View/RecordCount.vue'
import RecordCountFields from '~/components/dlg/View/RecordCountFields.vue'
import { usePersonalViewPermissions } from '~/composables/usePersonalViewPermissions'

const checkbox = defineComponent({
  props: ['checked', 'disabled'],
  emits: ['update:checked'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h('label', [
        h('input', {
          type: 'checkbox',
          checked: props.checked,
          disabled: props.disabled,
          onChange: (event: Event) => emit('update:checked', (event.target as HTMLInputElement).checked),
        }),
        slots.default?.(),
      ]),
})
const button = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h(
        'button',
        {
          disabled: props.disabled || props.loading,
          onClick: () => emit('click'),
        },
        slots.default?.(),
      ),
})
const modal = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('section', [slots.header?.(), slots.default?.()]),
})
const stubs = {
  NcCheckbox: checkbox,
  NcButton: button,
  NcModal: modal,
  GeneralViewIcon: true,
  AInputNumber: true,
  ASelect: true,
  ASelectOption: true,
}
const selectedView = {
  id: 'selected-view',
  base_id: 'selected-base',
  fk_workspace_id: 'selected-workspace',
  type: ViewTypes.GRID,
  title: 'Missing invoices',
  lock_type: ViewLockType.Collaborative,
  meta: { icon: 'existing-icon', description: 'Keep this description' },
}
let updateView: ReturnType<typeof vi.fn>
let showError: ReturnType<typeof vi.fn>
let permissions: Set<string>
let wrapper: ReturnType<typeof mount> | undefined

function open(overrides = {}) {
  wrapper = mount(RecordCount, {
    props: { modelValue: true, view: { ...selectedView, ...overrides }, roles: { editor: true } },
    global: {
      stubs,
      components: { DlgViewRecordCountFields: RecordCountFields },
      mocks: { $t: (key: string) => key },
    },
  })
  return wrapper
}

function saveButton() {
  return wrapper!.findAllComponents(button).find((component) => component.text() === 'general.save')!
}

beforeEach(() => {
  permissions = new Set(['viewCreateOrEdit'])
  updateView = vi.fn().mockResolvedValue(selectedView)
  showError = vi.fn()
  for (const [name, value] of Object.entries({ computed, ref, toRef, useVModel, usePersonalViewPermissions })) {
    vi.stubGlobal(name, value)
  }
  vi.stubGlobal('useGlobal', () => ({ user: ref({ id: 'current-user' }) }))
  vi.stubGlobal('useRoles', () => ({ isUIAllowed: (permission: string) => permissions.has(permission) }))
  vi.stubGlobal('useViewsStore', () => ({ updateView }))
  vi.stubGlobal('message', { error: showError })
  vi.stubGlobal('extractSdkResponseErrorMsg', async (error: Error) => error.message)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('record count settings dialog', () => {
  it('opts in through the checkbox and saves settings to the selected view scope, preserving other metadata', async () => {
    open()
    expect(saveButton().attributes('disabled')).toBeDefined()
    await wrapper!.findAll('input[type="checkbox"]')[0].setValue(true)
    expect(saveButton().attributes('disabled')).toBeUndefined()
    await saveButton().trigger('click')
    await flushPromises()
    expect(updateView).toHaveBeenCalledExactlyOnceWith(
      'selected-view',
      {
        meta: {
          ...selectedView.meta,
          recordCount: { showCount: true, boldWhenNonEmpty: false, refreshInterval: 1, refreshUnit: 'days' },
        },
      },
      { workspaceId: 'selected-workspace', baseId: 'selected-base' },
    )
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('allows bold-only display with the same default daily refresh', async () => {
    open()
    await wrapper!.findAll('input[type="checkbox"]')[1].setValue(true)
    await saveButton().trigger('click')
    await flushPromises()
    expect(updateView.mock.calls[0][1].meta.recordCount).toEqual({
      showCount: false,
      boldWhenNonEmpty: true,
      refreshInterval: 1,
      refreshUnit: 'days',
    })
  })

  it('blocks readers, editors of locked views, and editors of another owner’s personal view', async () => {
    for (const view of [
      { lock_type: ViewLockType.Collaborative },
      { lock_type: ViewLockType.Locked },
      { lock_type: ViewLockType.Personal, owned_by: 'someone-else' },
    ]) {
      permissions = view.lock_type === ViewLockType.Collaborative ? new Set() : new Set(['viewCreateOrEdit'])
      open(view)
      expect(wrapper!.findAll('input[type="checkbox"]').every((input) => input.attributes('disabled') !== undefined)).toBe(true)
      // Even a directly emitted click must be checked by the save handler.
      saveButton().vm.$emit('click')
      await flushPromises()
      expect(updateView).not.toHaveBeenCalled()
      wrapper!.unmount()
      wrapper = undefined
    }
  })

  it('shows a failed save and leaves the dialog open for retry', async () => {
    updateView.mockRejectedValueOnce(new Error('Save failed'))
    open()
    await wrapper!.findAll('input[type="checkbox"]')[0].setValue(true)
    await saveButton().trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('Save failed')
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    expect(saveButton().attributes('disabled')).toBeUndefined()
  })

  it('preserves an existing attachment-mode column while changing count settings', async () => {
    open({ attachment_mode_column_id: 'attachments' })
    await wrapper!.findAll('input[type="checkbox"]')[0].setValue(true)
    await saveButton().trigger('click')
    await flushPromises()
    expect(updateView.mock.calls[0][1].attachment_mode_column_id).toBe('attachments')
  })
})
