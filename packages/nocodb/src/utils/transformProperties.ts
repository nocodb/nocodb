import { UITypes } from 'nocodb-sdk';

interface Field {
  id: string;
  name: string;
  type: string;
  meta: string | null;
  options: any;
}

const checkboxIconList = [
  {
    checked: 'mdi-check-bold',
    unchecked: 'mdi-crop-square',
    label: 'square',
  },
  {
    checked: 'mdi-check-circle-outline',
    unchecked: 'mdi-checkbox-blank-circle-outline',
    label: 'circle-check',
  },
  {
    checked: 'mdi-star',
    unchecked: 'mdi-star-outline',
    label: 'star',
  },
  {
    checked: 'mdi-heart',
    unchecked: 'mdi-heart-outline',
    label: 'heart',
  },
  {
    checked: 'mdi-moon-full',
    unchecked: 'mdi-moon-new',
    label: 'circle-filled',
  },
  {
    checked: 'mdi-thumb-up',
    unchecked: 'mdi-thumb-up-outline',
    label: 'thumbs-up',
  },
  {
    checked: 'mdi-flag',
    unchecked: 'mdi-flag-outline',
    label: 'flag',
  },
];

const ratingIconList = [
  {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
    label: 'star',
  },
  {
    full: 'mdi-heart',
    empty: 'mdi-heart-outline',
    label: 'heart',
  },
  {
    full: 'mdi-moon-full',
    empty: 'mdi-moon-new',
    label: 'circle-filled',
  },
  {
    full: 'mdi-thumb-up',
    empty: 'mdi-thumb-up-outline',
    label: 'thumbs-up',
  },
  {
    full: 'mdi-flag',
    empty: 'mdi-flag-outline',
    label: 'flag',
  },
];

const durationOptions = [
  {
    id: 0,
    title: 'h:mm',
    example: '(e.g. 1:23)',
    regex: /(\d+)(?::(\d+))?/,
  },
  {
    id: 1,
    title: 'h:mm:ss',
    example: '(e.g. 3:45, 1:23:40)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?/,
  },
  {
    id: 2,
    title: 'h:mm:ss.s',
    example: '(e.g. 3:34.6, 1:23:40.0)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 3,
    title: 'h:mm:ss.ss',
    example: '(e.g. 3.45.67, 1:23:40.00)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
  {
    id: 4,
    title: 'h:mm:ss.sss',
    example: '(e.g. 3.45.678, 1:23:40.000)',
    regex: /(\d+)?(?::(\d+))?(?::(\d+))?(?:.(\d{0,4})?)?/,
  },
];

export function transformFieldConfig(field: Field): Field {
  const newField = { ...field };
  let metaObj = {} as Record<string, any>;

  try {
    metaObj = field.meta ? JSON.parse(field.meta) : {};
  } catch (e) {
    metaObj = typeof field.meta === 'object' ? field.meta : {};
  }

  newField.options = newField.options || {};

  switch (field.type) {
    case UITypes.LongText:
      newField.options = {
        ...newField.options,
        rich_text: metaObj.richMode || false,
        generate_text_using_ai: metaObj.ai || false,
      };
      break;

    case UITypes.PhoneNumber:
    case UITypes.URL:
    case UITypes.Email:
      newField.options = {
        ...newField.options,
        validation: metaObj.validate || false,
      };
      break;

    case UITypes.Number:
      newField.options = {
        ...newField.options,
        thousands_separator: metaObj.isLocaleString || false,
      };
      break;

    case UITypes.Decimal:
    case UITypes.Rollup:
      newField.options = {
        ...newField.options,
        precision: metaObj.precision || 1,
        thousands_separator: metaObj.isLocaleString || false,
      };
      break;
    case UITypes.Currency:
      newField.options = {
        ...newField.options,
        locale: metaObj.currency_locale || 'en-US',
        code: metaObj.currency_code || 'USD',
      };
      break;

    case UITypes.Percent:
      newField.options = {
        ...newField.options,
        show_as_progress: metaObj.is_progress || false,
      };
      break;

    case UITypes.Duration:
      newField.options = {
        ...newField.options,
        duration_format: durationOptions[metaObj?.duration || 0]?.title,
      };
      break;

    case UITypes.DateTime:
      newField.options = {
        ...newField.options,
        date_format: metaObj.date_format || 'YYYY/MM/DD',
        time_format: metaObj.time_format || 'HH:mm:ss',
        ['12hr_format']: metaObj.is12hrFormat || false,
      };
      break;

    case UITypes.Date:
      newField.options = {
        ...newField.options,
        date_format: metaObj.date_format || 'YYYY/MM/DD',
      };
      break;

    case UITypes.Time:
      newField.options = {
        ...newField.options,
        time_format: metaObj.time_format || 'HH:mm:ss',
        ['12hr_format']: metaObj.is12hrFormat || false,
      };
      break;

    case UITypes.Checkbox:
      if (metaObj.icon) {
        newField.options = {
          ...newField.options,
          icon: checkboxIconList[metaObj?.iconIdx ?? 0].label,
          color: metaObj.color || '#232323',
        };
      }
      break;

    case UITypes.Rating:
      newField.options = {
        ...newField.options,
        icon: ratingIconList[metaObj?.iconIdx ?? 0].label,
        max_value: metaObj.max || 5,
        color: metaObj.color || '#232323',
      };
      break;

    case UITypes.Barcode:
      newField.options = {
        ...newField.options,
        barcode_format: metaObj.barcodeFormat || 'CODE128',
        barcode_value_field_id: field.options?.barcode_value_field_id,
      };
      break;

    case UITypes.User:
      newField.options = {
        ...newField.options,
        allow_multiple_users: metaObj.is_multi || false,
        notify_user_when_added: metaObj.notify || false,
      };
      break;

    case UITypes.Formula:
      if (metaObj.display_column_meta) {
        newField.options = {
          ...newField.options,
          result: metaObj.display_type
            ? transformFieldConfig({
                type: metaObj.display_type,
                meta: metaObj.display_column_meta.meta,
                options: {},
              } as Field)
            : null,
        };
      }
      break;
    case UITypes.Links:
    case UITypes.LinkToAnotherRecord:
      newField.options = {
        ...newField.options,
        singular: metaObj.singular,
        plural: metaObj.plural,
      };
  }

  delete newField.meta;

  return newField;
}
