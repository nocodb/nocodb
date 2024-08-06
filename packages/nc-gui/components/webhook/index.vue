<script setup lang="ts">
import type { HookReqType, HookType } from 'nocodb-sdk'
import type { Ref } from 'vue'

import { extractNextDefaultName } from '~/helpers/parsers/parserHelpers'
import { Form, iconMap, ref } from '#imports'

interface Props {
  value: boolean
  hook?: HookType
}

const props = defineProps<Props>()

const emits = defineEmits(['close'])

const { t } = useI18n()

const { $e } = useNuxtApp()

const { api, isLoading: loading } = useApi()

const modalVisible = useVModel(props, 'value')

const { hooks } = storeToRefs(useWebhooksStore())

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const defaultHookName = t('labels.webhook')

const webhookTestRef = ref()

const testSuccess = ref()

const useForm = Form.useForm

let hookRef = reactive<
  Omit<HookType, 'notification'> & { notification: Record<string, any>; eventOperation?: string; condition: boolean }
>({
  id: '',
  title: defaultHookName,
  event: undefined,
  operation: undefined,
  eventOperation: undefined,
  notification: {
    type: 'URL',
    payload: {
      method: 'POST',
      body: '{{ json event }}',
      headers: [{}],
      parameters: [{}],
      path: '',
    },
  },
  condition: false,
  active: true,
  version: 'v2',
})

const isBodyShown = ref(hookRef.version === 'v1' || isEeUI)

const urlTabKey = ref<'params' | 'headers' | 'body'>('params')

const apps: Record<string, any> = ref()

const slackChannels = ref<Record<string, any>[]>([])

const teamsChannels = ref<Record<string, any>[]>([])

const discordChannels = ref<Record<string, any>[]>([])

const mattermostChannels = ref<Record<string, any>[]>([])

const filterRef = ref()

const titleDomRef = ref<HTMLInputElement | undefined>()

const formInput = ref({
  'Email': [
    {
      key: 'to',
      label: t('labels.toAddress'),
      placeholder: t('labels.toAddress'),
      type: 'SingleLineText',
      required: true,
    },
    {
      key: 'subject',
      label: t('labels.subject'),
      placeholder: t('labels.subject'),
      type: 'SingleLineText',
      required: true,
    },
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
  ],
  'Slack': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
  ],
  'Microsoft Teams': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
  ],
  'Discord': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
  ],
  'Mattermost': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
  ],
  'Twilio': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
    {
      key: 'to',
      label: t('labels.commaSeparatedMobileNumber'),
      placeholder: t('labels.commaSeparatedMobileNumber'),
      type: 'LongText',
      required: true,
    },
  ],
  'Whatsapp Twilio': [
    {
      key: 'body',
      label: t('labels.body'),
      placeholder: t('labels.body'),
      type: 'LongText',
      required: true,
    },
    {
      key: 'to',
      label: t('labels.commaSeparatedMobileNumber'),
      placeholder: t('labels.commaSeparatedMobileNumber'),
      type: 'LongText',
      required: true,
    },
  ],
})

const eventList = ref<Record<string, any>[]>([
  { text: [t('general.after'), t('general.insert')], value: ['after', 'insert'] },
  { text: [t('general.after'), t('general.update')], value: ['after', 'update'] },
  { text: [t('general.after'), t('general.delete')], value: ['after', 'delete'] },
  { text: [t('general.after'), t('general.bulkInsert')], value: ['after', 'bulkInsert'] },
  { text: [t('general.after'), t('general.bulkUpdate')], value: ['after', 'bulkUpdate'] },
  { text: [t('general.after'), t('general.bulkDelete')], value: ['after', 'bulkDelete'] },
])

const notificationList = computed(() => {
  return isEeUI
    ? [{ type: 'URL', text: t('datatype.URL') }]
    : [
        { type: 'URL', text: t('datatype.URL') },
        { type: 'Email', text: t('datatype.Email') },
        { type: 'Slack', text: t('general.slack') },
        { type: 'Microsoft Teams', text: t('general.microsoftTeams') },
        { type: 'Discord', text: t('general.discord') },
        { type: 'Mattermost', text: t('general.matterMost') },
        { type: 'Twilio', text: t('general.twilio') },
        { type: 'Whatsapp Twilio', text: t('general.whatsappTwilio') },
      ]
})

