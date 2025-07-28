<script setup lang="ts">
import { type HookReqType, type HookTestReqType, type HookType, PlanLimitTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { onKeyDown } from '@vueuse/core'
import { UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { extractNextDefaultName } from '~/helpers/parsers/parserHelpers'

interface Props {
  value: boolean
  eventList: Record<string, any>[]
  hook?: HookType
  showUpgradeModal?: boolean
  sampleDataV2?: any
  stickyScroll?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['close', 'update:value', 'cancel'])

enum HookTab {
  Configuration = 'configuration',
  Log = 'log',
}

const { eventList, showUpgradeModal, sampleDataV2 } = toRefs(props)

const { t } = useI18n()

const { $e, $api } = useNuxtApp()

const { api, isLoading: loading } = useApi()

const modalVisible = useVModel(props, 'value')

const { hooks } = storeToRefs(useWebhooksStore())

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const { getMeta } = useMetas()

const { appInfo } = useGlobal()

const { activeTable } = toRefs(useTablesStore())

const { updateStatLimit, showWebhookLogsFeatureAccessModal } = useEeConfig()

const defaultHookName = t('labels.webhook')

const testSuccess = ref()

const testConnectionError = ref('')

const useForm = Form.useForm

const triggerByFieldColumns = computed(() => {
  if (!meta.value?.columns) {
    return []
  }
  return meta.value.columns.filter((col) => {
    return [UITypes.ID].includes(col.uidt as UITypes) || isLinksOrLTAR(col) || (!isSystemColumn(col) && !isVirtualCol(col))
  })
})

const eventsLabelMap = computed(() => {
  const result: any = {}
  for (const event of eventList.value) {
    if (!result[event.value[0]]) {
      result[event.value[0]] = {}
    }
    result[event.value[0]][event.value[1]] = event
  }
  return result
})
const eventsEnum = computed(() => {
  const result: { text: string; value: string }[] = []
  for (const event of eventList.value) {
    if (!result.some((k) => k.value === event.value[0])) {
      result.push({
        text: event.text[0],
        value: event.value[0],
      })
    }
  }
  return result
})

let hookRef = reactive<
  Omit<HookType, 'notification'> & {
    notification: Record<string, any> & {
      include_user: boolean
    }
    eventOperation?: string
    condition: boolean
  }
>({
  id: '',
  title: defaultHookName,
  event: undefined,
  operation: ['insert', 'update', 'delete'],
  eventOperation: undefined,
  notification: {
    type: 'URL',
    include_user: false,
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
  trigger_field: false,
  trigger_fields: [],
  active: true,
  version: 'v3',
})

const operationsEnum = computed(() => {
  if (!hookRef.event) {
    return [] as {
      text: string
      value: string
    }[]
  }
  const result: { text: string; value: string }[] = eventList.value
    .filter((event) => event.value[0] === hookRef.event)
    .map((event) => {
      return {
        text: event.text[1],
        value: event.value[1],
      }
    })
  return result
})

const isBodyShown = ref(hookRef.version === 'v1' || isEeUI)

const urlTabKey = ref<'params' | 'headers' | 'body'>('params')

const apps: Record<string, any> = ref()

const slackChannels = ref<Record<string, any>[]>([])

const teamsChannels = ref<Record<string, any>[]>([])

const discordChannels = ref<Record<string, any>[]>([])

const mattermostChannels = ref<Record<string, any>[]>([])
const sendMeEverythingChecked = ref(true)

const filterRef = ref()

const isDropdownOpen = ref()

const titleDomRef = ref<HTMLInputElement | undefined>()

const toggleOperation = (operation: string) => {
  const ops = [...hookRef.operation]
  const index = ops?.indexOf(operation) ?? -1

  if (index >= 0) {
    ops?.splice(index, 1)
  } else {
    ops?.push(operation)
  }
  if (!ops.includes('update')) {
    hookRef.trigger_field = false
    hookRef.trigger_fields = []
  }
  hookRef.operation = ops // this will trigger hookRef.operation watch
  // event other than 'after' has no 'send me everything'
  sendMeEverythingChecked.value = hookRef.event === 'after' && ops?.length === operationsEnum.value?.length
}

const toggleSendMeEverythingChecked = (_evt: Event) => {
  sendMeEverythingChecked.value = !sendMeEverythingChecked.value
  hookRef.operation = sendMeEverythingChecked.value ? [...operationsEnum.value.map((k) => k.value)] : []
  if (!sendMeEverythingChecked.value) {
    hookRef.trigger_field = false
    hookRef.trigger_fields = []
  }
}
const handleEventChange = (e: string) => {
  sendMeEverythingChecked.value = false
  hookRef.operation = []
  hookRef.event = e as any
  if (e !== 'after') {
    hookRef.operation = ['trigger']
    hookRef.trigger_field = false
    hookRef.trigger_fields = []
  }

  // Automatically set active to true when event type is manual
  if (hookRef.event === 'manual') {
    hookRef.active = true
  }
}

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

const _notificationList = computed(() => {
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

const showCyclicCallsWarning = ref(false)

const validators = computed(() => {
  return {
    'title': [fieldRequiredValidator()],
    'notification.type': [fieldRequiredValidator()],
    ...(hookRef.notification.type === 'URL' && {
      'notification.payload.method': [fieldRequiredValidator()],
      'notification.payload.path': [
        fieldRequiredValidator(),
        {
          validator: (_: any, path: string) => {
            return new Promise<void>((resolve, reject) => {
              showCyclicCallsWarning.value = false
              const siteUrl = appInfo.value?.ncSiteUrl

              if (!path || !siteUrl) {
                resolve()
                return
              }

              let matched = false
              try {
                const webhookUrl = new URL(hookRef.notification.payload.path)
                const siteUrlObj = new URL(siteUrl)

                // Check if the hostname matches exactly
                matched = webhookUrl.hostname === siteUrlObj.hostname
              } catch (e) {
                // If URL parsing fails, fall back to simple includes check
                matched = path.includes(siteUrl)
              }

              if (matched) {
                if (appInfo.value?.isCloud) {
                  reject(new Error(t('msg.internalUrlsNotAllowed')))
                } else {
                  showCyclicCallsWarning.value = true
                }
              }

              resolve()
            })
          },
        },
      ],
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
    } else if (typeof val === 'object' && Object.keys(val).length > 0) {
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
  const toAssign = { ...newHook }
  if (newHook.version === 'v2') {
    toAssign.version = 'v3'
    toAssign.operation =
      typeof newHook.operation === 'string'
        ? ([(newHook.operation as string).replace('bulk', '').toLowerCase()] as any[])
        : newHook.operation
  }
  const notification = newHook.notification as Record<string, any>
  Object.assign(hookRef, {
    ...toAssign,
    notification: {
      ...notification,
      include_user: notification?.include_user ?? false,
      payload: notification.payload,
    },
  })
  if (
    toAssign.event === 'after' &&
    toAssign.operation &&
    toAssign.operation.length === eventList.value.filter((k) => k.value[0] === 'after').length
  ) {
    sendMeEverythingChecked.value = true
  } else {
    sendMeEverythingChecked.value = false
  }

  hookRef.trigger_field = !!hookRef?.trigger_field

  loadSampleData()
}

function onEventChange() {
  const { notification: { payload = {}, type = {} } = {} } = hookRef

  Object.assign(hookRef, {
    ...hookRef,
    notification: {
      ...hookRef.notification,
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
  return hookRef.event && hookRef.event !== 'manual'
})

async function saveHooks() {
  loading.value = true
  try {
    await validate()
    if (hookRef.operation?.length === 0 && sendMeEverythingChecked.value === false) {
      message.error('At least one operation need to be selected')
      throw new Error('At least one operation need to be selected')
    }
  } catch (error: any) {
    console.error('validation error', error)

    loading.value = false

    return
  }

  let operations = [...(hookRef.operation ?? [])]
  if (sendMeEverythingChecked.value === true) {
    operations = eventList.value.filter((k) => k.value[0] === hookRef.event).map((k) => k.value[1])
  }

  try {
    let res
    if (hookRef.id) {
      res = await api.dbTableWebhook.update(hookRef.id, {
        ...hookRef,
        operation: operations,
        notification: {
          ...hookRef.notification,
          payload: hookRef.notification.payload,
        },
      })
    } else {
      res = await api.dbTableWebhook.create(meta.value!.id!, {
        ...hookRef,
        operation: operations,
        notification: {
          ...hookRef.notification,
          payload: hookRef.notification.payload,
        },
      } as HookReqType)

      hooks.value.push(res)
      updateStatLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE, 1)
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

    if (showUpgradeModal.value) {
      message.success('Webhook upgraded to v3 successfully!')
    }
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
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook',
  },
  {
    title: 'Create webhook',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook',
  },
  {
    title: 'Custom payload',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook#webhook-with-custom-payload-',
  },
  {
    title: 'Trigger on condition',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook#webhook-with-conditions',
  },
]

watch(
  () => hookRef?.operation,
  async () => {
    await loadSampleData()
  },
  { immediate: true },
)

async function loadSampleData() {
  const samplePayload = await $api.dbTableWebhook.samplePayloadGet(
    meta?.value?.id as string,
    ((hookRef?.operation && hookRef?.operation[0]) as any) || 'insert',
    hookRef.version!,
    {
      query: {
        includeUser: (!!hookRef.notification?.include_user).toString(),
      },
    },
  )
  // if non-URL based hook and version is v2, then return the newRowData as payload
  // this is for backward compatibility
  if (hookRef.notification.type !== 'URL' && ['v2', 'v3'].includes(hookRef.version)) {
    sampleData.value = {
      event: sampleData.value?.data?.rows,
    }
  } else {
    sampleData.value = samplePayload
  }
}

const getDefaultHookName = (hooks: HookType[]) => {
  return extractNextDefaultName([...hooks.map((el) => el?.title || '')], defaultHookName)
}

const _getNotificationIconName = (type: string): keyof typeof iconMap => {
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

const handleChangeTab = (tab: HookTab) => {
  if (tab === HookTab.Log && showWebhookLogsFeatureAccessModal()) return

  activeTab.value = tab
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
      hookRef.event = eventList.value?.[0]?.value[0]
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await loadPluginList()

  onNotificationTypeChange()

  if (!showUpgradeModal.value) {
    until(() => titleDomRef.value as HTMLInputElement)
      .toBeTruthy()
      .then(() => {
        titleDomRef.value?.focus()
        titleDomRef.value?.select()
      })
  }
})

const toggleIncludeUser = async () => {
  hookRef.notification.include_user = !hookRef.notification.include_user
  await loadSampleData()
}

const triggerSubType = computed(() => {
  if (sendMeEverythingChecked.value) {
    return t('labels.sendAllEvents')
  }

  if (!hookRef.operation?.length) {
    return 'Select operation'
  }

  const operations = hookRef.operation.map((o) => eventsLabelMap.value[hookRef.event]?.[o]?.text[1])

  if (operations.length === 1) {
    return `${hookRef.event === 'after' ? `${t('general.after')} ` : ''}${operations[0]}`
  }

  const lastOperation = operations.pop()
  return `${hookRef.event === 'after' ? `${t('general.after')} ` : ''}${operations.join(', ')} ${t(
    'general.or',
  ).toLowerCase()} ${lastOperation}`
})

const formatData = (data: any) => {
  try {
    return typeof data === 'object' ? JSON.stringify(data, null, 2) : JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}

const webhookV2AndV3Diff = computed(() => {
  return [
    {
      title: 'Webhook v2 response',
      response: formatData(sampleDataV2.value ?? ''),
    },
    {
      title: 'Webhook v3 response',
      response: formatData(sampleData.value),
    },
  ]
})
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-webhook-create-edit">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon class="text-gray-900 h-5 w-5" icon="ncWebhook" />
          <span class="text-gray-900 font-semibold text-xl">
            <template v-if="activeTab === HookTab.Configuration">
              {{ showUpgradeModal ? hookRef.title : !hook ? $t('activity.newWebhook') : 'Webhook Settings' }}
            </template>
            <template v-else>
              {{ $t('activity.webhookLogs') }}
            </template>
          </span>
        </div>

        <div
          v-if="hook && isEeUI && !showUpgradeModal"
          class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 nc-view-sidebar-tab"
        >
          <div
            v-e="['c:webhook:edit']"
            class="tab"
            :class="{
              active: activeTab === HookTab.Configuration,
            }"
            @click="handleChangeTab(HookTab.Configuration)"
          >
            <div class="tab-title nc-tab">{{ $t('general.details') }}</div>
          </div>
          <div
            v-e="['c:webhook:log']"
            class="tab"
            :class="{
              active: activeTab === HookTab.Log,
            }"
            @click="handleChangeTab(HookTab.Log)"
          >
            <div class="tab-title nc-tab">{{ $t('general.logs') }}</div>
          </div>
        </div>

        <div class="flex justify-end items-center gap-3 flex-1">
          <template v-if="activeTab === HookTab.Configuration">
            <NcTooltip v-if="!showUpgradeModal" :disabled="!testConnectionError">
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
            <NcButton v-else type="secondary" size="small" @click.stop="emits('cancel')">
              {{ $t('general.cancel') }}
            </NcButton>

            <NcButton :loading="loading" type="primary" size="small" data-testid="nc-save-webhook" @click.stop="saveHooks">
              {{
                showUpgradeModal
                  ? $t('general.upgrade')
                  : hook
                  ? $t('labels.multiField.saveChanges')
                  : $t('activity.createWebhook')
              }}
            </NcButton>
          </template>
          <NcButton type="text" size="small" data-testid="nc-close-webhook-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>
    <div v-if="activeTab === HookTab.Configuration" class="flex bg-white rounded-b-2xl h-[calc(100%_-_56px)]">
      <div v-if="showUpgradeModal" class="h-full w-full overflow-auto nc-scrollbar-thin">
        <div class="h-full w-full max-w-[1040] min-w-[640px] px-6 md:px-12 py-6 flex flex-col">
          <div class="flex flex-col gap-2 mb-8">
            <div class="text-base font-bold text-nc-content-gray-emphasis">Change in webhook response</div>
            <div class="text-sm font-normal text-nc-content-gray-subtle2">
              For more information on webhooks v3 visit
              <a
                href="https://nocodb.com/docs/product-docs/automation/webhook/webhook-v2-vs-v3#upgrade-to-webhook-v3"
                class="nc-link"
                target="_blank"
              >
                NocoDB Docs.
              </a>
            </div>
          </div>

          <div class="nc-webhook-version-diff">
            <div v-for="(item, idx) of webhookV2AndV3Diff" :key="idx" class="nc-item">
              <div class="nc-item-title">{{ item.title }}</div>
              <div class="nc-item-response">
                <LazyMonacoEditor
                  :model-value="item.response"
                  class="flex-1 min-h-50 resize-y overflow-auto expanded-editor"
                  hide-minimap
                  disable-deep-compare
                  read-only
                  :monaco-config="{
                    lineNumbers: 'on',
                    scrollbar: {
                      verticalScrollbarSize: 6,
                      horizontalScrollbarSize: 6,
                    },
                    padding: {
                      top: 12,
                      bottom: 12,
                    },
                    scrollBeyondLastLine: false,
                  }"
                  :monaco-custom-theme="{
                    base: 'vs',
                    inherit: true,
                    rules: [],
                    colors: {
                      'editor.background': '#f9f9fa',
                    },
                  }"
                  @keydown.enter.stop
                  @keydown.alt.stop
                />
              </div>
            </div>
          </div>
          <div>
            <!-- Just to maintain bottom padding -->
            &nbsp;
          </div>
        </div>
      </div>
      <template v-else>
        <div
          ref="containerElem"
          class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-6 md:px-12 py-6 mx-auto"
        >
          <div class="max-w-[640px] min-w-[564px] w-full mx-auto gap-8 flex flex-col">
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
              <div class="flex flex-col">
                <div class="text-nc-content-gray text-base font-bold leading-6">
                  {{ $t('general.trigger') }}
                </div>
                <div
                  class="mt-3 p-4 border-1 border-nc-border-gray-medium"
                  :class="{
                    'border-b-0 rounded-t-2xl': isConditionSupport,
                    'rounded-2xl': !isConditionSupport,
                  }"
                >
                  <div class="w-full flex gap-3">
                    <a-form-item class="w-full !my-0">
                      <NcSelect
                        v-model:value="hookRef.event"
                        class="w-full webhook-event-select nc-select-shadow"
                        data-testid="nc-dropdown-hook-event"
                        dropdown-class-name="nc-modal-hook-event"
                        @change="handleEventChange"
                      >
                        <a-select-option v-for="event of eventsEnum" :key="event.value"> {{ event.text }}</a-select-option>
                      </NcSelect>
                    </a-form-item>
                    <NcDropdown v-if="hookRef.event === 'after'" v-model:visible="isDropdownOpen">
                      <div
                        class="rounded-lg border-1 w-full transition-all cursor-pointer flex items-center border-nc-border-grey-medium h-8 py-1 gap-2 px-4 py-2 h-[36px] shadow-default"
                        data-testid="nc-dropdown-hook-operation"
                        :class="{
                          '!border-brand-500 !shadow-selected': isDropdownOpen,
                          '!hover:shadow-hover': !isDropdownOpen,
                        }"
                      >
                        <div class="text-nc-content-gray flex-1">
                          {{ triggerSubType }}
                        </div>

                        <GeneralIcon
                          :class="{
                            'transform rotate-180': isDropdownOpen,
                          }"
                          class="transition-all"
                          style="width: 12.5px; height: 12.5px; margin-right: -6px"
                          icon="ncChevronDown"
                        />
                      </div>

                      <template #overlay>
                        <NcMenu
                          class="webhook-trigger-selection"
                          variant="medium"
                          data-testid="nc-dropdown-hook-operation-modal"
                          data-testvalue="send_everything"
                        >
                          <template v-if="hookRef.event === 'after'">
                            <NcMenuItem
                              data-testid="nc-dropdown-hook-operation-option"
                              data-testvalue="sendMeEverything"
                              @click.stop="toggleSendMeEverythingChecked"
                            >
                              <div class="flex-1 w-full text-sm">
                                {{ $t('labels.sendAllEvents') }}
                              </div>
                              <NcCheckbox :checked="sendMeEverythingChecked" />
                            </NcMenuItem>

                            <NcDivider />
                          </template>

                          <NcMenuItem
                            v-for="operation of operationsEnum"
                            :key="operation.value"
                            data-testid="nc-dropdown-hook-operation-option"
                            :data-testvalue="operation.value"
                            @click.prevent="toggleOperation(operation.value)"
                          >
                            <div class="flex-1 w-full text-sm">
                              <template v-if="hookRef.event === 'after'">
                                {{ $t('general.after') }}
                              </template>
                              {{ operation.text }}
                            </div>
                            <NcCheckbox :checked="hookRef.operation!.includes(operation.value as any)" />
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                    </NcDropdown>
                  </div>
                </div>
                <div v-if="isConditionSupport" class="border-1 border-nc-border-gray-medium rounded-b-2xl px-4 pt-4">
                  <div class="w-full flex items-center justify-between h-[28px]">
                    <label class="cursor-pointer flex items-center" @click.prevent="hookRef.condition = !hookRef.condition">
                      <NcSwitch :checked="Boolean(hookRef.condition)" class="nc-check-box-hook-condition">
                        <span class="!text-gray-700 font-semibold"> Trigger only when conditions match </span>
                      </NcSwitch>
                    </label>

                    <div v-if="hookRef.condition" class="flex gap-2">
                      <NcButton
                        size="xs"
                        type="secondary"
                        class="nc-btn-focus"
                        data-testid="add-filter"
                        @click.stop="filterRef.addFilter()"
                      >
                        <div class="flex items-center gap-1">
                          <component :is="iconMap.plus" />
                          <!-- Add Filter -->
                          {{ $t('activity.addFilter') }}
                        </div>
                      </NcButton>

                      <NcButton
                        class="nc-btn-focus"
                        type="secondary"
                        size="xs"
                        data-testid="add-filter-group"
                        @click.stop="filterRef.addFilterGroup()"
                      >
                        <div class="flex items-center gap-1">
                          <!-- Add Filter Group -->
                          <component :is="iconMap.plus" />
                          {{ $t('activity.addFilterGroup') }}
                        </div>
                      </NcButton>
                    </div>
                  </div>

                  <div
                    class="mb-4"
                    :class="{
                      'nc-filter-ref-wrapper': hookRef.condition,
                    }"
                  >
                    <LazySmartsheetToolbarColumnFilter
                      v-if="hookRef.condition"
                      ref="filterRef"
                      :hidden-add-new-filter="true"
                      class="w-full !py-0"
                      :auto-save="false"
                      :show-loading="false"
                      :hook-id="hookRef.id"
                      :web-hook="true"
                      action-btn-type="secondary"
                      @update:filters-length="hookRef.condition = $event > 0"
                    />
                  </div>

                  <div v-if="isEeUI && hookRef.event === 'after' && hookRef.operation?.includes('update')" class="mb-4">
                    <WebhookTriggerByField
                      v-model:trigger-fields="hookRef.trigger_fields"
                      v-model:trigger-field="hookRef.trigger_field"
                      :columns="triggerByFieldColumns"
                    />
                  </div>
                </div>

                <div class="text-nc-content-gray text-base mt-6 font-bold leading-6">
                  {{ $t('general.action') }}
                </div>

                <div class="mt-3 border-1 custom-select border-nc-border-gray-medium p-4 border-b-0 rounded-t-2xl">
                  <template v-if="hookRef.notification.type === 'URL'">
                    <div class="flex gap-3">
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
                        <div class="flex flex-col gap-2">
                          <a-input
                            v-model:value="hookRef.notification.payload.path"
                            size="medium"
                            placeholder="http://example.com"
                            class="nc-text-field-hook-url-path nc-input-shadow h-9 !rounded-lg"
                          />
                          <div v-if="showCyclicCallsWarning" class="text-xs text-warning pl-2">
                            {{ $t('msg.cyclicCallsWarning') }}
                          </div>
                        </div>
                      </a-form-item>
                    </div>
                  </template>
                </div>

                <div
                  v-if="hookRef.notification.type === 'URL'"
                  class="border-1 border-nc-border-gray-medium rounded-b-2xl pt-4 px-4 pb-2"
                >
                  <NcTabs v-model:active-key="urlTabKey">
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
                            stickyScroll: {
                              enabled: props.stickyScroll,
                            },
                          }"
                        />
                      </div>
                    </a-tab-pane>
                  </NcTabs>
                </div>
              </div>

              <div
                v-if="['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(hookRef.notification.type)"
                class="flex flex-col gap-4"
              >
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

              <div v-if="isEeUI">
                <div>
                  <div class="w-full cursor-pointer flex items-center" @click.prevent="toggleIncludeUser">
                    <NcSwitch :checked="Boolean(hookRef.notification.include_user)" class="nc-check-box-include-user">
                      <span class="!text-gray-700 font-semibold">{{ $t('labels.includeUser') }}</span>
                    </NcSwitch>
                    <NcTooltip class="flex">
                      <template #title>
                        {{ $t('tooltip.includeUserHint') }}
                      </template>
                      <GeneralIcon icon="info" class="text-gray-400 ml-1" />
                    </NcTooltip>
                  </div>
                </div>
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
                <NcDivider />
                <div class="flex items-center justify-between -ml-1.5 !mt-[32px]">
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
                    read-only
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
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'none',
                      lineNumbers: 'off',
                      glyphMargin: false,
                      folding: false,
                      bracketPairColorization: { enabled: false },
                      wordWrap: 'on',
                      scrollbar: {
                        horizontal: 'hidden',
                        verticalScrollbarSize: 6,
                      },
                      wrappingStrategy: 'advanced',
                      tabSize: 4,
                      readOnly: true,
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
      </template>
    </div>
    <div v-else-if="activeTab === HookTab.Log" class="h-[calc(100%_-_57px)]">
      <WebhookCallLog :hook="hook" />
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-webhook-create-edit {
  z-index: 1050;
  a:not(.nc-link) {
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

  .webhook-event-select div.ant-select-selector {
    height: 36px !important;
    .ant-select-selection-item {
      @apply font-500 text-nc-content-gray;
    }
  }

  .nc-webhook-version-diff {
    .monaco-editor {
      @apply !border-t-0 !rounded-none pr-3;
    }
    .overflow-guard {
      @apply !border-0 !rounded-none;
    }
    .monaco-editor,
    .monaco-diff-editor,
    .monaco-component {
      --vscode-editor-background: #f9f9fa;
      --vscode-editorGutter-background: #f9f9fa;
    }
  }
}
</style>

<style scoped lang="scss">
.webhook-trigger-selection {
  :deep(.nc-menu-item-inner) {
    @apply !w-full;
  }
}

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

.nc-filter-ref-wrapper {
  @apply mb-4;

  &:has(.nc-filter-top-wrapper) {
    @apply mb-1;
  }
}

.nc-webhook-version-diff {
  @apply flex-1 !w-full flex items-stretch space-x-6 children:w-[calc(50%_-_12px)];

  .nc-item {
    @apply bg-nc-bg-gray-extralight rounded-lg border-1 border-nc-border-gray-medium flex flex-col;

    .nc-item-title {
      @apply px-3 py-1.5 border-b-1 border-nc-border-gray-medium font-bold text-nc-content-gray-subtle2 text-small1;
    }

    .nc-item-response {
      @apply flex-1 flex overflow-hidden;
    }
  }
}
</style>
