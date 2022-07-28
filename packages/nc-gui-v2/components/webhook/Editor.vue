<script setup lang="ts">
import { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { MetaInj } from '~/context'
import MdiContentSaveIcon from '~icons/mdi/content-save'
import MdiLinkIcon from '~icons/mdi/link'
import MdiEmailIcon from '~icons/mdi/email'
import MdiSlackIcon from '~icons/mdi/slack'
import MdiMicrosoftTeamsIcon from '~icons/mdi/microsoft-teams'
import MdiDiscordIcon from '~icons/mdi/discord'
import MdiChatIcon from '~icons/mdi/chat'
import MdiWhatsAppIcon from '~icons/mdi/whatsapp'
import MdiCellPhoneMessageIcon from '~icons/mdi/cellphone-message'
import MdiGestureDoubleTapIcon from '~icons/mdi/gesture-double-tap'
import MdiInformationIcon from '~icons/mdi/information'
import MdiArrowLeftBoldIcon from '~icons/mdi/arrow-left-bold'
import { fieldRequiredValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Option {
  label: string
  value: string
}

const emit = defineEmits(['backToList', 'editOrAdd'])

const { $state, $api, $e } = useNuxtApp()

const toast = useToast()

const meta = inject(MetaInj)

const useForm = Form.useForm

const hook = reactive({
  id: '',
  title: '',
  event: '',
  operation: '',
  eventOperation: '',
  notification: {
    type: 'URL',
    payload: {} as any,
  },
  condition: false,
})

const urlTabKey = ref('body')

const apps: Record<string, any> = ref()

const webhookTestRef = ref()

const slackChannels = ref<Record<string, any>[]>([])

const teamsChannels = ref<Record<string, any>[]>([])

const discordChannels = ref<Record<string, any>[]>([])

const mattermostChannels = ref<Record<string, any>[]>([])

const loading = ref(false)

const filters = ref([])

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

const eventList = ref([
  // {text: ["Before", "Insert"], value: ['before', 'insert']},
  { text: ['After', 'Insert'], value: ['after', 'insert'] },
  // {text: ["Before", "Update"], value: ['before', 'update']},
  { text: ['After', 'Update'], value: ['after', 'update'] },
  // {text: ["Before", "Delete"], value: ['before', 'delete']},
  { text: ['After', 'Delete'], value: ['after', 'delete'] },
])

const notificationList = ref([
  { type: 'URL' },
  { type: 'Email' },
  { type: 'Slack' },
  { type: 'Microsoft Teams' },
  { type: 'Discord' },
  { type: 'Mattermost' },
  { type: 'Twilio' },
  { type: 'Whatsapp Twilio' },
])

const methodList = ref([
  { title: 'GET' },
  { title: 'POST' },
  { title: 'DELETE' },
  { title: 'PUT' },
  { title: 'HEAD' },
  { title: 'PATCH' },
])

const validators = computed(() => {
  return {
    'title': [fieldRequiredValidator],
    'eventOperation': [fieldRequiredValidator],
    'notification.type': [fieldRequiredValidator],
    ...(hook.notification.type === 'URL' && {
      'notification.payload.method': [fieldRequiredValidator],
      'notification.payload.path': [fieldRequiredValidator],
    }),
    ...(hook.notification.type === 'Email' && {
      'notification.payload.to': [fieldRequiredValidator],
      'notification.payload.subject': [fieldRequiredValidator],
      'notification.payload.body': [fieldRequiredValidator],
    }),
    ...((hook.notification.type === 'Slack' ||
      hook.notification.type === 'Microsoft Teams' ||
      hook.notification.type === 'Discord' ||
      hook.notification.type === 'Mattermost') && {
      'notification.payload.channels': [fieldRequiredValidator],
      'notification.payload.body': [fieldRequiredValidator],
    }),
    ...((hook.notification.type === 'Twilio' || hook.notification.type === 'Whatsapp Twilio') && {
      'notification.payload.body': [fieldRequiredValidator],
      'notification.payload.to': [fieldRequiredValidator],
    }),
  }
})
const { resetFields, validate, validateInfos } = useForm(hook, validators)

function onNotTypeChange() {
  hook.notification.payload = {} as any

  if (hook.notification.type === 'Slack') {
    slackChannels.value = (apps && apps?.Slack && apps.Slack.parsedInput) || []
  }
  if (hook.notification.type === 'Microsoft Teams') {
    teamsChannels.value = (apps && apps['Microsoft Teams'] && apps['Microsoft Teams'].parsedInput) || []
  }
  if (hook.notification.type === 'Discord') {
    discordChannels.value = (apps && apps.Discord && apps.Discord.parsedInput) || []
  }
  if (hook.notification.type === 'Mattermost') {
    mattermostChannels.value = (apps && apps.Mattermost && apps.Mattermost.parsedInput) || []
  }
  if (hook.notification.type === 'URL') {
    hook.notification.payload.body = '{{ json data }}'
  }
}

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}

function setHook(newHook: any) {
  Object.assign(hook, {
    ...newHook,
    notification: {
      ...newHook.notification,
      payload: newHook.notification.payload,
    },
  })
}

async function onEventChange() {
  const { notification: { payload = {}, type = {} } = {}, ...rest } = hook

  Object.assign(hook, {
    ...hook,
    notification: {
      type,
      payload,
    },
  })

  hook.notification.payload = payload

  let channels: Record<string, any>[] | null = null

  switch (hook.notification.type) {
    case 'Slack':
      channels = slackChannels as any
      break
    case 'Microsoft Teams':
      channels = teamsChannels as any
      break
    case 'Discord':
      channels = discordChannels as any
      break
    case 'Mattermost':
      channels = mattermostChannels as any
      break
  }

  if (channels) {
    hook.notification.payload.webhook_url =
      hook.notification.payload.webhook_url &&
      hook.notification.payload.webhook_url.map((v: Record<string, any>) =>
        channels?.find((s: Record<string, any>) => v.webhook_url === s.webhook_url),
      )
  }

  if (hook.notification.type === 'URL') {
    hook.notification.payload = hook.notification.payload || {}
  }
}

async function loadPluginList() {
  try {
    const plugins = (await $api.plugin.list()).list as any
    apps.value = plugins.reduce((o: Record<string, any>[], p: Record<string, any>) => {
      p.tags = p.tags ? p.tags.split(',') : []
      p.parsedInput = p.input && JSON.parse(p.input)
      o[p.title] = p
      return o
    }, {})

    if (hook.event && hook.operation) {
      hook.eventOperation = `${hook.event} ${hook.operation}`
    }
  } catch (e: any) {
    toast.error(extractSdkResponseErrorMsg(e))
  }
}

async function saveHooks() {
  loading.value = true
  try {
    await validate()
  } catch (_: any) {
    toast.error('Invalid Form')
    loading.value = false
    return
  }

  try {
    let res
    if (hook.id) {
      res = await $api.dbTableWebhook.update(hook.id, {
        ...hook,
        notification: {
          ...hook.notification,
          payload: hook.notification.payload,
        },
      } as any)
    } else {
      res = await $api.dbTableWebhook.create(
        meta?.value.id as string,
        {
          ...hook,
          notification: {
            ...hook.notification,
            payload: hook.notification.payload,
          },
        } as any,
      )
    }

    if (!hook.id && res) {
      // hook.id = res.id
    }

    // TODO: wait for filter implementation
    // if ($refs.filter) {
    //   await $refs.filter.applyChanges(false, {
    //     hookId: hook.id,
    //   });
    // }

    toast.success('Webhook details updated successfully')
  } catch (e: any) {
    toast.error(extractSdkResponseErrorMsg(e))
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

defineExpose({
  onEventChange,
  setHook,
})

watch(
  () => hook.eventOperation,
  (v) => {
    const [event, operation] = hook.eventOperation.split(' ')
    hook.event = event
    hook.operation = operation
  },
)

onMounted(() => {
  loadPluginList()
})
</script>

<template>
  <div class="mb-4">
    <div class="float-left mt-2">
      <div class="flex items-center">
        <MdiArrowLeftBoldIcon class="mr-3 text-xl cursor-pointer" @click="emit('backToList')" />
        <span class="inline text-xl font-bold">{{ meta.title }} : {{ hook.title || 'Webhooks' }} </span>
      </div>
    </div>
    <div class="float-right mb-5">
      <a-button class="mr-3" type="primary" size="large" @click="testWebhook">
        <div class="flex items-center">
          <MdiGestureDoubleTapIcon class="mr-2" />
          <!-- TODO: i18n -->
          Test Webhook
        </div>
      </a-button>
      <a-button type="primary" size="large" @click.prevent="saveHooks">
        <div class="flex items-center">
          <MdiContentSaveIcon class="mr-2" />
          <!-- Save -->
          {{ $t('general.save') }}
        </div>
      </a-button>
    </div>
  </div>
  <a-divider />
  <a-form :model="hook" name="create-or-edit-webhook">
    <a-form-item>
      <a-row type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos.title">
            <a-input v-model:value="hook.title" size="large" :placeholder="$t('general.title')" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row type="flex" :gutter="[16, 16]">
        <a-col :span="12">
          <a-form-item v-bind="validateInfos.eventOperation">
            <a-select v-model:value="hook.eventOperation" size="large" :placeholder="$t('general.event')">
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
              :placeholder="$t('general.notification')"
              @change="onNotTypeChange"
            >
              <a-select-option v-for="(notificationOption, i) in notificationList" :key="i" :value="notificationOption.type">
                <div class="flex items-center">
                  <MdiLinkIcon v-if="notificationOption.type === 'URL'" class="mr-2" />
                  <MdiEmailIcon v-if="notificationOption.type === 'Email'" class="mr-2" />
                  <MdiSlackIcon v-if="notificationOption.type === 'Slack'" class="mr-2" />
                  <MdiMicrosoftTeamsIcon v-if="notificationOption.type === 'Microsoft Teams'" class="mr-2" />
                  <MdiDiscordIcon v-if="notificationOption.type === 'Discord'" class="mr-2" />
                  <MdiChatIcon v-if="notificationOption.type === 'Mattermost'" class="mr-2" />
                  <MdiWhatsAppIcon v-if="notificationOption.type === 'Whatsapp Twilio'" class="mr-2" />
                  <MdiCellPhoneMessageIcon v-if="notificationOption.type === 'Twilio'" class="mr-2" />
                  {{ notificationOption.type }}
                </div>
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="hook.notification.type === 'URL'" class="mb-5" type="flex" :gutter="[16, 0]">
        <a-col :span="6">
          <a-select v-model:value="hook.notification.payload.method" size="large">
            <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">{{ method.title }}</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="18">
          <a-form-item v-bind="validateInfos['notification.payload.path']">
            <a-input v-model:value="hook.notification.payload.path" size="large" placeholder="http://example.com" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-tabs v-model:activeKey="urlTabKey" centered>
            <a-tab-pane key="body" tab="Body">
              <MonacoEditor v-model="hook.notification.payload.body" :validate="false" class="min-h-60 max-h-80" />
            </a-tab-pane>
            <a-tab-pane key="params" tab="Params" force-render>
              <ApiClientParams v-model="hook.notification.payload.parameters" />
            </a-tab-pane>
            <a-tab-pane key="headers" tab="Headers">
              <ApiClientHeaders v-model="hook.notification.payload.headers" />
            </a-tab-pane>
            <a-tab-pane key="auth" tab="Auth">
              <MonacoEditor v-model="hook.notification.payload.auth" class="min-h-60 max-h-80" />
              <span class="text-gray-600 prose-sm">
                For more about auth option refer
                <a class="prose-sm" href="https://github.com/axios/axios#request-config" target="_blank">axios docs</a>.
              </span>
            </a-tab-pane>
          </a-tabs>
        </a-col>
      </a-row>
      <a-row v-if="hook.notification.type === 'Slack'" type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos['notification.channels']">
            <a-auto-complete
              v-model:value="hook.notification.payload.channels"
              size="large"
              :options="slackChannels"
              placeholder="Select Slack channels"
              :filter-option="filterOption"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="hook.notification.type === 'Microsoft Teams'" type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos['notification.channels']">
            <a-auto-complete
              v-model:value="hook.notification.payload.channels"
              size="large"
              :options="teamsChannels"
              placeholder="Select Microsoft Teams channels"
              :filter-option="filterOption"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="hook.notification.type === 'Discord'" type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos['notification.channels']">
            <a-auto-complete
              v-model:value="hook.notification.payload.channels"
              size="large"
              :options="discordChannels"
              placeholder="Select Discord channels"
              :filter-option="filterOption"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="hook.notification.type === 'Mattermost'" type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos['notification.channels']">
            <a-auto-complete
              v-model:value="hook.notification.payload.channels"
              size="large"
              :options="mattermostChannels"
              placeholder="Select Mattermost channels"
              :filter-option="filterOption"
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
            <a-checkbox v-model:checked="hook.condition">On Condition</a-checkbox>
            <SmartsheetToolbarColumnFilter v-if="hook.condition" />
          </a-card>
        </a-col>
      </a-row>
      <a-row>
        <a-col :span="24">
          <div class="text-gray-600">
            <em>Available context variables are <strong>data and user</strong></em>

            <a-tooltip bottom>
              <template #title>
                <span>
                  <strong>data</strong> : Row data <br />
                  <strong>user</strong> : User information<br />
                </span>
              </template>
              <MdiInformationIcon class="ml-2" />
            </a-tooltip>

            <div class="mt-3">
              <a href="https://docs.nocodb.com/developer-resources/webhooks/" target="_blank">
                <!-- Document Reference -->
                {{ $t('labels.docReference') }}
              </a>
            </div>
          </div>
          <WebhookTest
            ref="webhookTestRef"
            :hook="{
              ...hook,
              filters,
              notification: {
                ...hook.notification,
                // FIXME: this should be wrong
                payload: notification,
              },
            }"
          />
        </a-col>
      </a-row>
    </a-form-item>
  </a-form>
</template>