const methodList = [
  { title: 'GET' },
  { title: 'POST' },
  { title: 'DELETE' },
  { title: 'PUT' },
  { title: 'HEAD' },
  { title: 'PATCH' },
]

const validators = computed(() => {
  return {
    'title': [fieldRequiredValidator()],
    'eventOperation': [fieldRequiredValidator()],
    'notification.type': [fieldRequiredValidator()],
    ...(hookRef.notification.type === 'URL' && {
      'notification.payload.method': [fieldRequiredValidator()],
      'notification.payload.path': [fieldRequiredValidator()],
    }),
    ...(hookRef.notification.type === 'Email' && {
      'notification.payload.to': [fieldRequiredValidator()],
      'notification.payload.subject': [fieldRequiredValidator()],
      'notification.payload.body': [fieldRequiredValidator()],
    }),
    ...(['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hookRef.notification.type) && {
      'notification.payload.channels': [fieldRequiredValidator()],
      'notification.payload.body': [fieldRequiredValidator()],
    }),
    ...((hookRef.notification.type === 'Twilio' || hookRef.notification.type === 'Whatsapp Twilio') && {
      'notification.payload.body': [fieldRequiredValidator()],
      'notification.payload.to': [fieldRequiredValidator()],
    }),
  }
})
const { validate, validateInfos } = useForm(hookRef, validators)

const isValid = computed(() => {
  // Recursively check if all the fields are valid
  const check = (obj: Record<string, any>) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        if (!check(obj[key])) {
          return false
        }
      } else if (obj && key === 'validateStatus' && obj[key] === 'error') {
        return false
      }
    }
    return true
  }

  return hookRef && check(validateInfos)
})

