import { message } from 'ant-design-vue'
import type { AlertProps, MessageArgsProps } from 'ant-design-vue/es'
import NcAlert, { type NcAlertProps } from '../components/nc/Alert.vue'
import { getI18n } from '~/plugins/a.i18n'
import type { VNode } from 'vue'

/**
 * `NcMessageObjectProps` defines the properties allowed in `ncMessage`,
 * extending `NcAlertProps` while omitting fields that are irrelevant for messages.
 */
export interface NcMessageObjectProps
  extends Omit<NcAlertProps, 'visible' | 'bordered' | 'isNotification' | 'duration' | 'type' | 'message'>,
    Omit<MessageArgsProps, 'type'> {
  /**
   * Custom action slot content to be rendered inside the alert.
   * It can be either a `VNode` or a function returning a `VNode`.
   */
  action?: VNode | (() => VNode)
}

/**
 * `NcMessageProps` can either be a string (message text) or an object of type `NcMessageObjectProps`.
 */
export type NcMessageProps = NcMessageObjectProps | string

/**
 * Default values for `NcMessageObjectProps`.
 */
const initialValue = {
  content: '',
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
const generateMessageKey = (params: NcMessageProps) => {
  if (ncIsString(params) || !params.key) {
    return `ncMessage_${Date.now()}_${Math.random()}`
  }

  return params.key
}

/**
 * Processes `NcMessageProps` and merges them with default values.
 * - If a string is provided, it sets it as the description while applying a default content based on type.
 * - If neither `content` nor `description` exist, the content is set to the default localized text.
 * - Uses the spread operator to ensure proper merging of values.
 *
 * @param type - The type of message (`success`, `error`, `info`, `warning`).
 * @param params - The message parameters, either a string or an object.
 * @returns A full `NcMessageObjectProps` object with defaults applied.
 */
const getMessageProps = (
  type: AlertProps['type'],
  params: NcMessageProps,
  showDefaultMessage?: boolean,
): NcMessageObjectProps => {
  let updatedParams = initialValue

  if (ncIsString(params)) {
    // If params is a string, use it as the description and apply a default message based on type
    return {
      ...updatedParams,
      content: showDefaultMessage || !params ? getI18n().global.t(`objects.ncMessage.${type}`) : '',
      description: params,
    }
  }

  // Merge provided object properties into the default values using the spread operator
  updatedParams = { ...updatedParams, ...params }

  // If neither message nor description exist, set message to the default localized text
  if (!updatedParams.content && !updatedParams.description) {
    return { ...updatedParams, content: showDefaultMessage || !params ? getI18n().global.t(`objects.ncMessage.${type}`) : '' }
  }

  return updatedParams
}

/**
 * Displays a message using Ant Design's `message.open`, rendering an `NcAlert` inside.
 *
 * @param type - The type of message (`success`, `error`, `info`, `warning`).
 * @param params - The message content or properties.
 * @param duration - Optional duration in seconds before auto-dismissal.
 */

const showMessage = (type: AlertProps['type'], params: NcMessageProps, duration?: number, showDefaultMessage?: boolean) => {
  const props = getMessageProps(type, params, showDefaultMessage)
  const {
    onClick,
    onClose,
    content,
    getPopupContainer,
    style,
    appContext,
    prefixCls = '',
    rootPrefixCls = '',
    ...ncAlertProps
  } = props
  const key = generateMessageKey(params)

  return message.open({
    key,
    content: () =>
      h(
        NcAlert,
        {
          ...ncAlertProps,
          message: content,
          type,
          isNotification: true,
          onClose: () => {
            onClose?.()
            message.destroy(key)
          },
          duration: duration ?? ncAlertProps.duration,
        },
        {
          action: ncIsFunction(ncAlertProps.action) ? ncAlertProps.action : () => ncAlertProps.action,
          icon: ncIsFunction(ncAlertProps.icon) ? ncAlertProps.icon : () => ncAlertProps.icon,
        },
      ),
    duration: duration ?? ncAlertProps.duration,
    prefixCls,
    rootPrefixCls,
    getPopupContainer,
    onClose() {
      onClose?.()
    },
    style,
    appContext,
    onClick(event) {
      onClick?.(event)
    },
  })
}

/**
 * `ncMessage` provides methods to display different types of messages.
 *
 * ## Usage Examples:
 *
 * ### Display a default success message (title/message based on type)
 * ```ts
 * ncMessage.success();
 * ncMessage.error();
 * ncMessage.info();
 * ncMessage.warn();
 * ```
 *
 * ### Display a success message with a custom title/message only
 * ```ts
 * ncMessage.success({
 *   message: 'Table created successfully',
 * });
 * ```
 *
 * ### Display a success message with a custom description only
 * ```ts
 * ncMessage.success({
 *   description: 'Lorem ipsum dolor sit amet, consectetur adipiscing.',
 * });
 * ```
 *
 * ### Display a default title/message based on type with a custom description
 * ```ts
 * ncMessage.success('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, true);
 * ncMessage.error('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, true);
 * ncMessage.info('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, true);
 * ncMessage.warn('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, true);
 * ```
 *
 * ### Fully customized success message
 * ```ts
 * ncMessage.success({
 *   content: 'Table created successfully',
 *   description: 'Lorem ipsum dolor sit amet, consectetur adipiscing',
 *   copyText: 'Lorem ipsum dolor sit amet, consectetur adipiscing',
 *   showIcon: true,
 *   closable: true,
 *   showDuration: false,
 *   align: 'center',
 *   action: h(
 *     resolveComponent('NcButton'),
 *     {
 *       onClick: () => {
 *         console.log('clicked')
 *       },
 *       size: 'small',
 *       type: 'secondary',
 *     },
 *     () => 'Okay',
 *   ),
 *   icon: () => h(resolveComponent('GeneralIcon'), { icon: 'settings', class: 'text-2xl text-red-500' }),
 * });
 * ```
 */
export const ncMessage = {
  success: (params: NcMessageProps = '', duration?: number, showDefaultMessage: boolean = false) =>
    showMessage('success', params, duration, showDefaultMessage),
  error: (params: NcMessageProps = '', duration?: number, showDefaultMessage: boolean = false) =>
    showMessage('error', params, duration, showDefaultMessage),
  info: (params: NcMessageProps = '', duration?: number, showDefaultMessage: boolean = false) =>
    showMessage('info', params, duration, showDefaultMessage),
  warn: (params: NcMessageProps = '', duration?: number, showDefaultMessage: boolean = false) =>
    showMessage('warning', params, duration, showDefaultMessage),
}

/**
 * To overwrite default ant design message component
 */
export { ncMessage as message }
