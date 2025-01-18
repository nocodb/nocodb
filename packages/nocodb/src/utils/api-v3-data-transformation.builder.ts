import {
  checkboxIconList,
  durationOptions,
  ratingIconList,
  UITypes,
} from 'nocodb-sdk';
import type {
  ColumnType,
  FieldV3Type,
  FilterGroupV3Type,
  FilterType,
  FilterV3Type,
  SortType,
} from 'nocodb-sdk';
import type {
  CalendarViewColumn,
  Column,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  KanbanViewColumn,
} from '~/models';
import type { Sort } from '~/models';
import type { Filter } from '~/models';

// Utility type to map input type to corresponding output type
type MatchInputToOutput<TInput, TOutput> = TInput extends any[]
  ? TOutput[]
  : TOutput;

const convertToSnakeCase = (str: string) => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};
const convertToCamelCase = (str: string) => {
  return str.replace(/_([a-z])/g, (_, letter) => `${letter.toUpperCase()}`);
};

const columnsWithOptions = [
  UITypes.Lookup,
  UITypes.Links,
  UITypes.LinkToAnotherRecord,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Barcode,
  UITypes.Formula,
  UITypes.QrCode,
  UITypes.Button,
  UITypes.LongText,
];

export class ApiV3DataTransformationBuilder<
  Input = Record<string, unknown>,
  Output = Input,
> {
  private transformations: Array<(data: any) => any> = [];

  remapColumns<S = Input, T = Output>(mappings: Record<string, string>): this {
    this.transformations.push((data: S) => {
      return Object.entries(data).reduce<T>((result, [key, value]) => {
        const newKey = mappings[key] || key;
        result[newKey] = value;
        return result;
      }, {} as T);
    });
    return this;
  }

  filterColumns<S = Input, T = Output>(
    args: Partial<{ allowed: string[] } | { excluded: string[] }>,
  ): this {
    this.transformations.push((data: S) => {
      return Object.keys(data)
        .filter((key) => {
          if ('allowed' in args) return args.allowed.includes(key);
          if ('excluded' in args) return !args.excluded.includes(key);
        })
        .reduce<T>((result, key) => {
          result[key] = data[key];
          return result;
        }, {} as T);
    });
    return this;
  }

  metaTransform<S = Input, T = Output>({
    snakeCase = true,
    camelCase = false,
    mappings = {},
    metaProps = ['meta'],
    skipTransformFor,
    skipfn,
    ...rest
  }: {
    snakeCase?: boolean;
    camelCase?: boolean;
    mappings?: Record<string, string>;
    metaProps?: string[];
    skipTransformFor?: string[];
    skipfn?: (data: any) => boolean;
  } & Partial<{ allowed: string[] } | { excluded: string[] }> = {}): this {
    this.transformations.push((data: S) => {
      const result = { ...data };

      // iterate and update properties of metaProps only
      for (const prop of metaProps) {
        if (result[prop]) {
          if (typeof result[prop] === 'string') {
            try {
              result[prop] = JSON.parse(result[prop]);
            } catch {}
          } else {
            result[prop] = { ...result[prop] };
          }

          result[prop] = Object.entries(result[prop])
            .filter(([key]) => {
              if ('excluded' in rest) {
                return !rest.excluded.includes(key);
              }

              if ('allowed' in rest) {
                return rest.allowed.includes(key);
              }

              return true;
            })
            .reduce<T>((result, [key, value]) => {
              let newKey = mappings[key] || key;

              if (
                (skipTransformFor && skipTransformFor.includes(newKey)) ||
                (skipfn && skipfn(data))
              ) {
                result[newKey] = value;
                return result;
              }
              if (camelCase) {
                newKey = convertToCamelCase(newKey);
              } else if (snakeCase) {
                newKey = convertToSnakeCase(newKey);
              }

              result[newKey] = value;
              return result;
            }, {} as T);
        }
      }
      return result;
    });
    return this;
  }

  customTransform<S = Input, T = Output>(transformFn: (data: S) => T): this {
    this.transformations.push(transformFn);
    return this;
  }

  build(data: Input | Input[]): MatchInputToOutput<Input, Output> {
    if (Array.isArray(data)) {
      return data.map((item) =>
        this.transformations.reduce(
          (result, transform) => transform(result),
          item,
        ),
      ) as MatchInputToOutput<Input, Output>;
    }
    return this.transformations.reduce(
      (result, transform) => transform(result),
      data,
    ) as MatchInputToOutput<Input, Output>;
  }

  excludeNulls<S = Input, T = Output>() {
    this.transformations.push((data: S) => {
      return Object.entries(data).reduce<T>((result, [key, value]) => {
        if (value !== null) {
          result[key] = value;
        }
        return result;
      }, {} as T);
    });
    return this;
  }

  transformToBoolean<S = Input, T = Output>(booleanProps: string[]) {
    this.transformations.push((data: S) => {
      return Object.entries(data).reduce<T>((result, [key, value]) => {
        if (booleanProps.includes(key)) {
          result[key] = !!value;
        } else {
          result[key] = value;
        }
        return result;
      }, {} as T);
    });
    return this;
  }

  nestedExtract<S = Input, T = Output>(
    nestedExtract: Record<string, string[]>,
  ) {
    this.transformations.push((data: S): T => {
      const result = { ...data };
      Object.entries(nestedExtract).forEach(([key, path]) => {
        const value = path.reduce((acc, key) => acc?.[key], result);
        result[key] = value;
      });
      return result as unknown as T;
    });
  }

  orderProps<S = Input | Output, T = Output>(order: string[]) {
    // order props by order column and missing one keep at the end
    this.transformations.push((data: S) => {
      // Initialize the ordered object with properties based on the order array
      const ordered = order.reduce((acc, key) => {
        if (key in (data as object)) {
          acc[key] = data[key];
        }
        return acc;
      }, {} as T);

      // Add remaining properties from data that are not in the order array
      Object.keys(data).forEach((key) => {
        if (!order.includes(key)) {
          ordered[key as keyof T] = data[key];
        }
      });

      return ordered;
    });
    return this;
  }
}

