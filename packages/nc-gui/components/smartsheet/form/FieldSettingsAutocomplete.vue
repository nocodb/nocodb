<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const { t } = useI18n()

const autocompleteUiTypes = [
  UITypes.SingleLineText,
  UITypes.Email,
  UITypes.PhoneNumber,
  UITypes.URL,
  UITypes.LongText,
  UITypes.Number,
] as string[]

const columnSupportsAutocomplete = (elementType: string) => autocompleteUiTypes.includes(elementType)

// HTML spec control groups mapped to NocoDB UITypes
// See: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofilling-form-controls:-the-autocomplete-attribute
type AutocompleteControlGroup = 'text' | 'multiline' | 'password' | 'url' | 'email' | 'tel' | 'numeric'

const controlGroupToUiTypes: Record<AutocompleteControlGroup, UITypes[]> = {
  text: [UITypes.SingleLineText, UITypes.LongText],
  multiline: [UITypes.LongText],
  password: [UITypes.SingleLineText],
  url: [UITypes.URL, UITypes.SingleLineText],
  email: [UITypes.Email, UITypes.SingleLineText],
  tel: [UITypes.PhoneNumber, UITypes.SingleLineText],
  numeric: [UITypes.Number, UITypes.SingleLineText],
}

interface AutocompleteOption {
  value: string
  labelKey: string
  group: string
  controlGroup: AutocompleteControlGroup
}

const allAutocompleteOptions: AutocompleteOption[] = [
  // Personal — Text
  { value: 'name', labelKey: 'fullName', group: 'personal', controlGroup: 'text' },
  { value: 'honorific-prefix', labelKey: 'honorificPrefix', group: 'personal', controlGroup: 'text' },
  { value: 'given-name', labelKey: 'firstName', group: 'personal', controlGroup: 'text' },
  { value: 'additional-name', labelKey: 'middleName', group: 'personal', controlGroup: 'text' },
  { value: 'family-name', labelKey: 'lastName', group: 'personal', controlGroup: 'text' },
  { value: 'honorific-suffix', labelKey: 'honorificSuffix', group: 'personal', controlGroup: 'text' },
  { value: 'nickname', labelKey: 'nickname', group: 'personal', controlGroup: 'text' },
  { value: 'organization', labelKey: 'companyOrganization', group: 'personal', controlGroup: 'text' },
  { value: 'organization-title', labelKey: 'jobTitle', group: 'personal', controlGroup: 'text' },
  { value: 'sex', labelKey: 'gender', group: 'personal', controlGroup: 'text' },
  { value: 'language', labelKey: 'language', group: 'personal', controlGroup: 'text' },

  // Personal — Email
  { value: 'email', labelKey: 'email', group: 'personal', controlGroup: 'email' },

  // Personal — Tel
  { value: 'tel', labelKey: 'phoneNumber', group: 'personal', controlGroup: 'tel' },
  { value: 'tel-country-code', labelKey: 'telCountryCode', group: 'personal', controlGroup: 'text' },
  { value: 'tel-national', labelKey: 'telNational', group: 'personal', controlGroup: 'text' },
  { value: 'tel-area-code', labelKey: 'telAreaCode', group: 'personal', controlGroup: 'text' },
  { value: 'tel-local', labelKey: 'telLocal', group: 'personal', controlGroup: 'text' },

  // Personal — Numeric
  { value: 'bday-day', labelKey: 'birthdayDay', group: 'personal', controlGroup: 'numeric' },
  { value: 'bday-month', labelKey: 'birthdayMonth', group: 'personal', controlGroup: 'numeric' },
  { value: 'bday-year', labelKey: 'birthdayYear', group: 'personal', controlGroup: 'numeric' },

  // Address — Text
  { value: 'address-line1', labelKey: 'addressLine1', group: 'address', controlGroup: 'text' },
  { value: 'address-line2', labelKey: 'addressLine2', group: 'address', controlGroup: 'text' },
  { value: 'address-line3', labelKey: 'addressLine3', group: 'address', controlGroup: 'text' },
  { value: 'address-level2', labelKey: 'city', group: 'address', controlGroup: 'text' },
  { value: 'address-level1', labelKey: 'stateProvince', group: 'address', controlGroup: 'text' },
  { value: 'postal-code', labelKey: 'postalZipCode', group: 'address', controlGroup: 'text' },
  { value: 'country', labelKey: 'countryCode', group: 'address', controlGroup: 'text' },
  { value: 'country-name', labelKey: 'country', group: 'address', controlGroup: 'text' },

  // Address — Multiline
  { value: 'street-address', labelKey: 'streetAddress', group: 'address', controlGroup: 'multiline' },

  // Web — URL
  { value: 'url', labelKey: 'websiteUrl', group: 'web', controlGroup: 'url' },

  // Web — Text
  { value: 'username', labelKey: 'username', group: 'web', controlGroup: 'text' },

  // Web — Password
  { value: 'new-password', labelKey: 'newPassword', group: 'web', controlGroup: 'password' },
  { value: 'current-password', labelKey: 'currentPassword', group: 'web', controlGroup: 'password' },
  { value: 'one-time-code', labelKey: 'oneTimeCode', group: 'web', controlGroup: 'password' },
]

