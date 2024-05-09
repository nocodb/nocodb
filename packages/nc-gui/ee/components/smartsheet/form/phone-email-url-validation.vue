<script setup lang="ts">
import { StringValidationType, UITypes, type Validation } from 'nocodb-sdk'

const validatorMap = {
  [UITypes.Email]: StringValidationType.Email,
  [UITypes.PhoneNumber]: StringValidationType.PhoneNumber,
  [UITypes.URL]: StringValidationType.Url,
}

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const isDefaultValidateEnabled = computed(() => !!parseProp(activeField.value?.meta)?.validate)

const isValidateEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return val.type === validatorMap[activeField.value.uidt]
    })
  )
})
const isBusinessEmailEnabled = computed(() => {
  return !!(
    activeField.value &&
    ((activeField.value.meta.validators || []) as Validation[]).find((val) => {
      return val.type === StringValidationType.BusinessEmail
    })
  )
})

const title = computed(() => {
  if (activeField.value?.uidt === UITypes.Email) {
    return 'Validate email'
  }
  if (activeField.value?.uidt === UITypes.PhoneNumber) {
    return 'Validate phone number'
  }
  if (activeField.value?.uidt === UITypes.URL) {
    return 'Validate URL'
  }
})

const addPlaceholderValidators = (value, type: 'validate' | 'businessEmail') => {
  if (!activeField.value) return

  switch (type) {
    case 'validate': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: validatorMap[activeField.value.uidt],
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return ![validatorMap[activeField.value.uidt], StringValidationType.BusinessEmail].includes(val.type)
        })
      }
      updateColMeta(activeField.value)
      break
    }
    case 'businessEmail': {
      if (value) {
        activeField.value.meta.validators = [
          ...(activeField.value.meta.validators || []),
          {
            type: StringValidationType.BusinessEmail,
          },
        ]
      } else {
        activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
          return val.type !== StringValidationType.BusinessEmail
        })
      }
      updateColMeta(activeField.value)
      break
    }
  }
}
</script>

<template v-if="activeField">
  <div class="w-full flex items-center justify-between gap-3">
    <div class="max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800"
        :class="{
          'cursor-pointer select-none': !isDefaultValidateEnabled,
        }"
        @click="
          () => {
            if (!isDefaultValidateEnabled) {
              addPlaceholderValidators(!isValidateEnabled, 'validate')
            }
          }
        "
      >
        {{ title }}
      </div>
    </div>

    <NcTooltip v-if="isDefaultValidateEnabled" class="flex" placement="topRight">
      <template #title> Validations enforced by field schema settings</template>
      <a-switch :checked="isDefaultValidateEnabled" :disabled="true" size="small" class="flex-none nc-form-switch-focus" />
    </NcTooltip>

    <a-switch
      v-else
      :checked="isValidateEnabled"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, 'validate')"
    />
  </div>
  <div
    v-if="activeField?.uidt === UITypes.Email && (isValidateEnabled || isDefaultValidateEnabled)"
    class="w-full flex items-center justify-between gap-3"
  >
    <div class="max-w-[calc(100%_-_40px)]">
      <div
        class="font-medium text-gray-800 cursor-pointer select-none"
        @click="addPlaceholderValidators(!isBusinessEmailEnabled, 'businessEmail')"
      >
        Accept only work email
      </div>
    </div>

    <a-switch
      :checked="isBusinessEmailEnabled"
      size="small"
      class="flex-none nc-form-switch-focus"
      @change="addPlaceholderValidators($event, 'businessEmail')"
    />
  </div>
</template>
