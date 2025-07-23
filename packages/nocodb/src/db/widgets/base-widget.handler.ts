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
}
