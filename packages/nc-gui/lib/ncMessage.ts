import { message } from 'ant-design-vue'
import type { AlertProps } from 'ant-design-vue/es'
import NcAlert, { type NcAlertProps } from '../components/nc/Alert.vue'

/**
 * `NcMessageObjectProps` defines the properties allowed in `ncMessage`,
 * extending `NcAlertProps` while omitting fields that are irrelevant for messages.
 */
export interface NcMessageObjectProps extends Omit<NcAlertProps, 'visible' | 'bordered' | 'isNotification' | 'duration'> {}

/**
 * `NcMessageProps` can either be a string (message text) or an object of type `NcMessageObjectProps`.
 */
export type NcMessageProps = NcMessageObjectProps | string

/**
 * Default values for `NcMessageObjectProps`.
 */
const initialValue = {
  showIcon: true,
  closable: true,
  align: 'top',
  class: '',
  messageClass: '',
  descriptionClass: '',
  showDuration: true,
} as NcMessageObjectProps

/**
 * Generates a unique key for each message instance.
 * @returns A unique string key for the message.
 */
const generateMessageKey = () => `ncMessage_${Date.now()}_${Math.random()}`

/**
 * Processes `NcMessageProps` and merges them with default values.
 * If a string is provided, it sets it as the message text.
 *
 * @param params - The message parameters, either a string or an object.
 * @returns A full `NcMessageObjectProps` object with defaults applied.
 */
const getMessageProps = (params: NcMessageProps) => {
  if (ncIsString(params)) {
    return { ...initialValue, message: params }
  }

  return { ...initialValue, ...params }
}

/**
 * Displays a message using Ant Design's `message.open`, rendering an `NcAlert` inside.
 *
 * @param type - The type of message (`success`, `error`, `info`, `warning`).
 * @param params - The message content or properties.
 * @param duration - Optional duration in seconds before auto-dismissal.
 */
const showMessage = (type: AlertProps['type'], params: NcMessageProps, duration?: number) => {
  const props = getMessageProps(params)
  const key = generateMessageKey()

  message.open({
    key,
    content: () =>
      h(NcAlert, {
        ...props,
        type,
        isNotification: true,
        onClose: () => message.destroy(key),
      }),
    duration,
  })
}

/**
 * `ncMessage` provides methods to display different types of messages.
 */
export const ncMessage = {
  success: (params: NcMessageProps = initialValue, duration?: number) => showMessage('success', params, duration),
  error: (params: NcMessageProps = initialValue, duration?: number) => showMessage('error', params, duration),
  info: (params: NcMessageProps = initialValue, duration?: number) => showMessage('info', params, duration),
  warn: (params: NcMessageProps = initialValue, duration?: number) => showMessage('warning', params, duration),
}
