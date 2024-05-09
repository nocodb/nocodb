<script setup lang="ts">
import type { ColumnType, Validation } from 'nocodb-sdk'
import { StringValidationType, ValidationTypeLabel } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    modelValue: Validation[]
    formFieldState?: string | null
    column: ColumnType
  }>(),
  {
    modelValue: () => [],
  },
)

const emits = defineEmits(['update:modelValue'])

const validators = useVModel(props, 'modelValue', emits)

const validatorsMap = computed(() => {
  return (validators.value || []).reduce((acc, curr) => {
    if (curr.type) {
      acc[curr.type] = curr
    }
    return acc
  }, {} as Record<Exclude<Validation['type'], null>, Validation>)
})

const { column } = toRefs(props)

const isOpen = ref(false)

const { sqlUis } = storeToRefs(useBase())

const sqlUi = ref(column.value?.source_id ? sqlUis.value[column.value?.source_id] : Object.values(sqlUis.value)[0])

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const columnType = computed(() => {
  if (isString(column.value, abstractType.value)) {
    return 'string'
  }
})

const options = computed(() => {
  return Object.values(StringValidationType).reduce((acc, curr) => {
    if (curr === StringValidationType.Email) return acc
    acc.push({
      value: curr,
      label: ValidationTypeLabel[curr],
    })
    return acc
  }, [] as { value: StringValidationType; label: string }[])
})

const addPlaceholderValidator = () => {
  validators.value.push({
    type: null,
    value: null,
    message: '',
    regex: null,
  })
}

const handleRemoveValidator = (index: number) => {
  validators.value.splice(index, 1)
}

watch(
  validators,
  (next) => {
    validators.value = [...next]
    emits('update:modelValue', validators.value)
  },
  {
    deep: true,
  },
)
watch(
  column,
  (next) => {
    console.log('column', next)
  },
  {
    deep: true,
  },
)
</script>

<template>
  <div v-if="columnType === 'string'" class="nc-form-field-settings p-4 border-b border-gray-200">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="text-base font-bold">Custom Validations</div>

        <div class="flex flex-col">
          <div
            class="border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all"
            :class="{
              '!border-brand-500': isOpen,
              'border-gray-200': !isOpen,
              'bg-[#F0F3FF]': modelValue.length,
            }"
          >
            <div
              class="flex-1"
              :class="{
                'text-brand-500 ': modelValue.length,
              }"
            >
              {{ modelValue.length ? `${modelValue.length} validations` : 'No validations' }}
            </div>

            <!-- <NcButton
              v-if="false"
              class="flex items-center justify-between !text-gray-800 !hover:text-gray-500 !min-w-4"
              type="link"
              size="xsmall"
            >
              <GeneralIcon icon="warning" class="flex-none w-4 h-4 !text-red-500" />
            </NcButton> -->

            <NcButton
              class="!border-none flex items-center justify-between !text-gray-600 !hover:text-gray-800 !min-w-4"
              type="link"
              size="xsmall"
              @click="isOpen = !isOpen"
            >
              <GeneralIcon icon="settings" class="flex-none w-4 h-4" />
            </NcButton>
          </div>
          <NcDropdown v-model:visible="isOpen" placement="bottomLeft" overlay-class-name="nc-custom-validator-dropdown">
            <div></div>
            <template #overlay>
              <div class="p-4 nc-custom-validator-dropdown-container">
                <div class="flex flex-col gap-3">
                  <div class="nc-custom-validation-table table">
                    <div class="thead">
                      <div class="tr">
                        <div class="th">Validator</div>
                        <div class="th">Validation Value</div>
                        <div class="th">Warning Message</div>
                        <div class="th"></div>
                      </div>
                    </div>
                    <div class="tbody">
                      <template v-if="validators.length">
                        <LazySmartsheetFormCustomValidationItem
                          v-for="(validator, i) of validators"
                          :key="i"
                          class="tr"
                          :validator="validator"
                          :options="options"
                          :validators-map="validatorsMap"
                          @remove="handleRemoveValidator(i)"
                        ></LazySmartsheetFormCustomValidationItem>
                      </template>
                      <div v-else class="tr flex items-center justify-center text-gray-500">No validations</div>
                    </div>
                  </div>
                  <div>
                    <NcButton class="border-1 flex items-center" type="link" size="small" @click="addPlaceholderValidator">
                      <div class="flex items-center gap-2">
                        <span class="text-sm"> Add Validation </span>
                        <GeneralIcon icon="plus" class="flex-none" />
                      </div>
                    </NcButton>
                  </div>
                </div>
              </div>
            </template>
          </NcDropdown>
        </div>
      </div>
      <div class="text-sm">Apply rules and regular expressions on inputs.</div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-custom-validation-table {
  @apply border-none text-sm rounded-md;

  .thead .tr {
    @apply bg-gray-100 rounded-t-lg;
  }

  .tbody {
    .tr {
      @apply border-t-0;
    }
    .tr:last-child {
      @apply rounded-b-lg;

      .td:last-child {
        @apply rounded-br-md;
      }
    }
  }

  .tr {
    @apply h-[32px] flex overflow-hidden border-1  border-gray-200;

    .th:not(:last-child),
    .td:not(:last-child) {
      @apply px-3 py-1 w-[174px] h-full;
    }

    .td:not(:last-child) {
      @apply p-0;
    }

    .th {
      @apply text-left uppercase text-gray-500 font-semibold;
    }

    .th:not(:last-child):not(:nth-last-child(2)) {
      @apply border-r-1  border-gray-200;
    }

    .th:last-child {
      @apply min-w-8;
    }

    .td:not(:last-child) {
      @apply border-r-1  border-gray-200;
    }
    .td:last-child {
      @apply px-0;
    }
  }
}
</style>