// builder which does the reverse of the above

export const builderGenerator = <
  Input = Record<string, unknown>,
  Output = Input,
>({
  mappings,
  transformFn,
  meta,
  excludeNullProps = true,
  booleanProps,
  nestedExtract,
  ...rest
}: {
  mappings?: Record<string, string>;
  transformFn?: (data: any) => any;
  nestedExtract?: Record<string, string[]>;
  excludeNullProps?: boolean;
  booleanProps?: string[];
  orderProps?: string[];
  meta?: {
    snakeCase?: boolean;
    camelCase?: boolean;
    mappings?: Record<string, string>;
    metaProps?: string[];
    skipTransformFor?: string[];
    skipfn?: (data: any) => boolean;
  } & Partial<{ allowed: string[] } | { excluded: string[] }>;
} & Partial<
  { allowed: string[] } | { excluded: string[] }
>): (() => ApiV3DataTransformationBuilder<Input, Output>) => {
  return () => {
    const builder = new ApiV3DataTransformationBuilder<Input, Output>();
    if (nestedExtract) {
      builder.nestedExtract(nestedExtract);
    }

    if (excludeNullProps) {
      builder.excludeNulls();
    }

    if (booleanProps) {
      builder.transformToBoolean(booleanProps);
    }

    if ('allowed' in rest || 'excluded' in rest) {
      builder.filterColumns(rest);
    }

    if ('orderProps' in rest) {
      builder.orderProps(rest.orderProps);
    }
    if (meta) {
      builder.metaTransform(meta);
    }
    if (mappings) {
      builder.remapColumns(mappings);
    }
    if (transformFn) {
      builder.customTransform(transformFn);
    }
    return builder;
  };
};

export const colOptionBuilder = builderGenerator({
  allowed: [
    'formula_raw',
    'fk_qr_value_column_id',
    'fk_barcode_value_column_id',
    'fk_related_model_id',
    'type',
    'fk_relation_column_id',
    'fk_rollup_column_id',
    'fk_lookup_column_id',
    'rollup_function',
  ],
  mappings: {
    formula_raw: 'formula',
    fk_qr_value_column_id: 'qr_value_field_id',
    fk_barcode_value_column_id: 'barcode_value_field_id',

    type: 'relation_type',
    fk_related_model_id: 'linked_table_id',

    fk_relation_column_id: 'link_field_id',
    fk_rollup_column_id: 'linked_table_rollup_field_id',
    fk_lookup_column_id: 'linked_table_lookup_field_id',
    linked_table_rollup_field_id: 'fk_rollup_column_id',

    // todo: extract this
    // inverse_link_field_id: 'inverse_link_field_id',
  },
});

