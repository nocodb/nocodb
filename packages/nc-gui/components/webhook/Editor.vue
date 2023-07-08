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
  useGlobal,
  useI18n,
  useNuxtApp,
  watch,
} from '#imports'

interface Props {
  hook?: HookType
}

const props = defineProps<Props>()

const emit = defineEmits(['close'])

const { t } = useI18n()

const { $e } = useNuxtApp()

const { api, isLoading: loading } = useApi()

const { appInfo } = $(useGlobal())

const { hooks } = storeToRefs(useWebhooksStore())

const meta = inject(MetaInj, ref())

const hookTabKey = ref('hook-edit')

const useForm = Form.useForm

const hook = reactive<
  Omit<HookType, 'notification'> & { notification: Record<string, any>; eventOperation?: string; condition: boolean }
>({
  id: '',
  title: '',
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

const isBodyShown = ref(hook.version === 'v1' || (hook.version === 'v2' && appInfo.ee))

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
      label: 'To Address',
      placeholder: 'To Address',
      type: 'SingleLineText',
      required: true,
    },
    {
      key: 'subject',
      label: 'Subject',
      placeholder: 'Subject',
      type: 'SingleLineText',
      required: true,
    },
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
  ],
  'Slack': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
  ],
  'Microsoft Teams': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
  ],
  'Discord': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
  ],
  'Mattermost': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
  ],
  'Twilio': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
    {
      key: 'to',
      label: 'Comma separated Mobile #',
      placeholder: 'Comma separated Mobile #',
      type: 'LongText',
      required: true,
    },
  ],
  'Whatsapp Twilio': [
    {
      key: 'body',
      label: 'Body',
      placeholder: 'Body',
      type: 'LongText',
      required: true,
    },
    {
      key: 'to',
      label: 'Comma separated Mobile #',
      placeholder: 'Comma separated Mobile #',
      type: 'LongText',
      required: true,
    },
  ],
})

// TODO: Add back when show logs is working
const showLogs = computed(
  () => false,
  // !(
  //   appInfo.automationLogLevel === AutomationLogLevel.OFF ||
  //   (appInfo.automationLogLevel === AutomationLogLevel.ALL && !appInfo.ee)
  // ),
)

const eventList = ref<Record<string, any>[]>([
  { text: ['After', 'Insert'], value: ['after', 'insert'] },
  { text: ['After', 'Update'], value: ['after', 'update'] },
  { text: ['After', 'Delete'], value: ['after', 'delete'] },
  { text: ['After', 'Bulk Insert'], value: ['after', 'bulkInsert'] },
  { text: ['After', 'Bulk Update'], value: ['after', 'bulkUpdate'] },
  { text: ['After', 'Bulk Delete'], value: ['after', 'bulkDelete'] },
])

const notificationList = computed(() => {
  return appInfo.isCloud
    ? [{ type: 'URL' }]
    : [
        { type: 'URL' },
        { type: 'Email' },
        { type: 'Slack' },
        { type: 'Microsoft Teams' },
        { type: 'Discord' },
        { type: 'Mattermost' },
        { type: 'Twilio' },
        { type: 'Whatsapp Twilio' },
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
    ...(hook.notification.type === 'URL' && {
      'notification.payload.method': [fieldRequiredValidator()],
      'notification.payload.path': [fieldRequiredValidator()],
    }),
    ...(hook.notification.type === 'Email' && {
      'notification.payload.to': [fieldRequiredValidator()],
      'notification.payload.subject': [fieldRequiredValidator()],
      'notification.payload.body': [fieldRequiredValidator()],
    }),
    ...(['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hook.notification.type) && {
      'notification.payload.channels': [fieldRequiredValidator()],
      'notification.payload.body': [fieldRequiredValidator()],
    }),
    ...((hook.notification.type === 'Twilio' || hook.notification.type === 'Whatsapp Twilio') && {
      'notification.payload.body': [fieldRequiredValidator()],
      'notification.payload.to': [fieldRequiredValidator()],
    }),
  }
})
const { validate, validateInfos } = useForm(hook, validators)

