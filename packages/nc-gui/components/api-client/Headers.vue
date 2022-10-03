<script setup lang="ts">
import { useVModel } from '#imports'

const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

const headerList = [
  'A-IM',
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Accept-Datetime',
  'Access-Control-Request-Method',
  'Access-Control-Request-Headers',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Date',
  'Expect',
  'Forwarded',
  'From',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Max-Forwards',
  'Origin',
  'Pragma',
  'Proxy-Authorization',
  'Range',
  'Referer',
  'TE',
  'User-Agent',
  'Upgrade',
  'Via',
  'Warning',
  'Non-standard headers',
  'Dnt',
  'X-Requested-With',
  'X-CSRF-Token',
]

const addHeaderRow = () => vModel.value.push({})

const deleteHeaderRow = (i: number) => vModel.value.splice(i, 1)
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
              <a-select
                v-model:value="headerRow.name"
                size="large"
                placeholder="Key"
                class="nc-input-hook-header-key"
                dropdown-class-name="nc-dropdown-webhook-header"
                show-search
              >
                <a-select-option v-for="header in headerList" :key="header" :value="header">
                  {{ header }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </td>

          <td class="px-2 w-min-[400px]">
            <a-form-item>
              <a-input v-model:value="headerRow.value" size="large" placeholder="Value" class="nc-input-hook-header-value" />
            </a-form-item>
          </td>

          <td class="relative">
            <div v-if="idx !== 0" class="absolute flex flex-col justify-start mt-2 -right-6 top-0">
              <MdiDeleteOutline class="cursor-pointer" @click="deleteHeaderRow(idx)" />
            </div>
          </td>
        </tr>

        <tr>
          <td :colspan="12" class="text-center">
            <a-button type="default" class="!bg-gray-100 rounded-md border-none mr-1" @click="addHeaderRow">
              <template #icon>
                <MdiPlus class="flex mx-auto" />
              </template>
            </a-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