export const columnBuilder = builderGenerator<Column | ColumnType, FieldV3Type>(
  {
    allowed: [
      'id',
      'title',
      'uidt',
      'cdf',
      'description',
      'meta',
      'colOptions',
    ],
    mappings: {
      uidt: 'type',
      cdf: 'default_value',
      meta: 'options',
    },
    excludeNullProps: true,
    meta: {
      snakeCase: true,
      metaProps: ['meta'],
      mappings: {
        is12hrFormat: '12hr_format',
        isLocaleString: 'locale_string',
        richMode: 'rich_text',
        // duration: 'duration_format',
      },
      excluded: [
        'defaultViewColOrder',
        'defaultViewColVisibility',
        'singular',
        'plural',
      ],
      skipTransformFor: [
        'currency_locale',
        'currency_code',
        'icon',
        'iconIdx',
        'duration',
      ],
    },
    transformFn: (data) => {
      let options: Record<string, any> = data.options || {};
      if (data.colOptions) {
        switch (data.type) {
          case UITypes.SingleSelect:
          case UITypes.MultiSelect:
            {
              const choices = data.colOptions.options.map((opt) => {
                const res: Record<string, unknown> = {
                  title: opt.title,
                  color: opt.color,
                };
                if (opt.id) res.id = opt.id;
                return res;
              });
              options.choices = choices;
            }
            break;
          default:
            {
              console.log(data.colOptions);
              const additionalOptions =
                colOptionBuilder().build(data.colOptions) || {};
              Object.assign(options, additionalOptions);
            }
            break;
        }
      }

      if (data.type === UITypes.Checkbox) {
        const { icon, iconIdx, ...rest } = data.options as Record<string, any>;

        // extract option meta and include only label and color
        options = rest;

        if (iconIdx) {
          options.icon = checkboxIconList[iconIdx]?.label;
        } else if (icon) {
          options.icon = checkboxIconList.find(
            (ic) => ic.checked === icon?.['checked'],
          )?.label;
        }
      } else if (data.type === UITypes.Rating) {
        const { icon, iconIdx, ...rest } = data.options as Record<string, any>;

        // extract option meta and include only label and color
        options = rest;

        if (iconIdx !== undefined && iconIdx !== null) {
          options.icon = ratingIconList[iconIdx]?.label;
        } else if (icon) {
          options.icon = ratingIconList.find(
            (ic) => ic.full === icon?.['full'],
          )?.label;
        }
      } else if (data.type === UITypes.Duration) {
        const { duration, duration_format, ...rest } = data.options as Record<
          string,
          any
        >;
        const durationFormat = duration ?? duration_format;
        // extract option meta and include only label and color
        options = rest;

        if (durationFormat !== undefined && durationFormat !== null) {
          options.duration_format = durationOptions[durationFormat]?.title;
        }
      }

      options = options || data.options;

      // exclude rollup function if Links
      if (data.type === UITypes.Links && options && options.rollup_function) {
        options.rollup_function = undefined;
      }

      return {
        ...data,
        colOptions: undefined,
        options: options && Object.keys(options)?.length ? options : undefined,
      };
    },
  },
);

export const columnOptionsV3ToV2Builder = builderGenerator({
  allowed: [
    'formula',
    'qr_value_field_id',
    'barcode_value_field_id',
    'relation_type',
    'linked_table_id',
    'link_field_id',
    'linked_table_rollup_field_id',
    'linked_table_lookup_field_id',
    'rollup_function',
  ],
  mappings: {
    formula: 'formula_raw',
    qr_value_field_id: 'fk_qr_value_column_id',
    barcode_value_field_id: 'fk_barcode_value_column_id',

    relation_type: 'type',

    // parent id we need to extract from the url
    linked_table_id: 'childId',

    link_field_id: 'fk_relation_column_id',
    linked_table_rollup_field_id: 'fk_rollup_column_id',
    linked_table_lookup_field_id: 'fk_lookup_column_id',
  },
});

