<script setup lang="ts">
import type { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { onKeyDown } from '@vueuse/core'

import { extractNextDefaultName } from '~/helpers/parsers/parserHelpers'

interface Props {
  value: boolean
  eventList: Record<string, any>[]
  hook?: HookType
}

const props = defineProps<Props>()

const emits = defineEmits(['close', 'update:value'])

enum HookTab {
  Configuration = 'configuration',
  Log = 'log',
}

const { eventList } = toRefs(props)

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { api, isLoading: loading } = useApi()

const modalVisible = useVModel(props, 'value')

const { hooks } = storeToRefs(useWebhooksStore())

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const { getMeta } = useMetas()

const { activeTable } = toRefs(useTablesStore())

const defaultHookName = t('labels.webhook')

const testSuccess = ref()

const testConnectionError = ref('')

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
      headers: [
        {
          enabled: false,
          name: '',
          value: '',
        },
      ],
      parameters: [
        {
          enabled: false,
          name: '',
          value: '',
        },
      ],
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

const getChannelsArray = (val: unknown) => {
  if (val) {
    if (Array.isArray(val)) {
      return val
    } else if (typeof val === 'object' && Object.keys(val)) {
      return [val]
    }
  }
  return []
}

function onNotificationTypeChange(reset = false) {
  if (reset) {
    hookRef.notification.payload = {} as Record<string, any>
    if (['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hookRef.notification.type)) {
      hookRef.notification.payload.channels = []
      hookRef.notification.payload.body = ''
    }
  }

  if (hookRef.notification.type === 'Slack') {
    slackChannels.value = getChannelsArray(apps?.value?.Slack?.parsedInput)
  }

  if (hookRef.notification.type === 'Microsoft Teams') {
    teamsChannels.value = getChannelsArray(apps?.value?.['Microsoft Teams']?.parsedInput)
  }

  if (hookRef.notification.type === 'Discord') {
    discordChannels.value = getChannelsArray(apps?.value?.Discord?.parsedInput)
  }

  if (hookRef.notification.type === 'Mattermost') {
    mattermostChannels.value = getChannelsArray(apps?.value?.Mattermost?.parsedInput)
  }

  if (hookRef.notification.type === 'URL') {
    const body = hookRef.notification.payload.body
    hookRef.notification.payload.body = body ? (body === '{{ json data }}' ? '{{ json event }}' : body) : '{{ json event }}'
    hookRef.notification.payload.parameters = hookRef.notification.payload.parameters || [{}]
    hookRef.notification.payload.headers = hookRef.notification.payload.headers || [{}]
    hookRef.notification.payload.method = hookRef.notification.payload.method || 'POST'
    hookRef.notification.payload.auth = hookRef.notification.payload.auth ?? ''
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
  return hookRef.eventOperation && !(hookRef.eventOperation.includes('bulk') || hookRef.eventOperation.includes('manual'))
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

    $e('a:webhook:add', {
      operation: hookRef.operation,
      condition: hookRef.condition,
      notification: hookRef.notification.type,
    })

    emits('close', hookRef)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    getMeta(activeTable.value.id, true)
    loading.value = false
  }
}

const closeModal = () => {
  emits('close', hookRef)
}

const isTestLoading = ref(false)

const sampleData = ref()

const containerElem = ref()

const activeTab = ref<HookTab>(HookTab.Configuration)

const [isVisible, toggleVisibility] = useToggle()

const toggleSamplePayload = () => {
  toggleVisibility()
  nextTick(() => {
    if (isVisible.value) {
      containerElem.value.scrollTop = containerElem.value.scrollHeight
    }
  })
}

async function testWebhook() {
  try {
    testConnectionError.value = ''
    testSuccess.value = false
    isTestLoading.value = true
    await $api.dbTableWebhook.test(
      meta.value?.id as string,
      {
        hook: hookRef,
        payload: sampleData.value,
      } as HookTestReqType,
    )
    testSuccess.value = true
  } catch (e: any) {
    testConnectionError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isTestLoading.value = false
  }
}

const supportedDocs = [
  {
    title: 'Getting started',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook/',
  },
  {
    title: 'Create webhook',
    href: 'https://docs.nocodb.com/automation/webhook/webhook-overview',
  },
  {
    title: 'Custom payload',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook#webhook-with-custom-payload-',
  },
  {
    title: 'Trigger on condition',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook#webhook-with-conditions',
  },
]

watch(
  () => hookRef?.operation,
  async () => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  sampleData.value = await $api.dbTableWebhook.samplePayloadGet(
    meta?.value?.id as string,
    hookRef?.operation || 'insert',
    hookRef.version!,
  )
}

const getDefaultHookName = (hooks: HookType[]) => {
  return extractNextDefaultName([...hooks.map((el) => el?.title || '')], defaultHookName)
}

const getNotificationIconName = (type: string): keyof typeof iconMap => {
  switch (type) {
    case 'URL':
      return 'link2'
    case 'Email':
      return 'mail'
    case 'Slack':
      return 'slack'
    case 'Microsoft Teams':
      return 'microsoftTeams'
    case 'Discord':
      return 'discord'
    case 'Mattermost':
      return 'mattermost'
    case 'Twilio':
      return 'twilio'
    case 'Whatsapp Twilio':
      return 'whatsapp'
  }
}

onKeyDown('Escape', () => {
  modalVisible.value = false
})

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

  until(() => titleDomRef.value as HTMLInputElement)
    .toBeTruthy()
    .then(() => {
      titleDomRef.value?.focus()
      titleDomRef.value?.select()
    })
})
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-webhook-create-edit">
    <template #header>
      <div class="flex w-full items-center px-4 py-2 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon class="text-gray-900 h-5 w-5" icon="ncWebhook" />
          <span class="text-gray-900 font-semibold text-xl">
            <template v-if="activeTab === HookTab.Configuration">
              {{ !hook ? $t('activity.newWebhook') : $t('activity.webhookDetails') }}
            </template>
            <template v-else>
              {{ $t('activity.webhookLogs') }}
            </template>
          </span>
        </div>

        <div v-if="hook && isEeUI" class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 nc-view-sidebar-tab">
          <div
            v-e="['c:webhook:edit']"
            class="tab"
            :class="{
              active: activeTab === HookTab.Configuration,
            }"
            @click="activeTab = HookTab.Configuration"
          >
            <div class="tab-title nc-tab">{{ $t('general.details') }}</div>
          </div>
          <div
            v-e="['c:webhook:log']"
            class="tab"
            :class="{
              active: activeTab === HookTab.Log,
            }"
            @click="activeTab = HookTab.Log"
          >
            <div class="tab-title nc-tab">{{ $t('general.logs') }}</div>
          </div>
        </div>

        <div class="flex justify-end items-center gap-3 flex-1">
          <template v-if="activeTab === HookTab.Configuration">
            <NcTooltip :disabled="!testConnectionError">
              <template #title>
                {{ testConnectionError }}
              </template>
              <NcButton :loading="isTestLoading" type="secondary" size="small" icon-position="right" @click="testWebhook">
                <template #icon>
                  <GeneralIcon v-if="testSuccess" icon="circleCheckSolid" class="!text-green-700 w-4 h-4 flex-none" />
                  <GeneralIcon
                    v-else-if="testConnectionError"
                    icon="alertTriangleSolid"
                    class="!text-red-700 w-4 h-4 flex-none"
                  />
                </template>
                <span>
                  {{ testSuccess ? 'Test Successful' : $t('activity.testWebhook') }}
                </span>
              </NcButton>
            </NcTooltip>

            <NcButton :loading="loading" type="primary" size="small" data-testid="nc-save-webhook" @click.stop="saveHooks">
              {{ hook ? $t('labels.multiField.saveChanges') : $t('activity.createWebhook') }}
            </NcButton>
          </template>
          <NcButton type="text" size="small" data-testid="nc-close-webhook-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>
    <div v-if="activeTab === HookTab.Configuration" class="flex bg-white rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-12 py-6 mx-auto"
      >
        <div style="max-width: 700px; min-width: 640px" class="mx-auto gap-8 flex flex-col">
          <a-form-item v-bind="validateInfos.title">
            <div
              class="flex flex-grow px-2 py-1 title-input items-center border-b-1 rounded-t-md border-gray-200 bg-gray-100"
              @click.prevent="titleDomRef?.focus()"
            >
              <input
                ref="titleDomRef"
                v-model="hookRef.title"
                class="flex flex-grow text-lg px-2 font-medium capitalize outline-none bg-inherit nc-text-field-hook-title"
                :placeholder="$t('placeholder.webhookTitle')"
                :contenteditable="true"
                @keydown.enter="titleDomRef?.blur()"
              />
              <GeneralIcon icon="rename" class="cursor-text" @click="titleDomRef?.focus()" />
            </div>
          </a-form-item>

          <a-form class="flex flex-col gap-8" :model="hookRef" name="create-or-edit-webhook">
            <div class="flex flex-col gap-4">
              <div class="flex w-full gap-3 custom-select">
                <a-form-item class="w-1/3" v-bind="validateInfos.eventOperation">
                  <a-select
                    v-model:value="hookRef.eventOperation"
                    size="medium"
                    :disabled="eventList.length === 1"
                    :placeholder="$t('general.event')"
                    class="nc-text-field-hook-event !h-9 capitalize"
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
                        <NcTooltip class="truncate" show-on-truncate-only>
                          <template #title>
                            {{ event.text.join(' ') }}
                          </template>
                          {{ event.text.join(' ') }}
                        </NcTooltip>
                        <component
                          :is="iconMap.check"
                          v-if="hookRef.eventOperation === event.value.join(' ')"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4 flex-none"
                        />
                      </div>
                    </a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item class="w-2/3" v-bind="validateInfos['notification.type']">
                  <a-select
                    v-model:value="hookRef.notification.type"
                    size="medium"
                    :disabled="isEeUI"
                    class="nc-select-hook-notification-type !h-9"
                    :placeholder="$t('general.notification')"
                    dropdown-class-name="nc-dropdown-webhook-notification"
                    @change="onNotificationTypeChange(true)"
                  >
                    <template #suffixIcon>
                      <GeneralIcon icon="arrowDown" class="text-gray-700" />
                    </template>
                    <a-select-option
                      v-for="(notificationOption, i) in notificationList"
                      :key="i"
                      :value="notificationOption.type"
                    >
                      <div class="flex items-center w-full gap-2">
                        <GeneralIcon :icon="getNotificationIconName(notificationOption.type)" class="mr-2 stroke-transparent" />

                        <div class="flex-1">{{ notificationOption.text }}</div>
                        <component
                          :is="iconMap.check"
                          v-if="hookRef.notification.type === notificationOption.type"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4 flex-none"
                        />
                      </div>
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </div>

              <div v-if="hookRef.notification.type === 'URL'" class="flex flex-col gap-8">
                <div class="flex flex-col custom-select w-full gap-4">
                  <div class="flex w-full gap-3">
                    <a-form-item class="w-1/3">
                      <a-select
                        v-model:value="hookRef.notification.payload.method"
                        size="medium"
                        class="nc-select-hook-url-method"
                        dropdown-class-name="nc-dropdown-hook-notification-url-method"
                      >
                        <template #suffixIcon>
                          <GeneralIcon icon="arrowDown" class="text-gray-700" />
                        </template>

                        <a-select-option v-for="(method, i) in methodList" :key="i" :value="method.title">
                          <div class="flex items-center gap-2 justify-between w-full">
                            <div>{{ method.title }}</div>
                            <component
                              :is="iconMap.check"
                              v-if="hookRef.notification.payload.method === method.title"
                              id="nc-selected-item-icon"
                              class="text-primary w-4 h-4 flex-none"
                            />
                          </div>
                        </a-select-option>
                      </a-select>
                    </a-form-item>

                    <a-form-item class="w-2/3" v-bind="validateInfos['notification.payload.path']">
                      <a-input
                        v-model:value="hookRef.notification.payload.path"
                        size="medium"
                        placeholder="http://example.com"
                        class="nc-text-field-hook-url-path nc-input-shadow h-9 !rounded-lg"
                      />
                    </a-form-item>
                  </div>
                </div>
                <div>
                  <NcTabs v-model:activeKey="urlTabKey">
                    <a-tab-pane key="params" :tab="$t('title.parameter')" force-render>
                      <LazyApiClientParams v-model="hookRef.notification.payload.parameters" />
                    </a-tab-pane>

                    <a-tab-pane key="headers" :tab="$t('title.headers')" class="nc-tab-headers">
                      <LazyApiClientHeaders v-model="hookRef.notification.payload.headers" />
                    </a-tab-pane>

                    <a-tab-pane v-if="isBodyShown" key="body" tab="Body">
                      <div
                        style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08), 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
                        class="my-3 mx-1 rounded-lg overflow-hidden"
                      >
                        <LazyMonacoEditor
                          v-model="hookRef.notification.payload.body"
                          lang="handlebars"
                          disable-deep-compare
                          :validate="false"
                          class="min-h-60 max-h-80 !rounded-lg"
                          :monaco-config="{
                            minimap: {
                              enabled: false,
                            },
                            padding: {
                              top: 8,
                              bottom: 8,
                            },
                            fontSize: 14.5,
                            overviewRulerBorder: false,
                            overviewRulerLanes: 0,
                            hideCursorInOverviewRuler: true,
                            lineDecorationsWidth: 8,
                            lineNumbersMinChars: 0,
                            roundedSelection: false,
                            selectOnLineNumbers: false,
                            scrollBeyondLastLine: false,
                            contextmenu: false,
                            glyphMargin: false,
                            folding: false,
                            bracketPairColorization: {
                              enabled: false,
                            },
                            wordWrap: 'on',
                            scrollbar: {
                              horizontal: 'hidden',
                              verticalScrollbarSize: 6,
                            },
                            wrappingStrategy: 'advanced',
                            renderLineHighlight: 'none',
                            tabSize: 4,
                          }"
                        />
                      </div>
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
            </div>

            <div v-if="isConditionSupport">
              <div class="w-full cursor-pointer flex items-center" @click.prevent="hookRef.condition = !hookRef.condition">
                <NcSwitch :checked="Boolean(hookRef.condition)" class="nc-check-box-hook-condition">
                  <span class="!text-gray-700 font-semibold"> {{ $t('general.trigger') }} {{ $t('activity.onCondition') }} </span>
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
                action-btn-type="secondary"
                @update:filters-length="hookRef.condition = $event > 0"
              />
            </div>

            <a-form-item v-if="formInput[hookRef.notification.type] && hookRef.notification.payload">
              <div class="flex flex-col gap-4">
                <div v-for="(input, i) in formInput[hookRef.notification.type]" :key="i">
                  <a-form-item v-if="input.type === 'LongText'" v-bind="validateInfos[`notification.payload.${input.key}`]">
                    <a-textarea
                      v-model:value="hookRef.notification.payload[input.key]"
                      class="!rounded-lg !min-h-[120px] nc-scrollbar-thin nc-input-shadow"
                      :placeholder="input.label"
                    />
                  </a-form-item>

                  <a-form-item v-else v-bind="validateInfos[`notification.payload.${input.key}`]">
                    <a-input
                      v-model:value="hookRef.notification.payload[input.key]"
                      class="!rounded-lg nc-input-shadow !h-9"
                      :placeholder="input.label"
                    />
                  </a-form-item>
                </div>
              </div>
            </a-form-item>

            <div>
              <div class="flex items-center justify-between -ml-1.5">
                <NcButton type="text" class="mb-3" size="small" @click="toggleSamplePayload()">
                  <div class="flex items-center gap-3">
                    Sample Payload

                    <GeneralIcon
                      class="transition-transform"
                      :class="{
                        'transform rotate-180': isVisible,
                      }"
                      icon="arrowDown"
                    />
                  </div>
                </NcButton>
              </div>
              <div v-show="isVisible">
                <LazyMonacoEditor
                  v-model="sampleData"
                  :monaco-config="{
                    minimap: {
                      enabled: false,
                    },
                    fontSize: 14.5,
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    lineDecorationsWidth: 12,
                    lineNumbersMinChars: 0,
                    roundedSelection: false,
                    selectOnLineNumbers: false,
                    scrollBeyondLastLine: false,
                    contextmenu: false,
                    glyphMargin: false,
                    folding: false,
                    bracketPairColorization: { enabled: false },
                    wordWrap: 'on',
                    scrollbar: {
                      horizontal: 'hidden',
                      verticalScrollbarSize: 6,
                    },
                    wrappingStrategy: 'advanced',
                    renderLineHighlight: 'none',
                    tabSize: 4,
                  }"
                  :monaco-custom-theme="{
                    base: 'vs',
                    inherit: true,
                    rules: [
                      { token: 'key', foreground: '#B33771', fontStyle: 'bold' },
                      { token: 'string', foreground: '#2B99CC', fontStyle: 'semibold' },
                      { token: 'number', foreground: '#1FAB51', fontStyle: 'semibold' },
                      { token: 'boolean', foreground: '#1FAB51', fontStyle: 'semibold' },
                      { token: 'delimiter', foreground: '#15171A', fontStyle: 'semibold' },
                    ],
                    colors: {},
                  }"
                  class="transition-all border-1 rounded-lg"
                  style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08), 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
                  :class="{
                    'w-0 min-w-0': !isVisible,
                    'min-h-60 max-h-80': isVisible,
                  }"
                />
              </div>
            </div>
          </a-form>
        </div>
      </div>

      <div class="h-full bg-gray-50 border-l-1 w-80 p-5 rounded-br-2xl border-gray-200">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-gray-700 font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-500" />
              </div>
              <NuxtLink
                :href="doc.href"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-gray-500 text-sm !no-underline !hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="activeTab === HookTab.Log" class="h-[calc(100%_-_66px)]">
      <WebhookCallLog :hook="hook" />
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-webhook-create-edit {
  z-index: 1050;
  a {
    @apply !no-underline !text-gray-700 !hover:text-primary;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>

<style scoped lang="scss">
.nc-button :not(.nc-icon):not(.material-symbols) {
  @apply !w-full;
}

.title-input {
  &:focus-within {
    @apply transition-all duration-0.3s border-b-brand-500;
    box-shadow: 0px 2px 0px 0px rgba(51, 102, 255, 0.24);
  }
}

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

.custom-select {
  :deep(.ant-select) {
    .ant-select-selector {
      @apply !h-9;
    }

    .ant-select-selection-item {
      @apply !h-9;
    }

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
:deep(.nc-tabs .ant-tabs-nav) {
  @apply pl-0;
  .ant-tabs-tab {
    @apply pt-1 pb-1.5;
  }
}
:deep(.ant-select-multiple .ant-select-selection-item-remove > .anticon) {
  vertical-align: 0px !important;
}

:deep(.mtk1) {
  @apply text-[#000000D9];
}

.tab {
  @apply flex flex-row items-center h-6 justify-center px-2 py-1 rounded-md gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0 text-sm;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white text-brand-600 hover:text-brand-600;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