function onNotificationTypeChange(reset = false) {
  if (reset) {
    hookRef.notification.payload = {} as Record<string, any>
    if (['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hookRef.notification.type)) {
      hookRef.notification.payload.channels = []
      hookRef.notification.payload.body = ''
    }
  }

  if (hookRef.notification.type === 'Slack') {
    slackChannels.value = (apps.value && apps.value.Slack && apps.value.Slack.parsedInput) || []
  }

  if (hookRef.notification.type === 'Microsoft Teams') {
    teamsChannels.value = (apps.value && apps.value['Microsoft Teams'] && apps.value['Microsoft Teams'].parsedInput) || []
  }

  if (hookRef.notification.type === 'Discord') {
    discordChannels.value = (apps.value && apps.value.Discord && apps.value.Discord.parsedInput) || []
  }

  if (hookRef.notification.type === 'Mattermost') {
    mattermostChannels.value = (apps.value && apps.value.Mattermost && apps.value.Mattermost.parsedInput) || []
  }

  if (hookRef.notification.type === 'URL') {
    const body = hookRef.notification.payload.body
    hookRef.notification.payload.body = body ? (body === '{{ json data }}' ? '{{ json event }}' : body) : '{{ json event }}'
    hookRef.notification.payload.parameters = hookRef.notification.payload.parameters || [{}]
    hookRef.notification.payload.headers = hookRef.notification.payload.headers || [{}]
    hookRef.notification.payload.method = hookRef.notification.payload.method || 'POST'
    hookRef.notification.payload.auth = hookRef.notification.payload.auth || ''
  }
}

function setHook(newHook: HookType) {
  const notification = newHook.notification as Record<string, any>
  Object.assign(hookRef, {
    ...newHook,
    notification: {
      ...notification,
      payload: notification.payload,
    },
  })
}

function onEventChange() {
  const { notification: { payload = {}, type = {} } = {} } = hookRef

  Object.assign(hookRef, {
    ...hookRef,
    notification: {
      type,
      payload,
    },
  })
  hookRef.notification.payload = payload

  const channels: Ref<Record<string, any>[] | null> = ref(null)

  switch (hookRef.notification.type) {
    case 'Slack':
      channels.value = slackChannels.value
      break
    case 'Microsoft Teams':
      channels.value = teamsChannels.value
      break
    case 'Discord':
      channels.value = discordChannels.value
      break
    case 'Mattermost':
      channels.value = mattermostChannels.value
      break
  }

  if (channels) {
    hookRef.notification.payload.webhook_url =
      hookRef.notification.payload.webhook_url &&
      hookRef.notification.payload.webhook_url.map((v: { webhook_url: string }) =>
        channels.value?.find((s) => v.webhook_url === s.webhook_url),
      )
  }

  if (hookRef.notification.type === 'URL') {
    hookRef.notification.payload = hookRef.notification.payload || {}
    hookRef.notification.payload.parameters = hookRef.notification.payload.parameters || [{}]
    hookRef.notification.payload.headers = hookRef.notification.payload.headers || [{}]
    hookRef.notification.payload.method = hookRef.notification.payload.method || 'POST'
  }
}

async function loadPluginList() {
  if (isEeUI) return
  try {
    const plugins = (
      await api.plugin.webhookList({
        query: {
          base_id: base.value.id,
        },
      })
    ).list!

    apps.value = plugins.reduce((o, p) => {
      const plugin: { title: string; tags: string[]; parsedInput: Record<string, any> } = {
        title: '',
        tags: [],
        parsedInput: {},
        ...(p as any),
      }
      plugin.tags = p.tags ? p.tags.split(',') : []
      plugin.parsedInput = parseProp(p.input)
      o[plugin.title] = plugin

      return o
    }, {} as Record<string, any>)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const isConditionSupport = computed(() => {
  return hookRef.eventOperation && !hookRef.eventOperation.includes('bulk')
})

async function saveHooks() {
  loading.value = true
  try {
    await validate()
  } catch (_: any) {
    message.error(t('msg.error.invalidForm'))

    loading.value = false

    return
  }

  try {
    let res
    if (hookRef.id) {
      res = await api.dbTableWebhook.update(hookRef.id, {
        ...hookRef,
        notification: {
          ...hookRef.notification,
          payload: hookRef.notification.payload,
        },
      })
    } else {
      res = await api.dbTableWebhook.create(meta.value!.id!, {
        ...hookRef,
        notification: {
          ...hookRef.notification,
          payload: hookRef.notification.payload,
        },
      } as HookReqType)

      hooks.value.push(res)
    }

    if (res && typeof res.notification === 'string') {
      res.notification = JSON.parse(res.notification)
    }

    if (!hookRef.id && res) {
      hookRef = { ...hookRef, ...res } as any
    }

    if (filterRef.value) {
      await filterRef.value.applyChanges(hookRef.id, false, isConditionSupport.value)
    }

    // Webhook details updated successfully
    hooks.value = hooks.value.map((h) => {
      if (h.id === hookRef.id) {
        return hookRef
      }
      return h
    })

    emits('close')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    loading.value = false
  }

  $e('a:webhook:add', {
    operation: hookRef.operation,
    condition: hookRef.condition,
    notification: hookRef.notification.type,
  })
}

const isTestLoading = ref(false)

async function testWebhook() {
  try {
    testSuccess.value = false
    isTestLoading.value = true
    await webhookTestRef.value.testWebhook()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isTestLoading.value = false
  }
}

const getDefaultHookName = (hooks: HookType[]) => {
  return extractNextDefaultName([...hooks.map((el) => el?.title || '')], defaultHookName)
}

watch(
  () => hookRef.eventOperation,
  () => {
    if (!hookRef.eventOperation) return

    const [event, operation] = hookRef.eventOperation.split(' ')
    hookRef.event = event as HookType['event']
    hookRef.operation = operation as HookType['operation']
  },
)

watch(
  () => props.hook,
  () => {
    if (props.hook) {
      setHook(props.hook)
      onEventChange()
    } else {
      // Set the default hook title only when creating a new hook.
      hookRef.title = getDefaultHookName(hooks.value)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await loadPluginList()

  if (hookRef.event && hookRef.operation) {
    hookRef.eventOperation = `${hookRef.event} ${hookRef.operation}`
  } else {
    hookRef.eventOperation = eventList.value[0].value.join(' ')
  }

  onNotificationTypeChange()

  setTimeout(() => {
    if (hookRef.id === '') {
      titleDomRef.value?.click()
      titleDomRef.value?.select()
    }
  }, 50)
})
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-webhook-create-edit">
    <template #header>
      <div class="flex w-full items-center p-4 justify-between">
        <div class="flex items-center gap-3">
          <GeneralIcon class="text-gray-900 text-2xl" icon="webhook" />
          <span class="text-gray-900 font-semibold text-2xl">
            {{ $t('activity.newWebhook') }}
          </span>
        </div>

        <NcButton type="text" size="small" @click="modalVisible = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </template>
    <div class="flex">
      <div style="height: 600px" class="flex-1 flex flex-col gap-8 overflow-y-auto px-12 py-6 mx-auto">
        <a-form-item v-bind="validateInfos.title">
          <div
            class="flex flex-grow px-2 py-1 border-b-1 border-b-brand-500 items-center rounded-t-md border-gray-200 bg-gray-100"
            @keydown.enter.prevent="titleDomRef?.focus()"
          >
            <input
              ref="titleDomRef"
              v-model="hookRef.title"
              class="flex flex-grow text-lg px-2 font-medium capitalize outline-none bg-inherit nc-text-field-hook-title"
              :placeholder="$t('placeholder.webhookTitle')"
              :contenteditable="true"
            />
            <GeneralIcon icon="edit" />
          </div>
        </a-form-item>

        <a-form class="flex flex-col gap-4" :model="hookRef" name="create-or-edit-webhook">
          <div class="flex w-full gap-3">
            <a-form-item class="w-1/3" v-bind="validateInfos.eventOperation">
              <a-select
                v-model:value="hookRef.eventOperation"
                size="large"
                :placeholder="$t('general.event')"
                class="nc-text-field-hook-event capitalize"
                dropdown-class-name="nc-dropdown-webhook-event"
              >
                <template #suffixIcon>
                  <GeneralIcon icon="arrowDown" class="text-gray-700" />
                </template>
                <a-select-option
                  v-for="(event, i) in eventList"
                  :key="i"
                  class="capitalize"
                  :value="event.value.join(' ')"
                  :disabled="hookRef.version === 'v1' && ['bulkInsert', 'bulkUpdate', 'bulkDelete'].includes(event.value[1])"
                >
                  <div class="flex items-center w-full gap-2 justify-between">
                    <div>{{ event.text.join(' ') }}</div>
                    <component
                      :is="iconMap.check"
                      v-if="hookRef.eventOperation === event.value.join(' ')"
                      id="nc-selected-item-icon"
                      class="text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item class="w-2/3" v-bind="validateInfos['notification.type']">
              <a-select
                v-model:value="hookRef.notification.type"
                size="large"
                :disabled="isEeUI"
                class="nc-select-hook-notification-type"
                :placeholder="$t('general.notification')"
                dropdown-class-name="nc-dropdown-webhook-notification"
                @change="onNotificationTypeChange(true)"
              >
                <template #suffixIcon>
                  <GeneralIcon icon="arrowDown" class="text-gray-700" />
                </template>
                <a-select-option v-for="(notificationOption, i) in notificationList" :key="i" :value="notificationOption.type">
                  <div class="flex items-center w-full gap-2">
                    <component :is="iconMap.link" v-if="notificationOption.type === 'URL'" class="mr-2" />

                    <component :is="iconMap.email" v-if="notificationOption.type === 'Email'" class="mr-2" />

                    <MdiSlack v-if="notificationOption.type === 'Slack'" class="mr-2" />

                    <MdiMicrosoftTeams v-if="notificationOption.type === 'Microsoft Teams'" class="mr-2" />

                    <MdiDiscord v-if="notificationOption.type === 'Discord'" class="mr-2" />

                    <MdiChat v-if="notificationOption.type === 'Mattermost'" class="mr-2" />

                    <MdiWhatsapp v-if="notificationOption.type === 'Whatsapp Twilio'" class="mr-2" />

                    <MdiCellphoneMessage v-if="notificationOption.type === 'Twilio'" class="mr-2" />

                    <div class="flex-1">{{ notificationOption.text }}</div>
                    <component
                      :is="iconMap.check"
                      v-if="hookRef.notification.type === notificationOption.type"
                      id="nc-selected-item-icon"
                      class="text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </div>

          <div v-if="hookRef.notification.type === 'URL'" class="flex flex-col w-full gap-3">
            <div class="flex w-full gap-3">
              <a-form-item class="w-1/3">
                <a-select
                  v-model:value="hookRef.notification.payload.method"
                  size="large"
                  class="nc-select-hook-url-method"
                  dropdown-class-name="nc-dropdown-hook-notification-url-method"
                >
                  <template #suffixIcon>
                    <GeneralIcon icon="arrowDown" class="text-gray-700" />
                  </template>

                  <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">
                    <div class="flex items-center gap-2 justify-between">
                      <div>{{ method.title }}</div>
                      <component
                        :is="iconMap.check"
                        v-if="hookRef.notification.payload.method === method.title"
                        id="nc-selected-item-icon"
                        class="text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item class="w-2/3" v-bind="validateInfos['notification.payload.path']">
                <a-input
                  v-model:value="hookRef.notification.payload.path"
                  size="large"
                  placeholder="http://example.com"
                  class="nc-text-field-hook-url-path !rounded-md"
                />
              </a-form-item>
            </div>
            <div class="my-8">
              <NcTabs v-model:activeKey="urlTabKey">
                <a-tab-pane key="params" :tab="$t('title.parameter')" force-render>
                  <LazyApiClientParams v-model="hookRef.notification.payload.parameters" />
                </a-tab-pane>

                <a-tab-pane key="headers" :tab="$t('title.headers')" class="nc-tab-headers">
                  <LazyApiClientHeaders v-model="hookRef.notification.payload.headers" />
                </a-tab-pane>

                <a-tab-pane v-if="isBodyShown" key="body" tab="Body">
                  <LazyMonacoEditor
                    v-model="hookRef.notification.payload.body"
                    disable-deep-compare
                    :validate="false"
                    class="min-h-60 max-h-80"
                  />
                </a-tab-pane>
              </NcTabs>
            </div>
          </div>

          <div v-if="hookRef.notification.type === 'Slack'" class="flex flex-col w-full gap-3">
            <a-form-item v-bind="validateInfos['notification.payload.channels']">
              <LazyWebhookChannelMultiSelect
                v-model="hookRef.notification.payload.channels"
                :selected-channel-list="hookRef.notification.payload.channels"
                :available-channel-list="slackChannels"
                :placeholder="$t('placeholder.selectSlackChannels')"
              />
            </a-form-item>
          </div>

          <div v-if="hookRef.notification.type === 'Microsoft Teams'" class="flex flex-col w-full gap-3">
            <a-form-item v-bind="validateInfos['notification.payload.channels']">
              <LazyWebhookChannelMultiSelect
                v-model="hookRef.notification.payload.channels"
                :selected-channel-list="hookRef.notification.payload.channels"
                :available-channel-list="teamsChannels"
                :placeholder="$t('placeholder.selectTeamsChannels')"
              />
            </a-form-item>
          </div>

          <div v-if="hookRef.notification.type === 'Discord'" class="flex flex-col w-full gap-3">
            <a-form-item v-bind="validateInfos['notification.payload.channels']">
              <LazyWebhookChannelMultiSelect
                v-model="hookRef.notification.payload.channels"
                :selected-channel-list="hookRef.notification.payload.channels"
                :available-channel-list="discordChannels"
                :placeholder="$t('placeholder.selectDiscordChannels')"
              />
            </a-form-item>
          </div>

          <div v-if="hookRef.notification.type === 'Mattermost'" class="flex flex-col w-full gap-3">
            <a-form-item v-bind="validateInfos['notification.payload.channels']">
              <LazyWebhookChannelMultiSelect
                v-model="hookRef.notification.payload.channels"
                :selected-channel-list="hookRef.notification.payload.channels"
                :available-channel-list="mattermostChannels"
                :placeholder="$t('placeholder.selectMattermostChannels')"
              />
            </a-form-item>
          </div>

          <div v-show="isConditionSupport">
            <div class="w-full cursor-pointer" @click.prevent="hookRef.condition = !hookRef.condition">
              <NcSwitch :checked="Boolean(hookRef.condition)">
                <span class="!text-gray-700 font-semibold">
                  {{ `${$t('general.condition')}s` }}
                </span>
              </NcSwitch>
            </div>

            <LazySmartsheetToolbarColumnFilter
              v-if="hookRef.condition"
              ref="filterRef"
              class="w-full"
              :auto-save="false"
              :show-loading="false"
              :hook-id="hookRef.id"
              :web-hook="true"
              @update:filters-length="hookRef.condition = $event > 0"
            />
          </div>

          <LazyWebhookTest
            ref="webhookTestRef"
            :hook="{
              ...hookRef,
              notification: {
                ...hookRef.notification,
                payload: hookRef.notification.payload,
              },
            }"
            @error="testSuccess = false"
            @success="testSuccess = true"
          />

          <!--       <a-form-item>
                     <a-row v-if="formInput[hookRef.notification.type] && hookRef.notification.payload" type="flex">
                <a-col v-for="(input, i) in formInput[hookRef.notification.type]" :key="i" :span="24">
                  <a-form-item v-if="input.type === 'LongText'" v-bind="validateInfos[`notification.payload.${input.key}`]">
                    <a-textarea v-model:value="hookRef.notification.payload[input.key]" :placeholder="input.label" size="large" />
                  </a-form-item>

                  <a-form-item v-else v-bind="validateInfos[`notification.payload.${input.key}`]">
                    <a-input v-model:value="hookRef.notification.payload[input.key]" :placeholder="input.label" size="large" />
                  </a-form-item>
                </a-col>
              </a-row>
          </a-form-item> -->
        </a-form>
      </div>

      <div class="bg-gray-50 border-l-1 w-80 p-5 border-gray-200">
        <h1 class="text-gray-900 font-semibold">
          {{ $t('labels.supportDocs') }}
        </h1>
      </div>
    </div>

    <div class="flex w-full justify-end rounded-b-2xl gap-2 bg-white border-t-1 border-gray-200 items-center p-4">
      <NcButton :loading="isTestLoading" type="secondary" size="small" @click="testWebhook">
        <div class="flex items-center gap-2">
          <GeneralIcon v-if="testSuccess" icon="circleCheck" class="text-primary mr-2" style="color: green" />
          <span :style="testSuccess ? 'color: green;' : ''">
            {{ testSuccess ? 'Test Successful' : $t('activity.testWebhook') }}
          </span>
        </div>
      </NcButton>

      <NcButton :loading="loading" :disabled="!testSuccess" type="primary" size="small" @click="saveHooks">
        {{ $t('activity.createWebhook') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-webhook-create-edit {
  .nc-modal {
    @apply !p-0;
  }

  .nc-modal-header {
    @apply !mb-0;
  }
}
</style>

<style scoped lang="scss">
:deep(.ant-radio-group .ant-radio-wrapper) {
  @apply transition-all duration-0.3s;

  &.ant-radio-wrapper-checked:not(.ant-radio-wrapper-disabled):focus-within {
    @apply shadow-selected;
  }

  &.ant-radio-wrapper-disabled {
    @apply pointer-events-none !bg-[#f5f5f5];
    box-shadow: none;

    &:hover {
      box-shadow: none;
    }
  }

  &:not(.ant-radio-wrapper-disabled):not(:hover):not(:focus-within):not(.shadow-selected) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(:focus-within):not(.ant-radio-wrapper-disabled) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

:deep(.ant-select) {
  &:not(.ant-select-disabled):not(:hover):not(.ant-select-focused) .ant-select-selector,
  &:not(.ant-select-disabled):hover.ant-select-disabled .ant-select-selector {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply border-gray-300;
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }

  &.ant-select-disabled .ant-select-selector {
    box-shadow: none;
  }
}

:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 text-gray-700 flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}

:deep(.ant-form-item-label) {
  @apply !pb-0 text-small leading-[18px] text-gray-700;
}

:deep(.ant-form-item-control-input) {
  @apply !min-h-min;
}

:deep(.ant-form-item) {
  @apply !mb-0;
}

:deep(.ant-select-selection-item) {
  @apply flex items-center;
}

:deep(.ant-form-item-explain) {
  @apply !text-[10px] leading-normal;

  & > div:first-child {
    @apply mt-0.5;
  }
}

:deep(.ant-form-item-explain) {
  @apply !min-h-[15px];
}

:deep(.ant-alert) {
  @apply !rounded-lg !bg-transparent !border-none !p-0;

  .ant-alert-message {
    @apply text-sm text-gray-800 font-weight-600;
  }

  .ant-alert-description {
    @apply text-small text-gray-500 font-weight-500;
  }
}

:deep(.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}

:deep(input::placeholder),
:deep(textarea::placeholder) {
  @apply text-gray-500;
}
</style>
