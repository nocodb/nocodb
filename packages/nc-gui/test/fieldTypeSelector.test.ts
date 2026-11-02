// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, onMounted, ref, toRefs } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n, useI18n } from 'vue-i18n'
import { UITypes } from 'nocodb-sdk'
import FieldTypeSelector from '../components/smartsheet/column/UITypesOptionsWithSearch.vue'
import { getUidtI18nName } from '../utils/fieldTypeI18n'
import { searchCompare } from '../utils/commonUtils'
import en from '../lang/en.json'
import ko from '../lang/ko.json'
import ja from '../lang/ja.json'

const Input = defineComponent({
  props: { value: String },
  emits: ['update:value', 'change'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        value: props.value,
        onInput: (event: Event) => {
          emit('update:value', (event.target as HTMLInputElement).value)
          emit('change')
        },
      }),
})

const options = [
  UITypes.LinkToAnotherRecord,
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Attachment,
  UITypes.Checkbox,
  'SmartText',
].map((name) => ({ name, icon: 'span' }))

beforeEach(() => {
  // Nuxt supplies these auto-imports in the app; use the same Vue and i18n
  // implementations here, with only the unrelated role/upgrade stores stubbed.
  for (const [name, value] of Object.entries({
    computed,
    onMounted,
    ref,
    toRefs,
    useI18n,
    getUidtI18nName,
    searchCompare,
    AIButton: 'AIButton',
    AIPrompt: 'AIPrompt',
    useRoles: () => ({ isMetaReadOnly: ref(false) }),
    useColumnCreateStoreOrThrow: () => ({ isSystem: ref(false) }),
    useEeConfig: () => ({}),
  })) {
    vi.stubGlobal(name, value)
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderSelector = () => {
  const i18n = createI18n({ legacy: false, locale: 'ko', fallbackLocale: 'en', messages: { en, ko, ja } })
  const wrapper = mount(FieldTypeSelector, {
    props: { options },
    global: {
      plugins: [i18n],
      mocks: { getUidtI18nName, AIButton: 'AIButton', AIPrompt: 'AIPrompt' },
      stubs: {
        'a-input': Input,
        'GeneralSourceRestrictionTooltip': { template: '<div><slot /></div>' },
        'GeneralIcon': true,
        'NcTooltip': { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, i18n }
}

describe('field type selector', () => {
  it('renders translated options and falls back to English for an untranslated type', () => {
    const { wrapper } = renderSelector()
    expect(wrapper.get('[data-testid="SingleLineText"]').text()).toBe('한 줄 텍스트')
    expect(wrapper.get('[data-testid="LinkToAnotherRecord"]').text()).toBe('다른 항목에 대한 링크')
    expect(wrapper.get('[data-testid="SmartText"]').text()).toBe('Smart Text')
    expect(wrapper.text()).not.toContain('datatype.')
    wrapper.unmount()
  })

  it.each([
    ['숫자', 'Number'],
    ['한 줄', 'SingleLineText'],
    ['Single line text', 'SingleLineText'],
    ['short text', 'SingleLineText'],
    ['다른 항목', 'LinkToAnotherRecord'],
  ])('finds the expected option when searching for %s', async (query, uidt) => {
    const { wrapper } = renderSelector()
    await wrapper.get('input').setValue(query)
    expect(wrapper.findAll('[data-testid]').map((entry) => entry.attributes('data-testid'))).toEqual([
      'nc-column-uitypes-options-list-wrapper',
      uidt,
    ])
    wrapper.unmount()
  })

  it('emits the original type ID when a translated option is selected', async () => {
    const { wrapper } = renderSelector()
    await wrapper.get('[data-testid="SingleLineText"]').trigger('click')
    expect(wrapper.emitted('selected')).toEqual([[UITypes.SingleLineText]])
    wrapper.unmount()
  })

  it('refreshes labels and search when the UI language changes', async () => {
    const { wrapper, i18n } = renderSelector()
    i18n.global.locale.value = 'ja'
    await nextTick()
    expect(wrapper.get('[data-testid="SingleLineText"]').text()).toBe('テキスト')
    await wrapper.get('input').setValue('テキスト')
    expect(wrapper.find('[data-testid="SingleLineText"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
