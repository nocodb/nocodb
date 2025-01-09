const convertToSnakeCase = (str: string) => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

export class ApiV3DataTransformationBuilder {
  private transformations: Array<(data: any) => any> = [];

  remapColumns(mappings: Record<string, string>): this {
    this.transformations.push((data) => {
      return Object.entries(data).reduce((result, [key, value]) => {
        const newKey = mappings[key] || key;
        result[newKey] = value;
        return result;
      }, {});
    });
    return this;
  }

  filterColumns(args: { allowed: string[] } | { excluded: string[] }): this {
    this.transformations.push((data) => {
      return Object.keys(data)
        .filter((key) => {
          if ('allowed' in args) return args.allowed.includes(key);
          if ('excluded' in args) return !args.excluded.includes(key);
        })
        .reduce((result, key) => {
          result[key] = data[key];
          return result;
        }, {});
    });
    return this;
  }

  metaTransform({
    snakeCase = true,
    mapping = {},
    metaProps = ['meta'],
  }: {
    snakeCase?: boolean;
    mapping?: Record<string, string>;
    metaProps?: string[];
  } = {}): this {
    this.transformations.push((data) => {
      let result = { ...data };

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

          result[prop] = Object.entries(result[prop]).reduce(
            (result, [key, value]) => {
              const newKey = mapping[key] || key;
              result[snakeCase ? convertToSnakeCase(newKey) : newKey] = value;
              return result;
            },
            {},
          );
        }
      }
      return result;
    });
    return this;
  }

  customTransform(transformFn: (data: any) => any): this {
    this.transformations.push(transformFn);
    return this;
  }

  build(data: any | any[]) {
    if (Array.isArray(data)) {
      return data.map((item) =>
        this.transformations.reduce(
          (result, transform) => transform(result),
          item,
        ),
      );
    }
    return this.transformations.reduce(
      (result, transform) => transform(result),
      data,
    );
  }
}

// builder which does the reverse of the above

export const builderGenerator = ({
  mappings,
  transformFn,
  meta,
  ...rest
}: {
  mappings?: Record<string, string>;
  transformFn?: (data: any) => any;
  meta?: {
    snakeCase?: boolean;
    mapping?: Record<string, string>;
    metaProps?: string[];
  };
} & (
  | { allowed: string[] }
  | { excluded: string[] }
  | {}
)): (() => ApiV3DataTransformationBuilder) => {
  return () => {
    const builder = new ApiV3DataTransformationBuilder();
    if ('allowed' in rest || 'excluded' in rest) {
      builder.filterColumns(rest);
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
