import { message } from 'ant-design-vue'
import { NcAlert } from '#components'

export interface MessageObjectProps {
  message?: string
  description?: string
  showIcon?: boolean
  closable?: boolean
  align?: 'top' | 'center'
  copyText?: any
  class?: string
  messageClass?: string
  descriptionClass?: string
}

export type MessageProps = MessageObjectProps | string

const initialValue = {
  showIcon: true,
  closable: false,
  align: 'top',
  class: '',
  messageClass: '',
  descriptionClass: '',
} as MessageObjectProps

const generateMessageKey = () => `ncMessage_${Date.now()}_${Math.random()}`

export const useMessage = () => {
  const getMessageProps = (params: MessageProps) => {
    if (ncIsString(params)) {
      return { ...initialValue, message: params }
    }

    return params || initialValue
  }

  const ncMessage = {
    success: (params: MessageProps = initialValue, duration?: number) => {
      const props = getMessageProps(params)
      const key = generateMessageKey() // Unique key for each message

      message.open({
        key,
        content: () =>
          h(NcAlert, {
            message: props.message,
            description: props.message,
            copyText: props.message,
            class: '',
            isNotification: true,
            closable: true,
            onClose: () => message.destroy(key), // Close specific message
          }),
        duration,
      })
    },
    error: (params: MessageProps = initialValue, duration?: number) => {
      const props = getMessageProps(params)

      message.error({ content: props.message, duration })
    },
    info: (params: MessageProps = initialValue, duration?: number) => {
      const props = getMessageProps(params)

      message.info({ content: props.message, duration })
    },
    warn: (params: MessageProps = initialValue, duration?: number) => {
      const props = getMessageProps(params)

      message.warn({ content: props.message, duration })
    },
  }
  return { ncMessage }
}
