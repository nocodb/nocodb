<script setup lang="ts">
import { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { PluginType } from 'nocodb-sdk'
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
import { fieldRequiredValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Option {
  label: string
  value: string
}

const { $state, $api, $e } = useNuxtApp()

const toast = useToast()

const meta = inject(MetaInj)

const useForm = Form.useForm

const hook = reactive({
  title: '',
  notification: {
    type: 'URL',
    channels: '',
  },
  method: 'GET',
})

const apps: Record<string, any> = ref()

const slackChannels = ref()

const teamsChannels = ref()

const discordChannels = ref()

const mattermostChannels = ref()

const filters = []

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

const notification = ref({})

const eventList = ref([
  {
    title: 'After Insert',
    value: 'after insert',
  },
  {
    title: 'After Update',
    value: 'after update',
  },
  {
    title: 'After Delete',
    value: 'after delete',
  },
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
    'event': [fieldRequiredValidator],
    'notification.type': [fieldRequiredValidator],
    'notification.url': [fieldRequiredValidator],
    'notification.channels': [fieldRequiredValidator],
    'method': [fieldRequiredValidator],
  }
})
const { resetFields, validate, validateInfos } = useForm(hook, validators)

function onNotTypeChange() {
  notification.value = {}

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
    notification.value = notification.value || {}
    notification.value.body = '{{ json data }}'
  }
}

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
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
  } catch (e: any) {
    toast.error(extractSdkResponseErrorMsg(e))
  }
}

onMounted(() => {
  loadPluginList()
})
</script>

<template>
  <div class="float-left pt-3">
    <a-typography-title class="inline" :level="4">{{ meta.title }} : Webhooks </a-typography-title>
  </div>
  <div class="float-right mb-5">
    <a-button class="mr-3" type="primary" size="large" @click="emit('editOrAdd')">
      <div class="flex items-center">
        <MdiGestureDoubleTapIcon class="mr-2" />
        <!-- TODO: i18n -->
        Test Webhook
      </div>
    </a-button>
    <a-button class="mt-2" type="primary" size="large" @click="emit('editOrAdd')">
      <div class="flex items-center">
        <MdiContentSaveIcon class="mr-2" />
        <!-- TODO: i18n -->
        Save
      </div>
    </a-button>
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
          <a-form-item v-bind="validateInfos.event">
            <a-select v-model:value="hook.event" size="large" :placeholder="$t('general.event')">
              <a-select-option v-for="(event, i) in eventList" :key="i" :value="event.value">
                {{ event.title }}
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
      <a-row v-if="hook.notification.type === 'URL'" class="mb-5" type="flex" :gutter="[16, 16]">
        <a-col :span="6">
          <a-select v-model:value="hook.method" size="large">
            <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">{{ method.title }}</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="18">
          <a-form-item v-bind="validateInfos['notification.url']">
            <a-input v-model:value="hook.notification.url" size="large" placeholder="http://example.com" />
          </a-form-item>
        </a-col>
        <!-- TODO: add Body, Params Headers & Auth Tabs -->
      </a-row>
      <a-row v-if="hook.notification.type === 'Slack'" type="flex">
        <a-col :span="24">
          <a-form-item v-bind="validateInfos['notification.channels']">
            <a-auto-complete
              v-model:value="hook.notification.channels"
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
              v-model:value="hook.notification.channels"
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
              v-model:value="hook.notification.channels"
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
              v-model:value="hook.notification.channels"
              size="large"
              :options="mattermostChannels"
              placeholder="Select Mattermost channels"
              :filter-option="filterOption"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="formInput[hook.notification.type] && notification" type="flex">
        <a-col v-for="(input, i) in formInput[hook.notification.type]" :key="i" :span="24">
          <a-form-item v-if="input.type === 'LongText'">
            <!--  TODO: add validator -->
            <a-textarea :key="input.key" v-model:value="notification[input.key]" outlined :placeholder="input.label" />
          </a-form-item>
          <a-form-item v-else>
            <!--  TODO: add validator -->
            <a-input :key="input.key" v-model:value="notification[input.key]" class="caption" :placeholder="input.label" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row class="mb-5" type="flex">
        <a-col :span="24">
          <a-checkbox v-model:checked="hook.condition">On Condition</a-checkbox>
          <SmartsheetToolbarColumnFilter v-if="hook.condition" />
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
            :hook="{
              ...hook,
              filters,
              notification: {
                ...hook.notification,
                payload: notification,
              },
            }"
          />
        </a-col>
      </a-row>
    </a-form-item>
  </a-form>
</template>
