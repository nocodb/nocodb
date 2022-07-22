<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import type { PluginType } from 'nocodb-sdk'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import MdiPlusIcon from '~icons/mdi/plus'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Props {
  id: string
}

type Plugin = PluginType & {
  formDetails: Record<string, any>
  parsedInput: Record<string, any>
}

const { id } = defineProps<Props>()

const emits = defineEmits(['saved'])

enum Action {
  Save = 'save',
  Test = 'test',
}

const toast = useToast()

const { $api } = useNuxtApp()

const formRef = ref()

let plugin = $ref<Plugin | null>(null)
let pluginFormData = $ref<Record<string, any>>({})
let isLoading = $ref(true)
let loadingAction = $ref<null | Action>(null)

const addSetting = () => pluginFormData.push({})

const saveSettings = async () => {
  loadingAction = Action.Save

  try {
    await formRef.value?.validateFields()

    await $api.plugin.update(id, {
      input: JSON.stringify(pluginFormData),
      active: true,
    })

    emits('saved')
    toast.success(plugin?.formDetails.msgOnInstall || 'Plugin settings saved successfully')
  } catch (_e: any) {
    const e = await extractSdkResponseErrorMsg(_e)
    toast.error(e.message)
  } finally {
    loadingAction = null
  }
}

const testSettings = async () => {
  loadingAction = Action.Test

  try {
    const res = await $api.plugin.test({
      input: pluginFormData,
      id: plugin?.id,
      category: plugin?.category,
      title: plugin?.title,
    })

    if (res) {
      toast.success('Successfully tested plugin settings')
    } else {
      toast.info('Invalid credentials')
    }
  } catch (_e: any) {
    const e = await extractSdkResponseErrorMsg(_e)
    toast.error(e.message)
  } finally {
    loadingAction = null
  }
}

const doAction = async (action: Action) => {
  switch (action) {
    case Action.Save:
      await saveSettings()
      break
    case Action.Test:
      await testSettings()
      break
    default:
      // noop
      break
  }
}

const readPluginDetails = async () => {
  try {
    isLoading = true

    const res = await $api.plugin.read(id)
    const formDetails = JSON.parse(res.input_schema ?? '{}')
    const emptyParsedInput = formDetails.array ? [{}] : {}
    const parsedInput = res.input ? JSON.parse(res.input) : emptyParsedInput

    plugin = { ...res, formDetails, parsedInput }
    pluginFormData = plugin.parsedInput
  } catch (e) {
    console.log(e)
  } finally {
    isLoading = false
  }
}

const deleteFormRow = (index: number) => pluginFormData.splice(index, 1)

onMounted(async () => {
  if (!plugin) {
    await readPluginDetails()
  }
})
</script>

<template>
  <div v-if="isLoading" class="flex flex-row w-full justify-center items-center h-52">
    <a-spin size="large" />
  </div>

  <template v-else>
    <div class="flex flex-col">
      <div class="flex flex-row justify-center pb-4 mb-2 border-b-1 w-full gap-x-1">
        <div
          v-if="plugin.logo"
          class="mr-1 flex items-center justify-center"
          :class="[plugin.title === 'SES' ? 'p-2 bg-[#242f3e]' : '']"
        >
          <img :src="`/${plugin.logo}`" class="h-6" />
        </div>

        <span class="font-semibold text-lg">{{ plugin.formDetails.title }}</span>
      </div>

      <a-form ref="formRef" :model="pluginFormData" class="mx-auto mt-2">
        <!-- Form with multiple entry -->
        <table v-if="plugin.formDetails.array" class="form-table">
          <thead>
            <tr>
              <th v-for="(columnData, columnIndex) in plugin.formDetails.items" :key="columnIndex">
                <div class="text-center font-normal">
                  {{ columnData.label }} <span v-if="columnData.required" class="text-red-600">*</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(itemRow, itemIndex) in plugin.parsedInput" :key="itemIndex">
              <td v-for="(columnData, columnIndex) in plugin.formDetails.items" :key="columnIndex" class="px-2">
                <a-form-item
                  :name="[`${itemIndex}`, columnData.key]"
                  :rules="[{ required: columnData.required, message: `${columnData.label} is required` }]"
                >
                  <a-input-password
                    v-if="columnData.type === 'Password'"
                    v-model:value="itemRow[columnData.key]"
                    :placeholder="columnData.placeholder"
                  />
                  <a-textarea
                    v-else-if="columnData.type === 'LongText'"
                    v-model:value="itemRow[columnData.key]"
                    :placeholder="columnData.placeholder"
                  />
                  <a-switch
                    v-else-if="columnData.type === 'Checkbox'"
                    v-model:value="itemRow[columnData.key]"
                    :placeholder="columnData.placeholder"
                  />
                  <a-input v-else v-model:value="itemRow[columnData.key]" :placeholder="columnData.placeholder" />
                </a-form-item>
              </td>
              <td v-if="itemIndex !== 0" class="pb-4">
                <MdiDeleteOutlineIcon class="hover:text-red-400 cursor-pointer" @click="deleteFormRow(itemIndex)" />
              </td>
            </tr>
          </tbody>

          <tr>
            <td :colspan="plugin.formDetails.items.length" class="text-center">
              <a-button type="default" class="!bg-gray-100 rounded-md border-none" @click="addSetting">
                <template #icon>
                  <MdiPlusIcon class="flex mx-auto" />
                </template>
              </a-button>
            </td>
          </tr>
        </table>

        <!-- Form with only one entry -->
        <div v-else>
          <a-form-item
            v-for="(columnData, i) in plugin.formDetails.items"
            :key="i"
            :label="columnData.label"
            :name="columnData.key"
            :rules="[{ required: columnData.required, message: `${columnData.label} is required` }]"
          >
            <a-input-password
              v-if="columnData.type === 'Password'"
              v-model:value="pluginFormData[columnData.key]"
              :placeholder="columnData.placeholder"
            />
            <a-textarea
              v-else-if="columnData.type === 'LongText'"
              v-model:value="pluginFormData[columnData.key]"
              :placeholder="columnData.placeholder"
            />
            <a-switch
              v-else-if="columnData.type === 'Checkbox'"
              v-model:checked="pluginFormData[columnData.key]"
              :placeholder="columnData.placeholder"
            />
            <a-input v-else v-model:value="pluginFormData[columnData.key]" :placeholder="columnData.placeholder" />
          </a-form-item>
        </div>
        <div class="flex flex-row space-x-4 justify-center mt-4">
          <a-button
            v-for="(action, i) in plugin.formDetails.actions"
            :key="i"
            :loading="loadingAction === action.key"
            :type="action.key === Action.Save ? 'primary' : 'default'"
            :disabled="!!loadingAction"
            @click="doAction(action.key)"
          >
            {{ action.label }}
          </a-button>
        </div>
      </a-form>
    </div>
  </template>
</template>

<style scoped lang="scss">
.form-table {
  @apply border-none min-w-[400px];
}

tbody tr:nth-of-type(odd) {
  @apply bg-transparent;
}
</style>
