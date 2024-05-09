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
          class="border-1 rounded-lg py-1 pl-1 pr-3 flex items-center justify-between gap-2 !min-w-[170px]"
          :class="{
            '!border-brand-500': isOpen,
            'border-gray-200': !isOpen,
          }"
        >
          <div class="flex-1">No Validations</div>

          <NcButton
            class="border-1 flex items-center justify-between !text-gray-800 !hover:text-gray-500 outline-none"
            :class="{
              '!border-brand-500': isOpen,
              'border-gray-200': !isOpen,
            }"
            type="link"
            size="xsmall"
          >
            <GeneralIcon icon="warning" class="flex-none w-4 h-4 !text-red-500" />
          </NcButton>

          <NcButton
            class="!border-none flex items-center justify-between !text-gray-800 !hover:text-gray-500"
            :class="{
              '!border-brand-500': isOpen,
              'border-gray-200': !isOpen,
            }"
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
                <div>
                  <table class="nc-custom-validation-table" border="1">
                    <thead>
                      <tr>
                        <th>Validator</th>
                        <th>Validation Value</th>
                        <th>Warning Message</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>selector</td>
                        <td>selector</td>
                        <td>selector</td>
                        <td class="nc-custom-validation-delete-item">
                          <GeneralIcon icon="delete" class="h-4 w-4 text-gray-600 hover:text-gray-800" />
                        </td>
                      </tr>
                      <tr>
                        <td>selector</td>
                        <td>selector</td>
                        <td>selector</td>
                        <td class="nc-custom-validation-delete-item">
                          <GeneralIcon icon="delete" class="h-4 w-4 text-gray-600 hover:text-gray-800" />
                        </td>
                      </tr>
                      <tr>
                        <td>selector</td>
                        <td>selector</td>
                        <td>selector</td>
                        <td class="nc-custom-validation-delete-item">
                          <GeneralIcon icon="delete" class="h-4 w-4 text-gray-600 hover:text-gray-800" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
  @apply border-1 border-gray-200 !rounded-lg border-collapse;
  thead tr {
    @apply bg-gray-100 rounded-t-lg;
  }
  tr {
    th:not(:last-child),
    td:not(:last-child) {
      @apply px-3 py-1 w-[174px];
    }
    th:last-child,
    td:last-child {
      @apply p-0;
    }
    th {
      @apply text-left uppercase text-gray-500 font-semibold;
    }
    td:last-child {
      @apply flex items-center justify-between p-2 border-b-1 border-gray-200;
    }

    th:not(:last-child):not(:nth-last-child(2)) {
      @apply border-b border-r border-1 border-gray-200;
    }
    th:last-child {
      @apply border-b-1 border-gray-200;
    }
    td:not(:last-child) {
      @apply border-b border-r border-1 border-gray-200;
    }
  }
}
</style>
