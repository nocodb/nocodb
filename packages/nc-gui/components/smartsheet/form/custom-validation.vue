<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const modelValue = useVModel(props, 'modelValue', emits)

const isOpen = ref(false)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="font-medium text-gray-800">Custom Validations</div>

      <div class="flex flex-col">
        <div
          class="border-1 rounded-lg py-1 pl-1 pr-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all"
          :class="{
            '!border-brand-500': isOpen,
            'border-gray-200': !isOpen,
          }"
        >
          <div class="flex-1">No Validations</div>

          <NcButton
            class="border-1 flex items-center justify-between !text-gray-800 !hover:text-gray-500 outline-none"
            type="link"
            size="xsmall"
          >
            <GeneralIcon icon="warning" class="flex-none w-4 h-4 !text-red-500" />
          </NcButton>

          <NcButton
            class="!border-none flex items-center justify-between !text-gray-600 !hover:text-gray-800"
            type="link"
            size="xsmall"
            @click="isOpen = !isOpen"
          >
            <GeneralIcon icon="settings" class="flex-none w-4 h-4" />
          </NcButton>
        </div>
        <NcDropdown v-model:visible="isOpen" placement="bottomLeft">
          <div></div>
          <template #overlay>
            <div class="p-4">
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
                    <div v-for="(number, i) of [1, 2, 3, 4]" class="tr">
                      <div class="td">selector</div>
                      <div class="td">selector</div>
                      <div class="td">selector</div>
                      <div class="td nc-custom-validation-delete-item">
                        <NcButton class="border-1 flex items-center justify-between" type="link" size="small">
                          <GeneralIcon icon="delete" class="flex-none h-4 w-4 text-gray-500 hover:text-gray-800" />
                        </NcButton>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <NcButton class="border-1 flex items-center justify-between" type="link" size="small">
                    <span class="text-sm"> Add Validation </span>
                    <GeneralIcon icon="plus" class="flex-none" />
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
</template>

<style scoped lang="scss">
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
      @apply px-3 py-1 w-[174px];
    }

    .th {
      @apply text-left uppercase text-gray-500 font-semibold;
    }

    .th:not(:last-child):not(:nth-last-child(2)) {
      @apply border-r-1  border-gray-200;
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
