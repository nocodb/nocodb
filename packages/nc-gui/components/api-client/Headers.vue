<script setup lang="ts">
import { iconMap, useVModel } from '#imports'

const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

interface Option {
  value: string
}

const vModel = useVModel(props, 'modelValue', emits)

const headerList = ref<Option[]>([
  { value: 'A-IM' },
  { value: 'Accept' },
  { value: 'Accept-Charset' },
  { value: 'Accept-Encoding' },
  { value: 'Accept-Language' },
  { value: 'Accept-Datetime' },
  { value: 'Access-Control-Request-Method' },
  { value: 'Access-Control-Request-Headers' },
  { value: 'Authorization' },
  { value: 'Cache-Control' },
  { value: 'Connection' },
  { value: 'Content-Length' },
  { value: 'Content-Type' },
  { value: 'Cookie' },
  { value: 'Date' },
  { value: 'Expect' },
  { value: 'Forwarded' },
  { value: 'From' },
  { value: 'Host' },
  { value: 'If-Match' },
  { value: 'If-Modified-Since' },
  { value: 'If-None-Match' },
  { value: 'If-Range' },
  { value: 'If-Unmodified-Since' },
  { value: 'Max-Forwards' },
  { value: 'Origin' },
  { value: 'Pragma' },
  { value: 'Proxy-Authorization' },
  { value: 'Range' },
  { value: 'Referer' },
  { value: 'TE' },
  { value: 'User-Agent' },
  { value: 'Upgrade' },
  { value: 'Via' },
  { value: 'Warning' },
  { value: 'Non-standard headers' },
  { value: 'Dnt' },
  { value: 'X-Requested-With' },
  { value: 'X-CSRF-Token' },
])

const addHeaderRow = () => vModel.value.push({})

const deleteHeaderRow = (i: number) => vModel.value.splice(i, 1)

const filterOption = (input: string, option: Option) => {
  return option.value.toUpperCase().includes(input.toUpperCase())
}
</script>

<template>
  <div class="flex flex-row justify-center">
    <table>
      <thead>
        <tr>
          <th>
            <!-- Intended to be empty - For checkbox -->
          </th>

          <th>
            <div class="text-center font-normal mb-2">Header Name</div>
          </th>

          <th>
            <div class="text-center font-normal mb-2">Value</div>
          </th>

          <th>
            <!-- Intended to be empty - For delete button -->
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(headerRow, idx) in vModel" :key="idx">
          <td class="px-2 nc-hook-header-tab-checkbox">
            <a-form-item>
              <a-checkbox v-model:checked="headerRow.enabled" />
            </a-form-item>
          </td>

          <td class="px-2 w-min-[400px]">
            <a-form-item>
              <a-auto-complete
                v-model:value="headerRow.name"
                size="large"
                placeholder="Key"
                class="nc-input-hook-header-key"
                :options="headerList"
                :filter-option="filterOption"
              />
            </a-form-item>
          </td>

          <td class="px-2 w-min-[400px]">
            <a-form-item>
              <a-input v-model:value="headerRow.value" size="large" placeholder="Value" class="nc-input-hook-header-value" />
            </a-form-item>
          </td>

          <td class="relative">
            <div v-if="idx !== 0" class="absolute flex flex-col justify-start mt-2 -right-6 top-0">
              <component :is="iconMap.delete" class="cursor-pointer" @click="deleteHeaderRow(idx)" />
            </div>
          </td>
        </tr>

        <tr>
          <td :colspan="12" class="text-center">
            <a-button type="default" class="!bg-gray-100 rounded-md border-none mr-1" @click="addHeaderRow">
              <template #icon>
                <component :is="iconMap.plus" class="flex mx-auto" />
              </template>
            </a-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
