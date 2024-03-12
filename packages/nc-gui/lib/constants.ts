export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const EMPTY_TITLE_PLACEHOLDER_DOCS = 'Untitled'

export const MAX_WIDTH_FOR_MOBILE_MODE = 480

export const BASE_FALLBACK_URL = process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080'

export const GROUP_BY_VARS = {
  NULL: '__nc_null__',
  TRUE: '__nc_true__',
  FALSE: '__nc_false__',
  VAR_TITLES: {
    __nc_null__: 'Empty',
    __nc_true__: 'Checked',
    __nc_false__: 'Unchecked',
  } as Record<string, string>,
}

export const BASE_ICON_COLOR_HUE_DATA: Record<
  string,
  { tint: { h: number; s: number; v: number }; shade: { h: number; s: number; v: number }; pickerColor: string }
> = {
  // blue
  _199: {
    tint: { h: 199, s: 79, v: 100 },
    shade: { h: 255, s: 80, v: 40 },
    pickerColor: '#36BFFF',
  },
  // orange
  _24: {
    tint: { h: 24, s: 64, v: 98 },
    shade: { h: 24, s: 81, v: 59 },
    pickerColor: '#FA8231',
  },
  // yellow
  _41: {
    tint: { h: 41, s: 62, v: 99 },
    shade: { h: 41, s: 77, v: 40 },
    pickerColor: '#FCBE3A',
  },
  // green
  _141: {
    tint: { h: 141, s: 63, v: 87 },
    shade: { h: 141, s: 81, v: 34 },
    pickerColor: '#27D665',
  },
  // gray
  _217: {
    tint: { h: 217, s: 12, v: 69 },
    shade: { h: 217, s: 32, v: 32 },
    pickerColor: '#6A7184',
  },
  // red
  _4: {
    tint: { h: 4, s: 60, v: 100 },
    shade: { h: 4, s: 74, v: 49 },
    pickerColor: '#FF4A3F',
  },
  // pink
  _317: {
    tint: { h: 317, s: 62, v: 99 },
    shade: { h: 317, s: 77, v: 40 },
    pickerColor: '#FC3AC6',
  },
  // purple
  _271: {
    tint: { h: 271, s: 62, v: 84 },
    shade: { h: 271, s: 82, v: 32 },
    pickerColor: '#7D26CD',
  },
  // maroon
  _332: {
    tint: { h: 332, s: 58, v: 83 },
    shade: { h: 332, s: 93, v: 41 },
    pickerColor: '#B33771',
  },
}
