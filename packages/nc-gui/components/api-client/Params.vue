<script setup lang="ts">
import { iconMap, useVModel } from '#imports'

const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

const addParamRow = () => vModel.value.push({})

const deleteParamRow = (i: number) => {
  if (vModel.value.length === 1) return

  vModel.value.splice(i, 1)
}
</script>

<template>
  <div class="flex flex-row justify-between w-full">
    <table class="w-full nc-webhooks-params">
      <thead class="h-8">
        <tr>
          <th>
            <div class="text-left font-normal ml-2" data-rec="true">{{ $t('title.parameterName') }}</div>
          </th>

          <th>
            <div class="text-left font-normal ml-2" data-rec="true">{{ $t('placeholder.value') }}</div>
          </th>

          <th class="w-8">
            <!-- Intended to be empty - For delete button -->
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(paramRow, idx) in vModel" :key="idx" class="!h-2 overflow-hidden">
          <td class="px-2">
            <a-form-item class="form-item">
              <a-input v-model:value="paramRow.name" :placeholder="$t('placeholder.key')" class="!rounded-lg" />
            </a-form-item>
          </td>

          <td class="px-2">
            <a-form-item class="form-item">
              <a-input v-model:value="paramRow.value" :placeholder="$t('placeholder.value')" class="!rounded-lg" />
            </a-form-item>
          </td>

          <td class="relative">
            <div
              class="absolute left-0 top-0.25 py-1 px-1.5 rounded-md border-1 border-gray-100"
              :class="{
                'text-gray-400 cursor-not-allowed bg-gray-50': vModel.length === 1,
                'text-gray-600 cursor-pointer hover:bg-gray-50  hover:text-black': vModel.length !== 1,
              }"
              @click="deleteParamRow(idx)"
            >
              <component :is="iconMap.delete" />
            </div>
          </td>
        </tr>

        <tr>
          <td :colspan="12" class="">
            <NcButton size="small" type="secondary" @click="addParamRow">
              <div class="flex flex-row items-center gap-x-1">
                <div data-rec="true">{{ $t('activity.addParameter') }}</div>
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
