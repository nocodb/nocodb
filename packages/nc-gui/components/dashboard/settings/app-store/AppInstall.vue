<script setup lang="ts">
import type { PluginTestReqType, PluginType } from 'nocodb-sdk'

const { id } = defineProps<{
  id: string
}>()

const emits = defineEmits(['saved', 'close'])

enum Action {
  Save = 'save',
  Test = 'test',
}

type Plugin = PluginType & {
  formDetails: Record<string, any>
  parsedInput: Record<string, any>
}

const { $api } = useNuxtApp()

const formRef = ref()

const { t } = useI18n()

const plugin = ref<Plugin | null>(null)

const pluginFormData = ref<Record<string, any>>({})

const isLoading = ref(true)

const loadingAction = ref<null | Action>(null)

const layout = {
  labelCol: { span: 14, pull: 4 },
  wrapperCol: { span: 20, pull: 4 },
}

const addSetting = () => pluginFormData.value.push({})

const saveSettings = async () => {
  loadingAction.value = Action.Save

  try {
    await formRef.value?.validateFields()

    await $api.plugin.update(id, {
      input: JSON.stringify(pluginFormData.value),
      active: true,
    })

    emits('saved')
    // Plugin settings saved successfully
    message.success(plugin.value?.formDetails.msgOnInstall || t('msg.success.pluginSettingsSaved'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    loadingAction.value = null
  }
}

const testSettings = async () => {
  loadingAction.value = Action.Test

  try {
    if (plugin.value) {
      const res = await $api.plugin.test({
        input: JSON.stringify(pluginFormData.value),
        title: plugin.value.title,
        category: plugin.value.category,
      } as PluginTestReqType)

      if (res) {
        // Successfully tested plugin settings
        message.success(t('msg.success.pluginTested'))
      } else {
        // Invalid credentials
        message.info(t('msg.info.invalidCredentials'))
      }
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    loadingAction.value = null
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
    isLoading.value = true

    const res = await $api.plugin.read(id)
    const formDetails = JSON.parse(res.input_schema ?? '{}')
    const emptyParsedInput = formDetails.array ? [{}] : {}
    const parsedInput = typeof res.input === 'string' ? JSON.parse(res.input) : emptyParsedInput

    // the type of 'secure' was XcType.SingleLineText in 0.0.1
    // and it has been changed to XcType.Checkbox, since 0.0.2
    // hence, change the text value to boolean here
    if ('secure' in parsedInput && typeof parsedInput.secure === 'string') {
      parsedInput.secure = parsedInput.secure === 'true'
    }

    plugin.value = { ...res, formDetails, parsedInput }
    pluginFormData.value = plugin.value.parsedInput
  } catch (e) {
    console.log(e)
  } finally {
    isLoading.value = false
  }
}

const deleteFormRow = (index: number) => pluginFormData.value.splice(index, 1)

onMounted(async () => {
  if (!plugin.value) {
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
      <div class="w-full relative">
        <div class="flex flex-row justify-center pb-4 mb-2 border-b-1 w-full gap-x-1">
          <div
            v-if="plugin.logo"
            class="mr-1 flex items-center justify-center"
            :class="[plugin.title === 'SES' ? 'p-2 bg-[#242f3e]' : '']"
          >
            <img :alt="plugin.title || 'plugin'" :src="plugin.logo" class="h-6" />
          </div>

          <span class="font-semibold text-lg">{{ plugin.formDetails.title }}</span>
        </div>

        <div class="absolute -right-2 -top-0.5">
          <a-button type="text" class="!rounded-md mr-1" @click="emits('close')">
            <template #icon>
              <MaterialSymbolsCloseRounded class="flex mx-auto" />
            </template>
          </a-button>
        </div>
      </div>

      <a-form ref="formRef" v-bind="plugin?.formDetails.array ? {} : layout" :model="pluginFormData" class="mx-4 mt-3">
        <!-- Form with multiple entry -->
        <div v-if="plugin.formDetails.array" class="flex flex-row justify-center">
          <table>
            <thead>
              <tr>
                <th v-for="(columnData, columnIndex) in plugin.formDetails.items" :key="columnIndex">
                  <div class="text-center font-normal mb-2">
                    {{ columnData.label }} <span v-if="columnData.required" class="text-red-600">*</span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(itemRow, itemIndex) in plugin.parsedInput" :key="itemIndex">
                <td v-for="(columnData, columnIndex) in plugin.formDetails.items" :key="columnIndex" class="px-2">
                  <a-form-item
                    class="relative mb-3"
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

                    <div
                      v-if="itemIndex !== 0 && columnIndex === plugin.formDetails.items.length - 1"
                      class="absolute flex flex-col justify-start mt-2 -right-6 top-0"
                    >
                      <component
                        :is="iconMap.delete"
                        class="hover:text-red-400 cursor-pointer"
                        @click="deleteFormRow(itemIndex)"
                      />
                    </div>
                  </a-form-item>
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <td :colspan="plugin.formDetails.items.length" class="text-center">
                  <a-button type="default" class="!bg-gray-100 rounded-md border-none mr-1" @click="addSetting">
                    <template #icon>
                      <component :is="iconMap.plus" class="flex mx-auto" />
                    </template>
                  </a-button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Form with only one entry -->
        <template v-else>
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
        </template>

        <div class="flex flex-row space-x-4 justify-center mt-4">
          <NcButton
            v-for="(action, i) in plugin.formDetails.actions"
            :key="i"
            class="!px-5"
            :loading="loadingAction === action.key"
            :type="action.key === Action.Save ? 'primary' : 'default'"
            :disabled="!!loadingAction"
            @click="doAction(action.key)"
          >
            {{ action.label }}
          </NcButton>
        </div>
      </a-form>
    </div>
  </template>
</template>
