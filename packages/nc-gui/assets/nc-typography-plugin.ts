import plugin from 'windicss/plugin'

const fontStyleMap: Record<string, [string, { lineHeight: string; letterSpacing?: string; fontWeight: number }]> = {
  heading1: ['64px', { lineHeight: '92px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  heading2: ['40px', { lineHeight: '64px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  heading3: ['24px', { lineHeight: '36px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  subHeading1: ['20px', { lineHeight: '32px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  subHeading2: ['16px', { lineHeight: '24px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  bodyLg: ['16px', { lineHeight: '28px', letterSpacing: '-0.02rem', fontWeight: 500 }],
  bodyLgBold: ['16px', { lineHeight: '28px', letterSpacing: '-0.02rem', fontWeight: 700 }],
  body: ['14px', { lineHeight: '24px', fontWeight: 500 }],
  bodyBold: ['14px', { lineHeight: '24px', fontWeight: 700 }],
  bodyDefaultSm: ['13px', { lineHeight: '18px', fontWeight: 500 }],
  bodyDefaultSmBold: ['13px', { lineHeight: '18px', fontWeight: 700 }],
  bodySm: ['12px', { lineHeight: '18px', fontWeight: 500 }],
  bodySmBold: ['12px', { lineHeight: '18px', fontWeight: 700 }],
  caption: ['14px', { lineHeight: '20px', fontWeight: 500 }],
  captionBold: ['14px', { lineHeight: '20px', fontWeight: 700 }],
  captionSm: ['12px', { lineHeight: '14px', fontWeight: 500 }],
  captionSmBold: ['12px', { lineHeight: '14px', fontWeight: 700 }],
  captionXs: ['10px', { lineHeight: '14px', fontWeight: 500 }],
  captionXsBold: ['10px', { lineHeight: '14px', fontWeight: 700 }],
  captionDropdownDefault: ['13px', { lineHeight: '20px', fontWeight: 650 }],
  sidebarDefault: ['14px', { lineHeight: '20px', fontWeight: 650 }],
  sidebarSelected: ['14px', { lineHeight: '20px', fontWeight: 650 }],
}

export default plugin(({ addUtilities }) => {
  const utils: Record<string, any> = {}

  Object.entries(fontStyleMap).forEach(([key, [fontSize, opts]]) => {
    utils[`.text-${key}`] = {
      'font-size': fontSize,
      'line-height': opts.lineHeight,
      ...(opts.letterSpacing ? { 'letter-spacing': opts.letterSpacing } : {}),
      'font-weight': `${opts.fontWeight}`,
    }
  })

  addUtilities(utils, {
    layer: 'components',
    variants: ['responsive'],
    completions: Object.keys(fontStyleMap).map((k) => `text-${k}`), // <-- this enables autocomplete in IDE
  })
})
