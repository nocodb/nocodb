import TextStyle from '@tiptap/extension-text-style'

// TipTap's TextStyle parses *any* styled span; the colour and highlight marks also render
// styled spans, so a nested one would yield a second, empty textStyle mark that replaces
// the outer font. Only spans that carry a font declaration count here.
export const EmailTextStyle = TextStyle.extend({
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el) => {
          const style = (el as HTMLElement).style
          return style.fontFamily || style.fontSize ? {} : false
        },
      },
    ]
  },
})