const groupLabelKeys: Record<string, string> = {
  basic: 'general.formAutocomplete.basic',
  personal: 'general.formAutocomplete.personal',
  address: 'general.formAutocomplete.address',
  web: 'general.formAutocomplete.web',
}

const autocompleteOptions = computed<NcListItemType[]>(() => {
  const uidt = activeField.value?.uidt as UITypes | undefined

  const tGroup = (key: string) => t(groupLabelKeys[key] || key)

  const basicOptions: NcListItemType[] = [
    { value: 'off', label: t('general.off'), ncGroupHeaderLabel: tGroup('basic') },
    { value: 'on', label: t('general.on'), ncGroupHeaderLabel: tGroup('basic') },
  ]

  const filtered = allAutocompleteOptions
    .filter((opt) => {
      if (!uidt) return true
      return controlGroupToUiTypes[opt.controlGroup]?.includes(uidt)
    })
    .map((opt) => ({
      value: opt.value,
      label: t(`general.formAutocomplete.${opt.labelKey}`),
      ncGroupHeaderLabel: tGroup(opt.group),
    }))

  return [...basicOptions, ...filtered]
})

const groupOrder = computed(() => [
  t('general.formAutocomplete.basic'),
  t('general.formAutocomplete.personal'),
  t('general.formAutocomplete.address'),
  t('general.formAutocomplete.web'),
])

const autocompleteDefaults: Partial<Record<UITypes, string>> = {
  [UITypes.Email]: 'email',
  [UITypes.PhoneNumber]: 'tel',
  [UITypes.URL]: 'url',
}

const isDropdownOpen = ref(false)

const isEnabled = computed(() => {
  if (!activeField.value) return false
  const meta = parseProp(activeField.value.meta)
  return meta?.autocomplete !== undefined
})

const currentValue = computed(() => {
  if (!activeField.value) return 'off'
  const meta = parseProp(activeField.value.meta)
  return meta?.autocomplete || autocompleteDefaults[activeField.value.uidt as UITypes] || 'off'
})

const currentLabel = computed(() => {
  const option = autocompleteOptions.value.find((opt) => opt.value === currentValue.value)
  return option?.label || currentValue.value
})

const setAutocompleteMeta = (value: string | undefined) => {
  if (!activeField.value) return

  const meta = parseProp(activeField.value.meta)
  if (value === undefined) {
    delete meta.autocomplete
  } else {
    meta.autocomplete = value
  }
  activeField.value.meta = meta
  updateColMeta(activeField.value)
}

const toggle = () => {
  if (!activeField.value) return

  if (isEnabled.value) {
    setAutocompleteMeta(undefined)
  } else {
    setAutocompleteMeta(autocompleteDefaults[activeField.value.uidt as UITypes] || 'on')
  }
}

const selectValue = (option: NcListItemType) => {
  if (!activeField.value) return

  setAutocompleteMeta(option.value as string)
  isDropdownOpen.value = false
}

const filterOption = (input: string, option: NcListItemType) => {
  const query = input.toLowerCase()
  return (
    (option.label?.toLowerCase().includes(query) ?? false) ||
    (String(option.value ?? '')
      .toLowerCase()
      .includes(query) ??
      false)
  )
}
</script>

<template>
  <div
    v-if="activeField?.uidt && columnSupportsAutocomplete(activeField.uidt)"
    class="nc-form-field-autocomplete-settings p-4 flex flex-col gap-4 border-b border-nc-border-gray-medium"
  >
    <div class="text-bodyBold text-nc-content-gray">
      {{ $t('general.browserAutofill') }}
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <div class="nc-form-input-autocomplete text-bodyDefaultSm text-nc-content-gray cursor-pointer" @click="toggle">
            {{ $t('general.autocomplete') }}
          </div>
          <div class="text-nc-content-gray-muted text-bodySm">
            {{ $t('general.autocompleteHint') }}
          </div>
        </div>

        <a-switch
          v-e="['a:form-view:field:toggle-autocomplete']"
          :checked="isEnabled"
          size="small"
          data-testid="nc-form-input-autocomplete"
          @change="toggle"
        />
      </div>

      <NcListDropdown v-if="isEnabled" v-model:is-open="isDropdownOpen">
        <div class="flex-1 flex items-center gap-2 min-w-0">
          <NcTooltip show-on-truncate-only class="flex-1 truncate">
            <span class="text-bodyDefaultSm truncate">{{ currentLabel }}</span>
            <template #title>{{ currentLabel }}</template>
          </NcTooltip>
          <GeneralIcon
            icon="ncChevronDown"
            class="flex-none h-4 w-4 transition-transform opacity-70"
            :class="{ 'transform rotate-180': isDropdownOpen }"
          />
        </div>
        <template #overlay="{ onEsc }">
          <NcList
            v-model:open="isDropdownOpen"
            :value="currentValue"
            :list="autocompleteOptions"
            :group-order="groupOrder"
            :filter-option="filterOption"
            variant="small"
            show-search-always
            class="nc-autocomplete-list !w-auto"
            data-testid="nc-form-autocomplete-list"
            @change="selectValue"
            @escape="onEsc"
          >
            <template #listItemExtraRight="{ option }">
              <span class="text-captionSm font-mono text-nc-content-gray-muted flex-none ml-auto">
                {{ option.value }}
              </span>
            </template>
          </NcList>
        </template>
      </NcListDropdown>
    </div>
  </div>
</template>
