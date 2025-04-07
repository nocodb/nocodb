import { message } from 'ant-design-vue/es'
import type { AlertProps, MessageArgsProps } from 'ant-design-vue/es'
import type { VueNode } from 'ant-design-vue/es/_util/type'
import type { VNode } from 'vue'
import { isPrimitiveValue } from 'nocodb-sdk'
import NcAlert, { type NcAlertProps } from '../components/nc/Alert.vue'
import { getI18n } from '~/plugins/a.i18n'

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
export interface NcMessageObjectProps extends NcAlertMessageProps, Omit<MessageArgsProps, 'type' | 'content'> {
  title?: string
  content?: string | (() => VueNode) | VueNode
  /**
   * Custom action slot content to be rendered inside the alert.
   * It can be either a `VueNode` or a function returning a `VueNode`.
   */
  action?: VNode | (() => VNode)
  showDefaultMessage?: boolean
  showCopyBtn?: boolean
  /**
   * For internal use only
   */
  renderAsNcAlert?: boolean
}

/**
 * `NcMessageProps` can either be a string (message text) or an object of type `NcMessageObjectProps`.
 */
export type NcMessageProps = NcMessageObjectProps | VueNode

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
  renderAsNcAlert: true,
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

function isNcMessageObjectProps(params: any): params is NcMessageObjectProps {
  return !ncIsEmptyObject(params)
}

/**
 * Processes `NcMessageProps` and merges them with default values.
 * - If a string is provided, it sets it as the description while applying a default content based on type.
 * - If neither `content` nor `description` exist, the content is set to the default localized text.
 * - Uses the spread operator to ensure proper merging of values.
 *
 * @param type - The type of message (`success`, `error`, `info`, `warning`).
 * @param params - The message parameters, either a string or an object.
 * @param ncMessageExtraProps - The extra props
 * @returns A full `NcMessageObjectProps` object with defaults applied.
 */
const getMessageProps = (
  type: AlertProps['type'],
  params: NcMessageProps,
  ncMessageExtraProps: NcMessageExtraProps = defaultNcMessageExtraProps,
): NcMessageObjectProps => {
  const updatedParams = { ...initialValue }
  let content = ''

  if (isPrimitiveValue(params)) {
    content = params?.toString() ?? ''
    // If params is a string, use it as the description and apply a default message based on type
    return {
      ...updatedParams,
      title: ncMessageExtraProps.showDefaultMessage || !content ? getI18n().global.t(`objects.ncMessage.${type}`) : '',
      content,
      copyText: ncMessageExtraProps.showCopyBtn ? content ?? '' : '',
    }
  } else if (!isNcMessageObjectProps(params)) {
    content = params
    return {
      ...updatedParams,
      title: ncMessageExtraProps.showDefaultMessage || !content ? getI18n().global.t(`objects.ncMessage.${type}`) : '',
      content,
      renderAsNcAlert: false,
    }
  } else {
    const showDefaultMessage = ncMessageExtraProps.showDefaultMessage ?? params.showDefaultMessage

    /**
     * default value of `ncMessageExtraProps.showCopyBtn` & `params.showCopyBtn` is true, so if one is false then we should not show
     */
    const showCopyBtn = ncMessageExtraProps.showCopyBtn && params.showCopyBtn

    let copyText = ''

    if (showCopyBtn) {
      if (params?.copyText) {
        copyText = params?.copyText
      } else if (isPrimitiveValue(params.content)) {
        copyText = params.content?.toString() ?? params.title ?? ''
      }
    }

    // If neither title nor content exist, set message to the default localized text
    const showDefaultTitle = !updatedParams.title && !updatedParams.content && showDefaultMessage

    // Merge provided object properties into the default values using the spread operator
    return {
      ...updatedParams,
      ...params,
      copyText,
      ...(showDefaultTitle ? { title: getI18n().global.t(`objects.ncMessage.${type}`) } : {}),
      renderAsNcAlert: isPrimitiveValue(params.content),
    }
  }
}

/**
 * Displays a message using Ant Design's `message.open`, rendering an `NcAlert` inside.
 * Note: we have to render our `NcAlert` only if content is primitive value
 * @param type - The type of message (`success`, `error`, `info`, `warning`).
 * @param params - The message content or properties.
 * @param duration - Optional duration in seconds before auto-dismissal.
 *
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
    renderAsNcAlert,
    showCopyBtn: _showCopyBtn,
    showDefaultMessage: _showDefaultMessage,
    ...ncAlertProps
  } = props

  // If title & content is blank then no need to show blank toast message
  if (!title && !content) return

  const key = generateMessageKey(params)

  return message.open({
    key,
    content: renderAsNcAlert
      ? () =>
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
                message.destroy(key)
              },
              duration: duration ?? ncAlertProps.duration,
            },
            {
              action: ncIsFunction(ncAlertProps.action) ? ncAlertProps.action : () => ncAlertProps.action,
              icon: ncIsFunction(ncAlertProps.icon) ? ncAlertProps.icon : () => ncAlertProps.icon,
            },
          )
      : content,
    type: !renderAsNcAlert ? type : undefined,
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
 * ### Display a default success message (title based on type)
 * ```ts
 * ncMessage.success();
 * ncMessage.error();
 * ncMessage.info();
 * ncMessage.warn();
 * ```
 *
 * ### Display a success message with a custom title only
 * ```ts
 * ncMessage.success({
 *   title: 'Table created successfully',
 * });
 * ```
 *
 * ### Display a success message with a custom description only
 * ```ts
 * ncMessage.success({
 *   content: 'Lorem ipsum dolor sit amet, consectetur adipiscing.',
 * });
 * ```
 *
 * ### Display a default title based on type with a custom description
 * ```ts
 * ncMessage.success('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, { showDefaultMessage: false });
 * ncMessage.error('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, { showDefaultMessage: false });
 * ncMessage.info('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, { showDefaultMessage: false });
 * ncMessage.warn('Lorem ipsum dolor sit amet, consectetur adipiscing', undefined, { showDefaultMessage: false });
 * ```
 *
 * ### Fully customized success message
 * ```ts
 * ncMessage.success({
 *   title: 'Table created successfully',
 *   content: 'Lorem ipsum dolor sit amet, consectetur adipiscing',
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

const ncMessage = {
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

  warning: (params: NcMessageProps = '', duration?: number, ncMessageExtraProps?: NcMessageExtraProps) => {
    return showMessage('warning', params, duration, ncMessageExtraProps)
  },
}

export { ncMessage }
