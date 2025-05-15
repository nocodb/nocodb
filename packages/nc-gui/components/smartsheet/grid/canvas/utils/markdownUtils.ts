import type { UserType } from 'nocodb-sdk'

type MarkdownStyle = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'mention'

interface Token {
  styles: MarkdownStyle[]
  value: string
  url?: string
  mentionData?: {
    id: string
    email?: string
    displayName?: string
    isSameUser: boolean
  }
}

export interface Marker {
  open: string
  close?: string
  style?: MarkdownStyle
  // Optional handler to process complex markers (like links)
  handler?: (text: string, index: number, activeStyles: MarkdownStyle[]) => { tokens: Token[]; newIndex: number }
}

const markers: Marker[] = [
  { open: '**', close: '**', style: 'bold' },
  { open: '_', close: '_', style: 'italic' },
  { open: '<u>', close: '</u>', style: 'underline' },
  { open: '<s>', close: '</s>', style: 'strikethrough' },
  {
    open: '\\',
    handler: (text: string, index: number, activeStyles: MarkdownStyle[]) => {
      const nextChar = text[index] || ''

      return {
        tokens: [{ styles: activeStyles, value: nextChar }],
        newIndex: index + 1,
      }
    },
  },
  {
    open: '[',
    close: ']',
    handler: (text: string, index: number, activeStyles: MarkdownStyle[]) => {
      // Parse link text inside the square brackets
      const innerResult = parseTokens(text, index, activeStyles, ']')
      const linkTextTokens = innerResult.tokens
      index = innerResult.newIndex
      // Check for a URL immediately following, wrapped in parentheses
      if (index < text.length && text[index] === '(') {
        index++ // Skip '('
        let url = ''
        while (index < text.length && text[index] !== ')') {
          url += text[index]
          index++
        }
        if (index < text.length && text[index] === ')') {
          index++ // Skip ')'
        }

        // Merge the tokens from the link text into one string
        const mergedText = linkTextTokens.map((t) => t.value).join('')

        activeStyles.push('link')

        return { tokens: [{ styles: activeStyles, value: mergedText, url }], newIndex: index }
      } else {
        return {
          tokens: [{ styles: activeStyles, value: `[${linkTextTokens.map((t) => t.value).join('')}]` }],
          newIndex: index,
        }
      }
    },
  },
  {
    open: '@(',
    handler: (text: string, index: number, activeStyles: MarkdownStyle[]) => {
      let mentionContent = ''
      let endIndex = index

      // Find the closing parenthesis
      while (endIndex < text.length && text[endIndex] !== ')') {
        mentionContent += text[endIndex]
        endIndex++
      }

      if (endIndex < text.length && text[endIndex] === ')') {
        endIndex++ // Skip ')'
      }

      // Process the mention content (userId|email|displayName)
      const parts = mentionContent.split('|')
      const id = parts[0] || ''
      const email = parts[1] || ''
      const displayName = parts[2] || ''

      const newStyles: MarkdownStyle[] = [...activeStyles, 'mention']

      const displayValue = displayName && displayName.length > 0 ? displayName : email

      return {
        tokens: [
          {
            styles: newStyles,
            value: `${displayValue}`,
            mentionData: {
              id,
              email,
              displayName,
              isSameUser: false,
            },
          },
        ],
        newIndex: endIndex,
      }
    },
  },
]

function parseTokens(
  text: string,
  index: number = 0,
  activeStyles: MarkdownStyle[] = [],
  expectedClosing: string | null = null,
): { tokens: Token[]; newIndex: number } {
  const tokens: Token[] = []
  let currentText = ''

  const flushText = () => {
    if (currentText) {
      tokens.push({ styles: [...activeStyles], value: currentText })
      currentText = ''
    }
  }

  while (index < text.length) {
    if (expectedClosing && text.startsWith(expectedClosing, index)) {
      flushText()
      index += expectedClosing.length
      return { tokens, newIndex: index }
    }

    let foundMarker: Marker | null = null
    for (const marker of markers) {
      if (text.startsWith(marker.open, index) && marker.open !== expectedClosing) {
        foundMarker = marker
        break
      }
    }

    if (foundMarker) {
      flushText()
      index += foundMarker.open.length
      if (foundMarker.handler) {
        const result = foundMarker.handler(text, index, activeStyles)
        tokens.push(...result.tokens)
        index = result.newIndex
      } else {
        const innerResult = parseTokens(text, index, [...activeStyles, foundMarker.style!], foundMarker.close)
        tokens.push(...innerResult.tokens)
        index = innerResult.newIndex
      }
      continue
    }

    currentText += text[index]
    index++
  }

  flushText()
  return { tokens, newIndex: index }
}