function onNotificationTypeChange(reset = false) {
  if (reset) {
    hook.notification.payload = {} as Record<string, any>
    if (['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hook.notification.type)) {
      hook.notification.payload.channels = []
      hook.notification.payload.body = ''
    }
  }

  if (hook.notification.type === 'Slack') {
    slackChannels.value = (apps.value && apps.value.Slack && apps.value.Slack.parsedInput) || []
  }

  if (hook.notification.type === 'Microsoft Teams') {
    teamsChannels.value = (apps.value && apps.value['Microsoft Teams'] && apps.value['Microsoft Teams'].parsedInput) || []
  }

  if (hook.notification.type === 'Discord') {
    discordChannels.value = (apps.value && apps.value.Discord && apps.value.Discord.parsedInput) || []
  }

  if (hook.notification.type === 'Mattermost') {
    mattermostChannels.value = (apps.value && apps.value.Mattermost && apps.value.Mattermost.parsedInput) || []
  }

  if (hook.notification.type === 'URL') {
    hook.notification.payload.body = hook.notification.payload.body || '{{ json data }}'
    hook.notification.payload.parameters = hook.notification.payload.parameters || [{}]
    hook.notification.payload.headers = hook.notification.payload.headers || [{}]
    hook.notification.payload.method = hook.notification.payload.method || 'POST'
    hook.notification.payload.auth = hook.notification.payload.auth || ''
  }
}

function setHook(newHook: HookType) {
  const notification = newHook.notification as Record<string, any>
  Object.assign(hook, {
    ...newHook,
    notification: {
      ...notification,
      payload: notification.payload,
    },
  })
  if (hook.version === 'v1') {
    urlTabKey.value = 'body'
    eventList.value = [
      { text: ['After', 'Insert'], value: ['after', 'insert'] },
      { text: ['After', 'Update'], value: ['after', 'update'] },
      { text: ['After', 'Delete'], value: ['after', 'delete'] },
    ]
  }
}

function onEventChange() {
  const { notification: { payload = {}, type = {} } = {} } = hook

  Object.assign(hook, {
    ...hook,
    notification: {
      type,
      payload,
    },
  })

  hook.notification.payload = payload

  const channels: Ref<Record<string, any>[] | null> = ref(null)

  switch (hook.notification.type) {
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
    hook.notification.payload.webhook_url =
      hook.notification.payload.webhook_url &&
      hook.notification.payload.webhook_url.map((v: { webhook_url: string }) =>
        channels.value?.find((s) => v.webhook_url === s.webhook_url),
      )
  }

  if (hook.notification.type === 'URL') {
    hook.notification.payload = hook.notification.payload || {}
    hook.notification.payload.parameters = hook.notification.payload.parameters || [{}]
    hook.notification.payload.headers = hook.notification.payload.headers || [{}]
    hook.notification.payload.method = hook.notification.payload.method || 'POST'
  }
}

async function loadPluginList() {
  if (appInfo.isCloud) return
  try {
    const plugins = (await api.plugin.list()).list!

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
    if (hook.id) {
      res = await api.dbTableWebhook.update(hook.id, {
        ...hook,
        notification: {
          ...hook.notification,
          payload: hook.notification.payload,
        },
      })
    } else {
      res = await api.dbTableWebhook.create(meta.value!.id!, {
        ...hook,
        notification: {
          ...hook.notification,
          payload: hook.notification.payload,
        },
      } as HookReqType)

      hooks.value.push(res)
    }

    if (!hook.id && res) {
      hook.value = { ...hook, ...res } as any
    }

    if (filterRef.value) {
      await filterRef.value.applyChanges(hook.id)
    }

    // Webhook details updated successfully
    hooks.value = hooks.value.map((h) => {
      if (h.id === hook.id) {
        return hook
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
    operation: hook.operation,
    condition: hook.condition,
    notification: hook.notification.type,
  })
}

async function testWebhook() {
  await webhookTestRef.value.testWebhook()
}

watch(
  () => hook.eventOperation,
  () => {
    if (!hook.eventOperation) return

    const [event, operation] = hook.eventOperation.split(' ')
    hook.event = event as HookType['event']
    hook.operation = operation as HookType['operation']
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

  if (hook.event && hook.operation) {
    hook.eventOperation = `${hook.event} ${hook.operation}`
  }

  onNotificationTypeChange()
})
</script>

<template>
  <div class="flex">
    <div class="flex-1">
      <div class="flex items-center">
        <div class="flex flex-row items-center gap-x-2">
          <div class="circle">
            <div
              class="dot"
              :class="{
                'bg-green-500': hook?.active,
                'bg-gray-400': !hook?.active,
              }"
            ></div>
          </div>
        </div>

        <span class="inline text-lg font-medium ml-2">{{ hook.title || 'Webhooks' }} </span>
      </div>
    </div>
    <div class="flex flex-row gap-2 mr-0.25">
      <a-button class="nc-btn-webhook-test !rounded-md" size="middle" @click="testWebhook">
        <div class="flex items-center">Test Webhook</div>
      </a-button>

      <a-button class="nc-btn-webhook-save !rounded-md" type="primary" size="middle" @click.prevent="saveHooks">
        <div class="flex items-center">
          {{ $t('general.save') }}
        </div>
      </a-button>
    </div>
  </div>

  <div class="mt-4 py-2 border-1 border-gray-100 rounded-lg">
    <div
      class="flex flex-row px-6 py-4 nc-scrollbar-md"
      :style="{
        height: '70vh',
      }"
    >
      <div
        class="nc-webhook-form flex flex-col"
        :class="{
          'w-1/2': showLogs,
        }"
      >
        <div class="flex flex-row justify-between mb-6">
          <div class="font-medium text-lg">Parameters</div>
        </div>
        <a-form :model="hook" name="create-or-edit-webhook">
          <a-form-item>
            <div class="flex flex-row justify-between px-3 py-2 border-1 border-gray-100 rounded-md">
              <div class="text-black">Activate Web hook</div>
              <a-switch
                :checked="Boolean(hook.active)"
                class="nc-check-box-enable-webhook"
                @update:checked="hook.active = $event"
              />
            </div>
          </a-form-item>
          <a-form-item class="!mb-0">
            <div class="my-1">Title</div>
            <a-row type="flex !mb-0">
              <a-col :span="24">
                <a-form-item v-bind="validateInfos.title">
                  <a-input
                    v-model:value="hook.title"
                    size="large"
                    :placeholder="$t('general.title')"
                    class="nc-text-field-hook-title !rounded-md"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form-item>
          <a-form-item>
            <div class="my-1">Event</div>
            <a-row type="flex" :gutter="[16, 16]">
              <a-col :span="12">
                <a-form-item v-bind="validateInfos.eventOperation">
                  <a-select
                    v-model:value="hook.eventOperation"
                    size="large"
                    :placeholder="$t('general.event')"
                    class="nc-text-field-hook-event"
                    dropdown-class-name="nc-dropdown-webhook-event"
                  >
                    <a-select-option v-for="(event, i) in eventList" :key="i" :value="event.value.join(' ')">
                      {{ event.text.join(' ') }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>

              <a-col :span="12">
                <a-form-item v-bind="validateInfos['notification.type']">
                  <a-select
                    v-model:value="hook.notification.type"
                    size="large"
                    class="nc-select-hook-notification-type"
                    :placeholder="$t('general.notification')"
                    dropdown-class-name="nc-dropdown-webhook-notification"
                    @change="onNotificationTypeChange(true)"
                  >
                    <a-select-option
                      v-for="(notificationOption, i) in notificationList"
                      :key="i"
                      :value="notificationOption.type"
                    >
                      <div class="flex items-center">
                        <component :is="iconMap.link" v-if="notificationOption.type === 'URL'" class="mr-2" />

                        <component :is="iconMap.email" v-if="notificationOption.type === 'Email'" class="mr-2" />

                        <MdiSlack v-if="notificationOption.type === 'Slack'" class="mr-2" />

                        <MdiMicrosoftTeams v-if="notificationOption.type === 'Microsoft Teams'" class="mr-2" />

                        <MdiDiscord v-if="notificationOption.type === 'Discord'" class="mr-2" />

                        <MdiChat v-if="notificationOption.type === 'Mattermost'" class="mr-2" />

                        <MdiWhatsapp v-if="notificationOption.type === 'Whatsapp Twilio'" class="mr-2" />

                        <MdiCellphoneMessage v-if="notificationOption.type === 'Twilio'" class="mr-2" />

                        {{ notificationOption.type }}
                      </div>
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>

            <a-row v-if="hook.notification.type === 'URL'" class="mb-5" type="flex" :gutter="[16, 0]">
              <a-col :span="6">
                <div>Action</div>
                <a-select
                  v-model:value="hook.notification.payload.method"
                  size="large"
                  class="nc-select-hook-url-method"
                  dropdown-class-name="nc-dropdown-hook-notification-url-method"
                >
                  <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">
                    {{ method.title }}
                  </a-select-option>
                </a-select>
              </a-col>

              <a-col :span="18">
                <div>Link</div>
                <a-form-item v-bind="validateInfos['notification.payload.path']">
                  <a-input
                    v-model:value="hook.notification.payload.path"
                    size="large"
                    placeholder="http://example.com"
                    class="nc-text-field-hook-url-path !rounded-md"
                  />
                </a-form-item>
              </a-col>

              <a-col :span="24">
                <a-tabs v-model:activeKey="urlTabKey" type="card" closeable="false" class="">
                  <a-tab-pane v-if="isBodyShown" key="body" tab="Body">
                    <LazyMonacoEditor
                      v-model="hook.notification.payload.body"
                      disable-deep-compare
                      :validate="false"
                      class="min-h-60 max-h-80"
                    />
                  </a-tab-pane>

                  <a-tab-pane key="params" tab="Parameters" force-render>
                    <LazyApiClientParams v-model="hook.notification.payload.parameters" />
                  </a-tab-pane>

                  <a-tab-pane key="headers" tab="Headers" class="nc-tab-headers">
                    <LazyApiClientHeaders v-model="hook.notification.payload.headers" />
                  </a-tab-pane>

                  <!-- No in use at this moment -->
                  <!--            <a-tab-pane key="auth" tab="Auth"> -->
                  <!--              <LazyMonacoEditor v-model="hook.notification.payload.auth" class="min-h-60 max-h-80" /> -->

                  <!--              <span class="text-gray-500 prose-sm p-2"> -->
                  <!--                For more about auth option refer -->
                  <!--                <a class="prose-sm" href  ="https://github.com/axios/axios#request-config" target="_blank">axios docs</a>. -->
                  <!--              </span> -->
                  <!--            </a-tab-pane> -->
                </a-tabs>
              </a-col>
            </a-row>

            <a-row v-if="hook.notification.type === 'Slack'" type="flex">
              <a-col :span="24">
                <a-form-item v-bind="validateInfos['notification.payload.channels']">
                  <LazyWebhookChannelMultiSelect
                    v-model="hook.notification.payload.channels"
                    :selected-channel-list="hook.notification.payload.channels"
                    :available-channel-list="slackChannels"
                    placeholder="Select Slack channels"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row v-if="hook.notification.type === 'Microsoft Teams'" type="flex">
              <a-col :span="24">
                <a-form-item v-bind="validateInfos['notification.payload.channels']">
                  <LazyWebhookChannelMultiSelect
                    v-model="hook.notification.payload.channels"
                    :selected-channel-list="hook.notification.payload.channels"
                    :available-channel-list="teamsChannels"
                    placeholder="Select Microsoft Teams channels"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row v-if="hook.notification.type === 'Discord'" type="flex">
              <a-col :span="24">
                <a-form-item v-bind="validateInfos['notification.payload.channels']">
                  <LazyWebhookChannelMultiSelect
                    v-model="hook.notification.payload.channels"
                    :selected-channel-list="hook.notification.payload.channels"
                    :available-channel-list="discordChannels"
                    placeholder="Select Discord channels"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row v-if="hook.notification.type === 'Mattermost'" type="flex">
              <a-col :span="24">
                <a-form-item v-bind="validateInfos['notification.payload.channels']">
                  <LazyWebhookChannelMultiSelect
                    v-model="hook.notification.payload.channels"
                    :selected-channel-list="hook.notification.payload.channels"
                    :available-channel-list="mattermostChannels"
                    placeholder="Select Mattermost channels"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row v-if="formInput[hook.notification.type] && hook.notification.payload" type="flex">
              <a-col v-for="(input, i) in formInput[hook.notification.type]" :key="i" :span="24">
                <a-form-item v-if="input.type === 'LongText'" v-bind="validateInfos[`notification.payload.${input.key}`]">
                  <a-textarea v-model:value="hook.notification.payload[input.key]" :placeholder="input.label" size="large" />
                </a-form-item>

                <a-form-item v-else v-bind="validateInfos[`notification.payload.${input.key}`]">
                  <a-input v-model:value="hook.notification.payload[input.key]" :placeholder="input.label" size="large" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row class="mb-5" type="flex">
              <a-col :span="24">
                <a-card>
                  <a-checkbox
                    :checked="Boolean(hook.condition)"
                    class="nc-check-box-hook-condition"
                    @update:checked="hook.condition = $event"
                  >
                    On Condition
                  </a-checkbox>

                  <LazySmartsheetToolbarColumnFilter
                    v-if="hook.condition"
                    ref="filterRef"
                    class="mt-4"
                    :auto-save="false"
                    :show-loading="false"
                    :hook-id="hook.id"
                    :web-hook="true"
                  />
                </a-card>
              </a-col>
            </a-row>

            <a-row>
              <a-col :span="24">
                <div v-if="isBodyShown" class="text-gray-600">
                  <div class="flex items-center">
                    <em>Use context variable <strong>data</strong> to refer the record under consideration</em>

                    <a-tooltip bottom>
                      <template #title>
                        <span> <strong>data</strong> : Row data <br /> </span>
                      </template>
                      <component :is="iconMap.info" class="ml-2" />
                    </a-tooltip>
                  </div>

                  <div class="my-3">
                    <a href="https://docs.nocodb.com/developer-resources/webhooks/" target="_blank">
                      <!-- Document Reference -->
                      {{ $t('labels.docReference') }}
                    </a>
                  </div>
                </div>

                <LazyWebhookTest
                  ref="webhookTestRef"
                  :hook="{
                    ...hook,
                    notification: {
                      ...hook.notification,
                      payload: hook.notification.payload,
                    },
                  }"
                />
              </a-col>
            </a-row>
          </a-form-item>
        </a-form>
      </div>
      <div v-if="showLogs" class="nc-webhook-calllog flex w-1/2">
        <LazyWebhookCallLog :hook="hook" />
      </div>
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
</style>