export const columnV3ToV2Builder = builderGenerator<FieldV3Type, ColumnType>({
  allowed: ['id', 'title', 'type', 'default_value', 'options', 'description'],
  mappings: {
    type: 'uidt',
    default_value: 'cdf',
    options: 'meta',
  },
  meta: {
    snakeCase: false,
    camelCase: true,
    metaProps: ['options', 'meta'],
    mappings: {
      '12hr_format': 'is12hrFormat',
      locale_string: 'isLocaleString',
      rich_text: 'richMode',
      // duration_format: 'duration',
    },
    skipfn: (data) => columnsWithOptions.includes(data.uidt || data.type),
    excluded: ['defaultViewColOrder', 'singular', 'plural'],
    skipTransformFor: [
      'currency_locale',
      'currency_code',
      'icon',
      'iconIdx',
      'duration_format',
    ],
  },
  transformFn: (data) => {
    const meta: Record<string, any> = data.meta || {};
    let colOptions: any;

    switch (data.uidt) {
      case UITypes.SingleSelect:
      case UITypes.MultiSelect:
        {
          const choices = data.meta.choices.map((opt) => {
            const res: Record<string, unknown> = {
              title: opt.title,
              color: opt.color,
            };
            if (opt.id) res.id = opt.id;
            return res;
          });
          colOptions = { options: choices };
        }
        break;

      default:
        // todo: handle LTAR/Lookup/Rollup
        break;
    }

    if (data.uidt === UITypes.Checkbox) {
      const { icon, ..._ } = data.meta as Record<string, any>;

      if (icon) {
        const iconIdx = checkboxIconList.findIndex((ic) => ic.label === icon);
        if (iconIdx !== -1) {
          const { label: _, ...rest } = checkboxIconList[iconIdx];
          meta.iconIdx = iconIdx;
          meta.icon = rest;
        }
      }
    } else if (data.uidt === UITypes.Rating) {
      const { icon, ..._ } = data.meta as Record<string, any>;

      if (icon) {
        const iconIdx = ratingIconList.findIndex((ic) => ic.label === icon);
        if (iconIdx !== -1) {
          const { label: _, ...rest } = ratingIconList[iconIdx];
          meta.iconIdx = iconIdx;
          meta.icon = rest;
        }
      }
    } else if (data.uidt === UITypes.Duration) {
      const { duration, duration_format, ..._ } = data.meta as Record<
        string,
        any
      >;
      const durationFormat = duration ?? duration_format;
      // extract option meta and include only label and color
      const durationIdx = durationOptions.findIndex(
        (d) => d.title === durationFormat,
      );
      if (durationIdx > -1) {
        meta.duration = durationIdx;
      }
    }
    // if multi select then accept array of default values
    else if (data.uidt === UITypes.MultiSelect) {
      data.cdf = Array.isArray(data.cdf) ? data.cdf.join(',') : data.cdf;
    }

    let additionalPayloadData = {};

    if (columnsWithOptions.includes(data.uidt) && data.meta) {
      additionalPayloadData =
        columnOptionsV3ToV2Builder().build(data.meta) || {};
    }

    return {
      ...data,
      colOptions,
      meta: meta || data.meta,
      ...additionalPayloadData,
    };
  },
});

export const sortBuilder = builderGenerator<Sort | SortType>({
  allowed: ['id', 'fk_column_id', 'direction'],
  mappings: {
    fk_column_id: 'field_id',
  },
});

export const filterBuilder = builderGenerator<FilterType | Filter>({
  allowed: [
    'id',
    'fk_column_id',
    'direction',
    'logical_op',
    'fk_parent_id',
    // 'fk_hook_id',
    // 'fk_view_id',
    'comparison_op',
    'comparison_sub_op',
    'value',
    'is_group',
    'fk_link_col_id',
    'fk_value_col_id',
  ],
  mappings: {
    fk_column_id: 'field_id',
    fk_parent_id: 'parent_id',
    // fk_hook_id: 'hook_id',
    // fk_link_col_id: 'link_field_id',
    fk_value_col_id: 'value_field_id',
    comparison_op: 'operator',
    comparison_sub_op: 'sub_operator',
    // fk_view_id: 'view_id',
  },
  excludeNullProps: true,
  booleanProps: ['is_group'],
});

export const filterRevBuilder = builderGenerator<
  FilterGroupV3Type | FilterV3Type,
  FilterType
>({
  allowed: [
    'id',
    'field_id',
    'parent_id',
    'direction',
    'logical_op',
    'operator',
    'sub_operator',
    'value',
    'is_group',
  ],
  mappings: {
    field_id: 'fk_column_id',
    parent_id: 'fk_parent_id',
    operator: 'comparison_op',
    sub_operator: 'comparison_sub_op',
  },
});

type ViewColumn =
  | GridViewColumn
  | GalleryViewColumn
  | KanbanViewColumn
  | FormViewColumn
  | CalendarViewColumn;

export const viewColumnBuilder = builderGenerator<
  ViewColumn[],
  Partial<ViewColumn>[]
>({
  allowed: [
    'fk_column_id',
    'width',
    'show',
    'formatting',
    'label',
    'help',
    'description',
    'required',
  ],
  mappings: {
    fk_column_id: 'field_id',
  },
  excludeNullProps: true,
  booleanProps: ['show', 'required'],
});