export const tokenizeLine = (
  text: string,
  options?: {
    users?: Partial<UserType | User>[]
    currentUser?: Partial<UserType | User> | null
  },
): Token[] => {
  let tokens = parseTokens(text).tokens

  if (options?.users && options.users.length > 0) {
    tokens = updateMentionsWithUserData(tokens, options.users, options.currentUser)
  }

  return tokens
}

type BlockType = 'paragraph' | 'list-item' | 'numbered-list-item' | 'heading'

export interface Block {
  type: BlockType
  tokens: Token[]
  number?: number
  level?: number
}

interface BlockMarker {
  open: RegExp | string
  type: BlockType
}

const blockMarkers: BlockMarker[] = [
  { open: /^#+ /, type: 'heading' },
  { open: '- ', type: 'list-item' },
  { open: '* ', type: 'list-item' },
  { open: '+ ', type: 'list-item' },
  { open: /\d+\. /, type: 'numbered-list-item' },
]

export const parseMarkdown = (
  text: string,
  options?: {
    users?: Partial<UserType | User>[]
    currentUser?: Partial<UserType | User> | null
  },
): Block[] => {
  const lines = text.split('\n')
  const blocks: Block[] = []
  const { users = [], currentUser = null } = options || {}

  for (const line of lines) {
    if (!line.trim()) continue

    const customProps: Record<string, any> = {}
    let blockType: BlockType = 'paragraph'
    let content = line

    for (const marker of blockMarkers) {
      if (typeof marker.open === 'string') {
        if (content.startsWith(marker.open)) {
          blockType = marker.type
          content = content.slice(marker.open.length)
          break
        }
      } else {
        const match = content.match(marker.open)
        if (match) {
          blockType = marker.type
          content = content.slice(match[0].length)
          if (blockType === 'numbered-list-item') {
            customProps.number = Number(match[0].slice(0, -2))
          }
          if (blockType === 'heading') {
            customProps.level = match[0].length - 1
          }
          break
        }
      }
    }

    let tokens = tokenizeLine(content)
    if (users.length > 0) {
      tokens = updateMentionsWithUserData(tokens, users, currentUser)
    }

    blocks.push({ type: blockType, tokens, ...customProps })
  }

  return blocks
}

export const getFontForToken = (
  token: Token,
  blockType: BlockType,
  props: {
    baseFontSize: number
    fontFamily: string
  },
): string => {
  const { baseFontSize, fontFamily } = props

  const fontParts: string[] = []
  const fontSize = baseFontSize

  if (token.styles.includes('italic')) {
    fontParts.push('italic')
  }

  if (token.styles.includes('bold') || blockType === 'heading') {
    fontParts.push('bold')
  }

  fontParts.push(`${fontSize}px`)
  fontParts.push(fontFamily)
  return fontParts.join(' ')
}

function updateMentionsWithUserData(
  tokens: Token[],
  users: Partial<UserType | User>[],
  currentUser?: Partial<UserType | User> | null,
): Token[] {
  return tokens.map((token) => {
    if (token.mentionData && token.styles.includes('mention')) {
      const id = token.mentionData.id
      const foundUser = users.find((user) => user?.id && user.id === id)

      if (foundUser) {
        return {
          ...token,
          value: `${foundUser.display_name || foundUser.email || id}`,
          mentionData: {
            ...token.mentionData,
            email: foundUser.email,
            displayName: foundUser.display_name,
            isSameUser: currentUser?.id === id,
          },
        }
      }
    }
    return token as Token
  }) as Token[]
}
