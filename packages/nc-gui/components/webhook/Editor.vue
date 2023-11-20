<script setup lang="ts">
import type { Ref } from 'vue'
import type { HookReqType, HookType } from 'nocodb-sdk'
import {
  Form,
  MetaInj,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  iconMap,
  inject,
  message,
  onMounted,
  parseProp,
  reactive,
  ref,
  useApi,
  // useGlobal,
  useI18n,
  useNuxtApp,
  watch,
} from '#imports'

interface Props {
  hook?: HookType
}

const props = defineProps<Props>()

const emit = defineEmits(['close', 'delete'])

const { t } = useI18n()

const { $e } = useNuxtApp()

const { api, isLoading: loading } = useApi()

// const { appInfo } = useGlobal()

const { hooks } = storeToRefs(useWebhooksStore())

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const titleDomRef = ref<HTMLInputElement | undefined>()

// const hookTabKey = ref('hook-edit')

const useForm = Form.useForm

let hookRef = reactive<
  Omit<HookType, 'notification'> & { notification: Record<string, any>; eventOperation?: string; condition: boolean }
>({
  id: '',
  title: 'Untitled Webhook',
  event: undefined,
  operation: undefined,
  eventOperation: undefined,
  notification: {
    type: 'URL',
    payload: {
      method: 'POST',
      body: '{{ json data }}',
      headers: [{}],
      parameters: [{}],
      path: '',
    },
  },
  condition: false,
  active: true,
  version: 'v2',
})

const isBodyShown = ref(hookRef.version === 'v1')

const urlTabKey = ref(isBodyShown.value ? 'body' : 'params')

const apps: Record<string, any> = ref()

const webhookTestRef = ref()

const slackChannels = ref<Record<string, any>[]>([])

const teamsChannels = ref<Record<string, any>[]>([])

const discordChannels = ref<Record<string, any>[]>([])

const mattermostChannels = ref<Record<string, any>[]>([])

const filterRef = ref()

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

const isRenaming = ref(false)

// TODO: Add back when show logs is working
const showLogs = computed(
  () => false,
  // !(
  //   appInfo.automationLogLevel === AutomationLogLevel.OFF ||
  //   (appInfo.automationLogLevel === AutomationLogLevel.ALL && !appInfo.ee)
  // ),
)

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
    hookRef.notification.payload.body = hookRef.notification.payload.body || '{{ json data }}'
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
  if (hookRef.version === 'v1') {
    urlTabKey.value = 'body'
    eventList.value = [
      { text: ['After', 'Insert'], value: ['after', 'insert'] },
      { text: ['After', 'Update'], value: ['after', 'update'] },
      { text: ['After', 'Delete'], value: ['after', 'delete'] },
    ]
  }
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
      await filterRef.value.applyChanges(hookRef.id)
    }

    // Webhook details updated successfully
    hooks.value = hooks.value.map((h) => {
      if (h.id === hookRef.id) {
        return hookRef
      }
      return h
    })

    emit('close')
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

