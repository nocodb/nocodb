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
  return {}
})
const { resetFields, validate, validateInfos } = useForm(formState, validators)

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
      <a-row class="mb-5" type="flex" :gutter="[16, 16]">
        <a-col :span="12">
          <a-form-item v-bind="validateInfos.event">
            <a-select v-model:value="formState.event" size="large" :placeholder="$t('general.event')">
              <a-select-option v-for="(event, i) in eventList" :key="i" :value="event.value">{{ event.title }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item v-bind="validateInfos.notification.type">
            <a-select v-model:value="formState.notification.type" size="large" :placeholder="$t('general.notification')">
              <a-select-option v-for="(notification, i) in notificationList" :key="i" :value="notification.type">{{
                notification.type
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
          <a-input></a-input>
        </a-col>
      </a-row>

      <a-row v-if="formState.notification.type === 'Slack'" class="mb-5" type="flex"> TODO: Slack </a-row>
      <a-row v-if="formState.notification.type === 'Microsoft Teams'" class="mb-5" type="flex"> TODO: Microsoft Teams </a-row>
      <a-row v-if="formState.notification.type === 'Discord'" class="mb-5" type="flex"> TODO: Discord </a-row>
      <a-row v-if="formState.notification.type === 'Mattermost'" class="mb-5" type="flex"> TODO: Mattermost </a-row>
      <!--  TODO: handle inputs[hook.notification.type] -->
      <!--  TODO: handle column filter -->
      <!--  TODO: sample payload -->
    </a-form-item>
  </a-form>
</template>
