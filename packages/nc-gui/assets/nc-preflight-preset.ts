import type { Preset } from 'unocss'

// WindiCSS emitted a full Tailwind base reset; @unocss/nuxt's `preflight` option is off by
// default and presetWind3's own preflight only declares the --un-* variables. Without this,
// `border`/`border-1` set a width against the initial `border-style: none` and render nothing.
//
// Transcribed from `new Processor(windi.config).preflight(undefined, true, false, false)` at the
// commit before the migration, so the values match what shipped rather than @unocss/reset's
// defaults (border #E7E7E9 not #e5e7eb, placeholder #9AA2AF not #9ca3af, theme font stacks).
// The `* { --tw-ring-*/--tw-shadow }` block is deliberately dropped — presetWind3 declares the
// --un-* equivalents.
const BORDER = '#E7E7E9' // themeV3Colors.gray[200]
const PLACEHOLDER = '#9AA2AF' // themeV3Colors.gray[400]

export const ncPreflightPreset = (): Preset => ({
  name: 'nc-preflight',
  preflights: [
    {
      getCSS: ({ theme }) => {
        const { sans, mono } = (theme as { fontFamily?: Record<string, string> }).fontFamily ?? {}

        return `
*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: ${BORDER}; }
:root { -moz-tab-size: 4; -o-tab-size: 4; tab-size: 4; }
html { -webkit-text-size-adjust: 100%; font-family: ${sans}; line-height: 1.5; }
body { margin: 0; font-family: inherit; line-height: inherit; }
hr { height: 0; color: inherit; border-top-width: 1px; }
abbr[title] { -webkit-text-decoration: underline dotted; text-decoration: underline dotted; }
a { color: inherit; text-decoration: inherit; }
b, strong { font-weight: bolder; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre { margin: 0; }
code, kbd, samp, pre { font-family: ${mono}; font-size: 1em; }
small { font-size: 80%; }
sub, sup { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; }
sub { bottom: -0.25em; }
sup { top: -0.5em; }
table { text-indent: 0; border-color: inherit; border-collapse: collapse; }
button, input, optgroup, select, textarea { font-family: inherit; font-size: 100%; line-height: inherit; margin: 0; padding: 0; color: inherit; }
button, select { text-transform: none; }
button, [type='button'], [type='reset'], [type='submit'] { -webkit-appearance: button; }
button { background-color: transparent; background-image: none; }
button, [role='button'] { cursor: pointer; }
:-moz-focusring { outline: 1px dotted ButtonText; }
:-moz-ui-invalid { box-shadow: none; }
::-moz-focus-inner { border-style: none; padding: 0; }
::-webkit-inner-spin-button, ::-webkit-outer-spin-button { height: auto; }
[type='search'] { -webkit-appearance: textfield; outline-offset: -2px; }
::-webkit-search-decoration { -webkit-appearance: none; }
::-webkit-file-upload-button { -webkit-appearance: button; font: inherit; }
summary { display: list-item; }
fieldset { margin: 0; padding: 0; }
legend { padding: 0; }
ol, ul { list-style: none; margin: 0; padding: 0; }
progress { vertical-align: baseline; }
textarea { resize: vertical; }
img { border-style: solid; }
img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }
img, video { max-width: 100%; height: auto; }
input::placeholder, textarea::placeholder { opacity: 1; color: ${PLACEHOLDER}; }
`.trim()
      },
    },
  ],
})

export default ncPreflightPreset