async function testWebhook() {
  await webhookTestRef.value.testWebhook()
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
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await loadPluginList()

  if (hookRef.event && hookRef.operation) {
    hookRef.eventOperation = `${hookRef.event} ${hookRef.operation}`
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
  <div class="flex nc-webhook-header pb-3 gap-x-2 items-start">
    <div class="flex flex-1">
      <a-form-item v-bind="validateInfos.title" class="flex flex-grow">
        <div
          class="flex flex-grow px-1.5 py-0.125 items-center rounded-md border-gray-200 bg-gray-50 outline-gray-200"
          style="outline-style: solid; outline-width: thin"
        >
          <input
            ref="titleDomRef"
            v-model="hookRef.title"
            class="flex flex-grow text-lg font-medium capitalize outline-none bg-inherit nc-text-field-hook-title"
            :placeholder="$t('placeholder.webhookTitle')"
            :contenteditable="true"
            @blur="isRenaming = false"
            @focus="isRenaming = true"
            @keydown.enter.prevent="titleDomRef?.blur()"
          />
        </div>
      </a-form-item>
    </div>
    <div class="flex flex-row gap-2">
      <NcButton class="nc-btn-webhook-test" type="secondary" size="small" @click="testWebhook">
        <div class="flex items-center px-1">{{ $t('activity.testWebhook') }}</div>
      </NcButton>

      <NcButton
        class="nc-btn-webhook-save"
        type="primary"
        :loading="loading"
        size="small"
        :disabled="!isValid"
        @click.prevent="saveHooks"
      >
        <template #loading> {{ $t('general.saving') }} </template>
        <div class="flex items-center px-1">{{ $t('general.save') }}</div>
      </NcButton>
    </div>
  </div>

  <div class="flex flex-row">
    <div
      class="nc-webhook-form flex flex-col"
      :class="{
        'w-1/2': showLogs,
        'w-full': !showLogs,
      }"
    >
      <a-form :model="hookRef" name="create-or-edit-webhook">
        <a-form-item>
          <div class="form-field-header">{{ $t('general.event') }}</div>
          <a-row type="flex" :gutter="[16, 16]">
            <a-col :span="12">
              <a-form-item v-bind="validateInfos.eventOperation">
                <NcSelect
                  v-model:value="hookRef.eventOperation"
                  size="large"
                  :placeholder="$t('general.event')"
                  class="nc-text-field-hook-event capitalize"
                  dropdown-class-name="nc-dropdown-webhook-event"
                >
                  <a-select-option v-for="(event, i) in eventList" :key="i" class="capitalize" :value="event.value.join(' ')">
                    {{ event.text.join(' ') }}
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </a-col>

            <a-col :span="12">
              <a-form-item v-bind="validateInfos['notification.type']">
                <NcSelect
                  v-model:value="hookRef.notification.type"
                  size="large"
                  class="nc-select-hook-notification-type"
                  :placeholder="$t('general.notification')"
                  dropdown-class-name="nc-dropdown-webhook-notification"
                  @change="onNotificationTypeChange(true)"
                >
                  <a-select-option v-for="(notificationOption, i) in notificationList" :key="i" :value="notificationOption.type">
                    <div class="flex items-center">
                      <component :is="iconMap.link" v-if="notificationOption.type === 'URL'" class="mr-2" />

                      <component :is="iconMap.email" v-if="notificationOption.type === 'Email'" class="mr-2" />

                      <MdiSlack v-if="notificationOption.type === 'Slack'" class="mr-2" />

                      <MdiMicrosoftTeams v-if="notificationOption.type === 'Microsoft Teams'" class="mr-2" />

                      <MdiDiscord v-if="notificationOption.type === 'Discord'" class="mr-2" />

                      <MdiChat v-if="notificationOption.type === 'Mattermost'" class="mr-2" />

                      <MdiWhatsapp v-if="notificationOption.type === 'Whatsapp Twilio'" class="mr-2" />

                      <MdiCellphoneMessage v-if="notificationOption.type === 'Twilio'" class="mr-2" />

                      {{ notificationOption.text }}
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row v-if="hookRef.notification.type === 'URL'" class="mb-5" type="flex" :gutter="[16, 0]">
            <a-col :span="6">
              <div>Action</div>
              <NcSelect
                v-model:value="hookRef.notification.payload.method"
                size="large"
                class="nc-select-hook-url-method"
                dropdown-class-name="nc-dropdown-hook-notification-url-method"
              >
                <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">
                  {{ method.title }}
                </a-select-option>
              </NcSelect>
            </a-col>

            <a-col :span="18">
              <div>Link</div>
              <a-form-item v-bind="validateInfos['notification.payload.path']">
                <a-input
                  v-model:value="hookRef.notification.payload.path"
                  size="large"
                  placeholder="http://example.com"
                  class="nc-text-field-hook-url-path !rounded-md"
                />
              </a-form-item>
            </a-col>

            <a-col :span="24">
              <NcTabs v-model:activeKey="urlTabKey" type="card" closeable="false" class="border-1 !pb-2 !rounded-lg">
                <a-tab-pane v-if="isBodyShown" key="body" tab="Body">
                  <LazyMonacoEditor
                    v-model="hookRef.notification.payload.body"
                    disable-deep-compare
                    :validate="false"
                    class="min-h-60 max-h-80"
                  />
                </a-tab-pane>

                <a-tab-pane key="params" :tab="$t('title.parameter')" force-render>
                  <LazyApiClientParams v-model="hookRef.notification.payload.parameters" class="p-4" />
                </a-tab-pane>

                <a-tab-pane key="headers" :tab="$t('title.headers')" class="nc-tab-headers">
                  <LazyApiClientHeaders v-model="hookRef.notification.payload.headers" class="!p-4" />
                </a-tab-pane>

                <!-- No in use at this moment -->
                <!--            <a-tab-pane key="auth" tab="Auth"> -->
                <!--              <LazyMonacoEditor v-model="hook.notification.payload.auth" class="min-h-60 max-h-80" /> -->

                <!--              <span class="text-gray-500 prose-sm p-2"> -->
                <!--                For more about auth option refer -->
                <!--                <a class="prose-sm" href  ="https://github.com/axios/axios#request-config" target="_blank">axios docs</a>. -->
                <!--              </span> -->
                <!--            </a-tab-pane> -->
              </NcTabs>
            </a-col>
          </a-row>

          <a-row v-if="hookRef.notification.type === 'Slack'" type="flex">
            <a-col :span="24">
              <a-form-item v-bind="validateInfos['notification.payload.channels']">
                <LazyWebhookChannelMultiSelect
                  v-model="hookRef.notification.payload.channels"
                  :selected-channel-list="hookRef.notification.payload.channels"
                  :available-channel-list="slackChannels"
                  :placeholder="$t('placeholder.selectSlackChannels')"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row v-if="hookRef.notification.type === 'Microsoft Teams'" type="flex">
            <a-col :span="24">
              <a-form-item v-bind="validateInfos['notification.payload.channels']">
                <LazyWebhookChannelMultiSelect
                  v-model="hookRef.notification.payload.channels"
                  :selected-channel-list="hookRef.notification.payload.channels"
                  :available-channel-list="teamsChannels"
                  :placeholder="$t('placeholder.selectTeamsChannels')"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row v-if="hookRef.notification.type === 'Discord'" type="flex">
            <a-col :span="24">
              <a-form-item v-bind="validateInfos['notification.payload.channels']">
                <LazyWebhookChannelMultiSelect
                  v-model="hookRef.notification.payload.channels"
                  :selected-channel-list="hookRef.notification.payload.channels"
                  :available-channel-list="discordChannels"
                  :placeholder="$t('placeholder.selectDiscordChannels')"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row v-if="hookRef.notification.type === 'Mattermost'" type="flex">
            <a-col :span="24">
              <a-form-item v-bind="validateInfos['notification.payload.channels']">
                <LazyWebhookChannelMultiSelect
                  v-model="hookRef.notification.payload.channels"
                  :selected-channel-list="hookRef.notification.payload.channels"
                  :available-channel-list="mattermostChannels"
                  :placeholder="$t('placeholder.selectMattermostChannels')"
                />
              </a-form-item>
            </a-col>
          </a-row>

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

          <a-row class="mb-5" type="flex">
            <a-col :span="24">
              <div class="rounded-lg border-1 p-6">
                <a-checkbox
                  :checked="Boolean(hookRef.condition)"
                  class="nc-check-box-hook-condition"
                  @update:checked="hookRef.condition = $event"
                >
                  {{ $t('activity.onCondition') }}
                </a-checkbox>

                <LazySmartsheetToolbarColumnFilter
                  v-if="hookRef.condition"
                  ref="filterRef"
                  class="!p-0 mt-4"
                  :auto-save="false"
                  :show-loading="false"
                  :hook-id="hookRef.id"
                  :web-hook="true"
                />
              </div>
            </a-col>
          </a-row>

          <a-row>
            <a-col :span="24">
              <div v-if="isBodyShown" class="text-gray-600">
                <div class="flex items-center">
                  <em
                    >{{ $t('msg.webhookBodyMsg1') }} <strong>{{ $t('msg.webhookBodyMsg2') }}</strong>
                    {{ $t('msg.webhookBodyMsg3') }}</em
                  >

                  <a-tooltip bottom>
                    <template #title>
                      <span>
                        <strong>{{ $t('general.data') }}</strong> : {{ $t('title.rowData') }} <br />
                      </span>
                    </template>
                    <component :is="iconMap.info" class="ml-2" />
                  </a-tooltip>
                </div>

                <div class="my-3">
                  <a href="https://docs.nocodb.com/developer-resources/webhooks/" target="_blank" rel="noopener">
                    <!-- Document Reference -->
                    {{ $t('labels.docReference') }}
                  </a>
                </div>
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
              />
            </a-col>
          </a-row>
        </a-form-item>
      </a-form>
    </div>
    <div v-if="showLogs" class="nc-webhook-calllog flex w-1/2">
      <LazyWebhookCallLog :hook="hookRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.circle {
  width: 0.6rem;
  height: 0.6rem;
  background-color: #ffffff;
  border-radius: 50%;
  position: relative;
}

.dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-52.5%, -52.5%);
}

:deep(.ant-tabs-tab) {
  @apply border-r-0 border-l-0 border-t-0 !px-4 !bg-inherit !border-b-2 border-transparent text-gray-600;
}
:deep(.ant-tabs-tab-active) {
  @apply !px-4 !border-primary;
}

.form-field-header {
  @apply mb-1;
}
</style>
