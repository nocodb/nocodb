import type { AlertProps, MessageArgsProps } from 'ant-design-vue/es'
import NcAlert, { type NcAlertProps } from '../components/nc/Alert.vue'
import { getI18n } from '~/plugins/a.i18n'
import type { VNode } from 'vue'

interface NcAlertMessageProps
  extends Pick<
    NcAlertProps,
    | 'showIcon'
    | 'closable'
    | 'align'
    | 'copyText'
    | 'copyBtnTooltip'
    | 'messageClass'
    | 'descriptionClass'
    | 'duration'
    | 'showDuration'
  > {}

/**
 * `NcMessageObjectProps` defines the properties allowed in `ncMessage`,
 * extending `NcAlertProps` while omitting fields that are irrelevant for messages.
 */
export interface NcMessageObjectProps extends NcAlertMessageProps, Omit<MessageArgsProps, 'type'> {
  title?: string
  /**
   * Custom action slot content to be rendered inside the alert.
   * It can be either a `VNode` or a function returning a `VNode`.
   */
  action?: VNode | (() => VNode)
  showDefaultMessage?: boolean
  showCopyBtn?: boolean
}

/**
 * `NcMessageProps` can either be a string (message text) or an object of type `NcMessageObjectProps`.
 */
export type NcMessageProps = NcMessageObjectProps | string

export interface NcMessageExtraProps extends Pick<NcMessageObjectProps, 'showDefaultMessage' | 'showCopyBtn'> {}

const defaultNcMessageExtraProps = {
  showDefaultMessage: false,
  showCopyBtn: true,
}

/**
 * Default values for `NcMessageObjectProps`.
 */
const initialValue = {
  title: '',
  content: '',
  showIcon: true,
  closable: true,
  align: 'top',
  class: '',
  messageClass: '',
  descriptionClass: '',
  ...defaultNcMessageExtraProps,
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
  ncMessageExtraProps: NcMessageExtraProps = defaultNcMessageExtraProps,
): NcMessageObjectProps => {
  let updatedParams = initialValue

  if (ncIsString(params)) {
    // If params is a string, use it as the description and apply a default message based on type
    return {
      ...updatedParams,
      title: ncMessageExtraProps.showDefaultMessage || !params ? getI18n().global.t(`objects.ncMessage.${type}`) : '',
      content: params,
      copyText: ncMessageExtraProps.showCopyBtn ? params ?? '' : '',
    }
  }

  const showDefaultMessage = ncMessageExtraProps.showDefaultMessage ?? params.showDefaultMessage

  /**
   * default value of `ncMessageExtraProps.showCopyBtn` & `params.showCopyBtn` is true, so if one is false then we should not show
   */
  const showCopyBtn = ncMessageExtraProps.showCopyBtn && params.showCopyBtn

  // Merge provided object properties into the default values using the spread operator
  updatedParams = {
    ...updatedParams,
    ...params,
    copyText: showCopyBtn ? params?.copyText || params.content || params.title || '' : '',
  }

  // If neither title nor content exist, set message to the default localized text
  if (!updatedParams.title && !updatedParams.content) {
    return {
      ...updatedParams,
      title: showDefaultMessage || !updatedParams.title ? getI18n().global.t(`objects.ncMessage.${type}`) : '',
    }
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

const showMessage = (
  type: AlertProps['type'],
  params: NcMessageProps,
  duration?: number,
  ncMessageExtraProps?: NcMessageExtraProps,
) => {
  const props = getMessageProps(type, params, ncMessageExtraProps)
  const {
    onClick,
    onClose,
    content,
    title,
    getPopupContainer,
    style,
    appContext,
    prefixCls = '',
    rootPrefixCls = '',
    ...ncAlertProps
  } = props
  const key = generateMessageKey(params)

  return antMessage.open({
    key,
    content: () =>
      h(
        NcAlert,
        {
          ...ncAlertProps,
          message: title,
          description: content,
          type,
          isNotification: true,
          onClose: () => {
            onClose?.()
            antMessage.destroy(key)
          },
          duration: duration ?? ncAlertProps.duration ?? 100,
        },
        {
          action: ncIsFunction(ncAlertProps.action) ? ncAlertProps.action : () => ncAlertProps.action,
          icon: ncIsFunction(ncAlertProps.icon) ? ncAlertProps.icon : () => ncAlertProps.icon,
        },
      ),
    duration: duration ?? ncAlertProps.duration ?? 100,
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
  success: (params: NcMessageProps = '', duration?: number, ncMessageExtraProps?: NcMessageExtraProps) => {
    return showMessage('success', params, duration, ncMessageExtraProps)
  },

  error: (params: NcMessageProps = '', duration?: number, ncMessageExtraProps?: NcMessageExtraProps) => {
    return showMessage('error', params, duration, ncMessageExtraProps)
  },

  info: (params: NcMessageProps = '', duration?: number, ncMessageExtraProps?: NcMessageExtraProps) => {
    return showMessage('info', params, duration, ncMessageExtraProps)
  },

  warn: (params: NcMessageProps = '', duration?: number, ncMessageExtraProps?: NcMessageExtraProps) => {
    return showMessage('warning', params, duration, ncMessageExtraProps)
  },
}

/**
 * To overwrite default ant design message component
 */
export { ncMessage as message }
