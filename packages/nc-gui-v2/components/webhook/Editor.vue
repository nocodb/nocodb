<script setup lang="ts">
import { Form } from 'ant-design-vue'
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'
import { MetaInj } from '~/context'
import useViews from '~/composables/useViews'
import MdiContentSaveIcon from '~icons/mdi/content-save'

const meta = inject(MetaInj)
const { views, loadViews } = useViews(meta as Ref<TableType>)

const useForm = Form.useForm
const formState = reactive({
  title: '',
  notification: {
    type: 'URL',
  },
  method: 'GET',
})
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
const notification = ref({
  method: 'POST',
  body: '{{ json data }}',
})

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
    'title': [],
    'event': [],
    'notification.type': [],
    'method': [],
  }
})
const { resetFields, validate, validateInfos } = useForm(formState, validators)

function onNotTypeChange() {
  // TODO
}

onMounted(() => {
  loadViews()
})
</script>

<template>
  <div class="float-left pt-3">
    <a-typography-title class="inline" :level="4">{{ views?.[0].title }} : Webhooks </a-typography-title>
  </div>
  <div class="float-right mb-5">
    <a-button class="mr-3" type="primary" size="large" @click="emit('editOrAdd')">
      <div class="flex items-center">
        <MdiContentSaveIcon class="mr-2" />
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
  <a-form :model="formState" name="create-or-edit-webhook">
    <a-form-item>
      <a-row class="mb-5" type="flex">
        <a-input v-model:value="formState.title" size="large" :placeholder="$t('general.title')" />
      </a-row>
      <a-row type="flex" :gutter="[16, 16]">
        <a-col :span="12">
          <a-form-item v-bind="validateInfos.event">
            <a-select v-model:value="formState.event" size="large" :placeholder="$t('general.event')">
              <a-select-option v-for="(event, i) in eventList" :key="i" :value="event.value">{{ event.title }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item v-bind="validateInfos['notification.type']">
            <a-select
              v-model:value="formState.notification.type"
              size="large"
              :placeholder="$t('general.notification')"
              @change="onNotTypeChange"
            >
              <a-select-option v-for="(notificationOption, i) in notificationList" :key="i" :value="notificationOption.type">{{
                notificationOption.type
              }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="formState.notification.type === 'URL'" class="mb-5" type="flex" :gutter="[16, 16]">
        <a-col :span="6">
          <a-select v-model:value="formState.method" size="large">
            <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">{{ method.title }}</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="18">
          <a-form-item v-bind="validateInfos['notification.url']">
            <a-input v-model:value="formState.url" size="large" placeholder="http://example.com" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row v-if="formState.notification.type === 'Slack'" class="mb-5" type="flex"> TODO: Slack </a-row>
      <a-row v-if="formState.notification.type === 'Microsoft Teams'" class="mb-5" type="flex"> TODO: Microsoft Teams </a-row>
      <a-row v-if="formState.notification.type === 'Discord'" class="mb-5" type="flex"> TODO: Discord </a-row>
      <a-row v-if="formState.notification.type === 'Mattermost'" class="mb-5" type="flex"> TODO: Mattermost </a-row>
      <a-row v-if="formInput[formState.notification.type] && notification" class="mb-5" type="flex">
        <a-col v-for="(input, i) in formInput[formState.notification.type]" :key="i" :span="24">
          <a-form-item v-if="input.type === 'LongText'">
            <a-textarea
              :key="input.key"
              v-model:value="notification[input.key]"
              outlined
              :placeholder="input.label"
              :rules="[(v) => !input.required || !!v || `${$t('general.required')}`]"
            />
          </a-form-item>
          <a-form-item v-else>
            <a-input
              :key="input.key"
              v-model:value="notification[input.key]"
              class="caption"
              :placeholder="input.label"
              :rules="[(v) => !input.required || !!v || `${$t('general.required')}`]"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <!--  TODO: handle column filter -->
      <div>
        <span class="caption grey--text">
          <em>Available context variables are <strong>data and user</strong></em>
          <v-tooltip top>
            <template #activator="{ on }">
              <v-icon small color="grey" class="ml-2" v-on="on">mdi-information</v-icon>
            </template>
            <span class="caption">
              <strong>data</strong> : Row data <br />
              <strong>user</strong> : User information<br />
            </span>
          </v-tooltip>
          <br />
          <a href="https://docs.nocodb.com/developer-resources/webhooks/" target="_blank">
            <!-- Document Reference -->
            {{ $t('labels.docReference') }}
          </a>
        </span>
        <WebhookTest
          :hook="{
            ...formState,
            filters,
            notification: {
              ...formState.notification,
              payload: notification,
            },
          }"
        />
      </div>
    </a-form-item>
  </a-form>
</template>
