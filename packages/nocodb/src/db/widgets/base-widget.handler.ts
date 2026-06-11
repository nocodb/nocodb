export interface WidgetDependency {
  id: string;
  path?: string;
  widgetType?: string;
  widgetSubtype?: string;
}

export interface WidgetDependencies {
  columns: WidgetDependency[];
  models: WidgetDependency[];
  views: WidgetDependency[];
}

export class BaseWidgetHandler {
  async validateWidgetData(..._args: Array<unknown>) {
    return [];
  }

  async getWidgetData(_params: unknown) {
    return {};
  }

  async formatValue(..._params: Array<unknown>) {
    return {};
  }
  async serializeOrDeserializeWidget(..._params: Array<unknown>) {
    return {};
  }

  public extractDependencies(_widget: any): WidgetDependencies {
    return {
      columns: [],
      models: [],
      views: [],
    };
  }
}
