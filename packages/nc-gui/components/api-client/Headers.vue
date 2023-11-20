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
const filterOption = (input: string, option: Option) => option.value.toUpperCase().includes(input.toUpperCase())
</script>

<template>
  <div class="flex flex-row justify-between w-full">
    <table class="w-full nc-webhooks-params">
      <thead class="h-8">
        <tr>
          <th></th>
          <th>
            <div class="text-left font-normal ml-2" data-rec="true">{{ $t('labels.headerName') }}</div>
          </th>
          <th>
            <div class="text-left font-normal ml-2" data-rec="true">{{ $t('placeholder.value') }}</div>
          </th>
          <th class="w-8"></th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(headerRow, idx) in vModel" :key="idx" class="!h-2 overflow-hidden">
          <td class="px-2 nc-hook-header-tab-checkbox">
            <a-form-item class="form-item">
              <a-checkbox v-model:checked="headerRow.enabled" />
            </a-form-item>
          </td>

          <td class="px-2">
            <a-form-item class="form-item">
              <a-auto-complete
                v-model:value="headerRow.name"
                class="nc-input-hook-header-key"
                :options="headerList"
                :placeholder="$t('placeholder.key')"
                :filter-option="filterOption"
              />
            </a-form-item>
          </td>

          <td class="px-2">
            <a-form-item class="form-item">
              <a-input
                v-model:value="headerRow.value"
                :placeholder="$t('placeholder.value')"
                class="!rounded-md nc-input-hook-header-value"
              />
            </a-form-item>
          </td>

          <td class="relative">
            <div
              v-if="idx !== 0"
              class="absolute left-0 top-0.25 py-1 px-1.5 rounded-md border-1 border-gray-100"
              :class="{
                'text-gray-400 cursor-not-allowed bg-gray-50': vModel.length === 1,
                'text-gray-600 cursor-pointer hover:bg-gray-50  hover:text-black': vModel.length !== 1,
              }"
              @click="deleteHeaderRow(idx)"
            >
              <component :is="iconMap.delete" />
            </div>
          </td>
        </tr>

        <tr>
          <td :colspan="12" class="">
            <NcButton size="small" type="secondary" @click="addHeaderRow">
              <div class="flex flex-row items-center gap-x-1">
                <div data-rec="true">{{ $t('labels.addHeader') }}</div>
                <component :is="iconMap.plus" class="flex mx-auto" />
              </div>
            </NcButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
.form-item {
  @apply !mb-3;
}
</style>
