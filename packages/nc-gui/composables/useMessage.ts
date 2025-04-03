import { message } from 'ant-design-vue'

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

      message.success({ content: props.message, duration })
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
