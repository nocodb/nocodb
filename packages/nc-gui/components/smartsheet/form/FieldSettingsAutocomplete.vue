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
] as string[]

const columnSupportsAutocomplete = (elementType: string) => autocompleteUiTypes.includes(elementType)

const autocompleteOptions = computed<NcListItemType[]>(() => [
  { value: 'off', label: t('general.off'), ncGroupHeaderLabel: t('general.formAutocomplete.basic') },
  { value: 'on', label: t('general.on'), ncGroupHeaderLabel: t('general.formAutocomplete.basic') },
  { value: 'name', label: t('general.formAutocomplete.fullName'), ncGroupHeaderLabel: t('general.formAutocomplete.personal') },
  {
    value: 'given-name',
    label: t('general.formAutocomplete.firstName'),
    ncGroupHeaderLabel: t('general.formAutocomplete.personal'),
  },
  {
    value: 'family-name',
    label: t('general.formAutocomplete.lastName'),
    ncGroupHeaderLabel: t('general.formAutocomplete.personal'),
  },
  { value: 'email', label: t('general.formAutocomplete.email'), ncGroupHeaderLabel: t('general.formAutocomplete.personal') },
  { value: 'tel', label: t('general.formAutocomplete.phoneNumber'), ncGroupHeaderLabel: t('general.formAutocomplete.personal') },
  {
    value: 'organization',
    label: t('general.formAutocomplete.companyOrganization'),
    ncGroupHeaderLabel: t('general.formAutocomplete.personal'),
  },
  {
    value: 'organization-title',
    label: t('general.formAutocomplete.jobTitle'),
    ncGroupHeaderLabel: t('general.formAutocomplete.personal'),
  },
  { value: 'bday', label: t('general.formAutocomplete.birthday'), ncGroupHeaderLabel: t('general.formAutocomplete.personal') },
  {
    value: 'street-address',
    label: t('general.formAutocomplete.streetAddress'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'address-line1',
    label: t('general.formAutocomplete.addressLine1'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'address-line2',
    label: t('general.formAutocomplete.addressLine2'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'address-level2',
    label: t('general.formAutocomplete.city'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'address-level1',
    label: t('general.formAutocomplete.stateProvince'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'postal-code',
    label: t('general.formAutocomplete.postalZipCode'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  {
    value: 'country-name',
    label: t('general.formAutocomplete.country'),
    ncGroupHeaderLabel: t('general.formAutocomplete.address'),
  },
  { value: 'url', label: t('general.formAutocomplete.websiteUrl'), ncGroupHeaderLabel: t('general.formAutocomplete.web') },
  { value: 'username', label: t('general.formAutocomplete.username'), ncGroupHeaderLabel: t('general.formAutocomplete.web') },
])

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
