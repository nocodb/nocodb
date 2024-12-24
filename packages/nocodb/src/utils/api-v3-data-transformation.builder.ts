export class DataTransformationBuilder {
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

  filterColumns(allowed: string[]): this {
    this.transformations.push((data) => {
      return Object.keys(data)
        .filter((key) => allowed.includes(key))
        .reduce((result, key) => {
          result[key] = data[key];
          return result;
        }, {});
    });
    return this;
  }

  customTransform(transformFn: (data: any) => any): this {
    this.transformations.push(transformFn);
    return this;
  }

  build(): (data: any) => any {
    return (data: any) => {
      return this.transformations.reduce((result, transform) => transform(result), data);
    };
  }
}
