import 'mocha';
import { expect } from 'chai';
import {
  mapConfigToSnakeCase,
  mapConfigToCamelCase,
} from '../../../../src/ee/services/v3/dashboards-v3.config-transform';

function dashboardV3ConfigTransformTests() {
  // ─── Bar Chart ───────────────────────────────────────────────

  describe('Bar Chart config', () => {
    const internal = {
      chartType: 'bar',
      dataSource: 'model',
      data: {
        xAxis: {
          column_id: 'fld_col1',
          sortBy: 'xAxis',
          orderBy: 'asc',
          includeEmptyRecords: true,
          includeOthers: false,
          categoryLimit: 10,
        },
        yAxis: {
          startAtZero: true,
          fields: [
            { column_id: 'fld_col2', aggregation: 'sum' },
            { column_id: 'fld_col3', aggregation: 'avg' },
          ],
          groupBy: 'fld_col4',
        },
      },
      appearance: {
        size: 'medium',
        showCountInLegend: true,
        showValueInChart: false,
        legendPosition: 'top',
        colorSchema: 'default',
      },
      permissions: { allowUserToPrint: true, allowUsersToViewRecords: true },
    };

    const api = {
      chart_type: 'bar',
      data_source: 'table',
      data: {
        x_axis: {
          field_id: 'fld_col1',
          sort_by: 'x_axis',
          order_by: 'asc',
          include_empty_records: true,
          include_others: false,
          category_limit: 10,
        },
        y_axis: {
          start_at_zero: true,
          fields: [
            { field_id: 'fld_col2', aggregation: 'sum' },
            { field_id: 'fld_col3', aggregation: 'avg' },
          ],
          group_by: 'fld_col4',
        },
      },
      appearance: {
        size: 'medium',
        show_count_in_legend: true,
        show_value_in_chart: false,
        legend_position: 'top',
        color_schema: 'default',
      },
      permissions: { allowUserToPrint: true, allowUsersToViewRecords: true },
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });

    it('roundtrip: API → internal → API', () => {
      const roundtrip = mapConfigToSnakeCase(
        mapConfigToCamelCase(structuredClone(api)),
      );
      expect(roundtrip).to.deep.equal(api);
    });
  });

  // ─── Bar Chart — sort_by: yAxis ─────────────────────────────

  describe('Bar Chart sort_by yAxis', () => {
    it('converts sortBy yAxis → y_axis', () => {
      const result = mapConfigToSnakeCase({
        data: {
          xAxis: { column_id: 'c1', sortBy: 'yAxis' },
        },
      });
      expect(result.data.x_axis.sort_by).to.equal('y_axis');
    });

    it('converts sort_by y_axis → yAxis', () => {
      const result = mapConfigToCamelCase({
        data: {
          x_axis: { field_id: 'c1', sort_by: 'y_axis' },
        },
      });
      expect(result.data.xAxis.sortBy).to.equal('yAxis');
    });

    it('passes through unknown sort_by value', () => {
      const result = mapConfigToSnakeCase({
        data: {
          xAxis: { column_id: 'c1', sortBy: 'custom' },
        },
      });
      expect(result.data.x_axis.sort_by).to.equal('custom');
    });
  });

  // ─── Line Chart ──────────────────────────────────────────────

  describe('Line Chart config', () => {
    const internal = {
      chartType: 'line',
      dataSource: 'model',
      data: {
        xAxis: {
          column_id: 'fld_x',
          sortBy: 'xAxis',
          orderBy: 'desc',
          includeEmptyRecords: false,
          includeOthers: true,
          categoryLimit: 20,
        },
        yAxis: {
          startAtZero: false,
          fields: [{ column_id: 'fld_y1', aggregation: 'count' }],
        },
      },
      appearance: {
        size: 'large',
        smoothLines: true,
        plotDataPoints: false,
        showCountInLegend: false,
        showValueInChart: true,
        legendPosition: 'bottom',
        colorSchema: 'custom',
      },
    };

    const api = {
      chart_type: 'line',
      data_source: 'table',
      data: {
        x_axis: {
          field_id: 'fld_x',
          sort_by: 'x_axis',
          order_by: 'desc',
          include_empty_records: false,
          include_others: true,
          category_limit: 20,
        },
        y_axis: {
          start_at_zero: false,
          fields: [{ field_id: 'fld_y1', aggregation: 'count' }],
        },
      },
      appearance: {
        size: 'large',
        smooth_lines: true,
        plot_data_points: false,
        show_count_in_legend: false,
        show_value_in_chart: true,
        legend_position: 'bottom',
        color_schema: 'custom',
      },
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });
  });

  // ─── Pie Chart ───────────────────────────────────────────────

  describe('Pie Chart config', () => {
    const internal = {
      chartType: 'pie',
      dataSource: 'model',
      data: {
        category: {
          column_id: 'fld_cat',
          orderBy: 'asc',
          categoryLimit: 5,
          includeEmptyRecords: true,
          includeOthers: false,
        },
        value: {
          type: 'summary',
          column_id: 'fld_val',
          aggregation: 'sum',
        },
      },
      appearance: {
        size: 'small',
        showCountInLegend: false,
        showPercentageOnChart: true,
        legendPosition: 'right',
        colorSchema: 'custom',
        customColorSchema: [{ color: '#ff0000', label: 'Red' }],
      },
    };

    const api = {
      chart_type: 'pie',
      data_source: 'table',
      data: {
        category: {
          field_id: 'fld_cat',
          order_by: 'asc',
          category_limit: 5,
          include_empty_records: true,
          include_others: false,
        },
        value: {
          type: 'summary',
          field_id: 'fld_val',
          aggregation: 'sum',
        },
      },
      appearance: {
        size: 'small',
        show_count_in_legend: false,
        show_percentage_on_chart: true,
        legend_position: 'right',
        color_schema: 'custom',
        custom_color_schema: [{ color: '#ff0000', label: 'Red' }],
      },
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });

    it('roundtrip: API → internal → API', () => {
      const roundtrip = mapConfigToSnakeCase(
        mapConfigToCamelCase(structuredClone(api)),
      );
      expect(roundtrip).to.deep.equal(api);
    });
  });

  // ─── Pie Chart — count value (no column_id) ─────────────────

  describe('Pie Chart count value (no column_id)', () => {
    it('handles value with type count (no column_id)', () => {
      const internal = {
        chartType: 'pie',
        data: {
          category: { column_id: 'fld_cat' },
          value: { type: 'count' },
        },
      };
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result.data.category.field_id).to.equal('fld_cat');
      expect(result.data.value).to.deep.equal({ type: 'count' });
    });
  });

  // ─── Donut Chart ─────────────────────────────────────────────

  describe('Donut Chart config', () => {
    const internal = {
      chartType: 'donut',
      dataSource: 'model',
      data: {
        category: {
          column_id: 'fld_donut_cat',
          orderBy: 'desc',
          categoryLimit: 8,
          includeEmptyRecords: false,
          includeOthers: true,
        },
        value: {
          type: 'summary',
          column_id: 'fld_donut_val',
          aggregation: 'avg',
        },
      },
      appearance: {
        size: 'large',
        showCountInLegend: true,
        showPercentageOnChart: false,
        legendPosition: 'left',
        colorSchema: 'default',
      },
    };

    const api = {
      chart_type: 'donut',
      data_source: 'table',
      data: {
        category: {
          field_id: 'fld_donut_cat',
          order_by: 'desc',
          category_limit: 8,
          include_empty_records: false,
          include_others: true,
        },
        value: {
          type: 'summary',
          field_id: 'fld_donut_val',
          aggregation: 'avg',
        },
      },
      appearance: {
        size: 'large',
        show_count_in_legend: true,
        show_percentage_on_chart: false,
        legend_position: 'left',
        color_schema: 'default',
      },
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });
  });

  // ─── Metric Widget ──────────────────────────────────────────

  describe('Metric Widget config', () => {
    const internal = {
      dataSource: 'model',
      metric: {
        type: 'summary',
        column_id: 'fld_metric_col',
        aggregation: 'sum',
      },
      appearance: {
        type: 'filled',
        theme: 'blue',
      },
    };

    const api = {
      data_source: 'table',
      metric: {
        type: 'summary',
        field_id: 'fld_metric_col',
        aggregation: 'sum',
      },
      appearance: {
        type: 'filled',
        theme: 'blue',
      },
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });
  });

  // ─── Metric Widget — count type (no column_id) ──────────────

  describe('Metric Widget count type (no column_id)', () => {
    it('handles metric with type count', () => {
      const internal = {
        dataSource: 'model',
        metric: { type: 'count', aggregation: 'count' },
      };
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result.metric).to.deep.equal({
        type: 'count',
        aggregation: 'count',
      });
      expect(result.data_source).to.equal('table');
    });
  });

  // ─── Text Widget (Text type) ─────────────────────────────────

  describe('Text Widget (text type) config', () => {
    const internal = {
      content: 'Hello World',
      type: 'text',
      formatting: {
        horizontalAlign: 'center',
        verticalAlign: 'flex-start',
        bold: true,
        italic: false,
        underline: false,
        strikethrough: false,
      },
      appearance: {
        font: {
          family: 'Inter',
          weight: 400,
          size: 16,
          lineHeight: 1.5,
        },
        color: '#333333',
      },
    };

    const api = {
      content: 'Hello World',
      type: 'text',
      appearance: {
        formatting: {
          horizontal_align: 'center',
          vertical_align: 'flex-start',
          bold: true,
          italic: false,
          underline: false,
          strikethrough: false,
        },
        font: {
          family: 'Inter',
          weight: 400,
          size: 16,
          line_height: 1.5,
        },
        color: '#333333',
      },
    };

    it('internal → API: formatting moves inside appearance', () => {
      // Note: mapConfigToSnakeCase only handles key renaming.
      // The text widget's formatting→appearance nesting is handled by widgetBuilder's
      // transformFn which runs BEFORE mapConfigToSnakeCase. So we test the key-level
      // transformation here with the already-nested structure.
      const alreadyNested = {
        content: 'Hello World',
        type: 'text',
        appearance: {
          formatting: {
            horizontalAlign: 'center',
            verticalAlign: 'flex-start',
            bold: true,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          font: {
            family: 'Inter',
            weight: 400,
            size: 16,
            lineHeight: 1.5,
          },
          color: '#333333',
        },
      };
      const result = mapConfigToSnakeCase(structuredClone(alreadyNested));
      expect(result).to.deep.equal(api);
    });

    it('API → internal: appearance.formatting keys converted to camelCase', () => {
      // mapConfigToCamelCase converts snake_case keys back but does NOT extract
      // formatting from appearance — that's done by widgetOptionsRequestBuilder.
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result.appearance.formatting.horizontalAlign).to.equal('center');
      expect(result.appearance.formatting.verticalAlign).to.equal('flex-start');
      expect(result.appearance.font.lineHeight).to.equal(1.5);
    });
  });

  // ─── Text Widget (Markdown type) ─────────────────────────────

  describe('Text Widget (markdown type) config', () => {
    it('formatting keys renamed in markdown text widget', () => {
      const alreadyNested = {
        content: '# Title',
        type: 'markdown',
        appearance: {
          formatting: {
            horizontalAlign: 'flex-end',
            verticalAlign: 'center',
          },
        },
      };
      const result = mapConfigToSnakeCase(structuredClone(alreadyNested));
      expect(result.appearance.formatting.horizontal_align).to.equal(
        'flex-end',
      );
      expect(result.appearance.formatting.vertical_align).to.equal('center');
    });
  });

  // ─── Iframe Widget ──────────────────────────────────────────

  describe('Iframe Widget config', () => {
    const internal = {
      url: 'https://example.com',
      allowFullscreen: true,
    };

    const api = {
      url: 'https://example.com',
      allow_fullscreen: true,
    };

    it('internal → API (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase(structuredClone(internal));
      expect(result).to.deep.equal(api);
    });

    it('API → internal (toCamelCase)', () => {
      const result = mapConfigToCamelCase(structuredClone(api));
      expect(result).to.deep.equal(internal);
    });

    it('roundtrip: internal → API → internal', () => {
      const roundtrip = mapConfigToCamelCase(
        mapConfigToSnakeCase(structuredClone(internal)),
      );
      expect(roundtrip).to.deep.equal(internal);
    });
  });

  // ─── dataSource value mapping ────────────────────────────────

  describe('dataSource value mapping', () => {
    it('model → table', () => {
      const result = mapConfigToSnakeCase({ dataSource: 'model' });
      expect(result.data_source).to.equal('table');
    });

    it('table → model', () => {
      const result = mapConfigToCamelCase({ data_source: 'table' });
      expect(result.dataSource).to.equal('model');
    });

    it('view passes through unchanged (toSnakeCase)', () => {
      const result = mapConfigToSnakeCase({ dataSource: 'view' });
      expect(result.data_source).to.equal('view');
    });

    it('view passes through unchanged (toCamelCase)', () => {
      const result = mapConfigToCamelCase({ data_source: 'view' });
      expect(result.dataSource).to.equal('view');
    });

    it('filter passes through unchanged', () => {
      const result = mapConfigToSnakeCase({ dataSource: 'filter' });
      expect(result.data_source).to.equal('filter');
    });
  });

  // ─── column_id ↔ field_id mapping ───────────────────────────

  describe('column_id ↔ field_id mapping', () => {
    it('x_axis column_id → field_id', () => {
      const result = mapConfigToSnakeCase({
        data: { xAxis: { column_id: 'col1' } },
      });
      expect(result.data.x_axis.field_id).to.equal('col1');
      expect(result.data.x_axis).to.not.have.property('column_id');
    });

    it('y_axis fields[] column_id → field_id', () => {
      const result = mapConfigToSnakeCase({
        data: {
          yAxis: {
            fields: [{ column_id: 'col2' }, { column_id: 'col3' }],
          },
        },
      });
      expect(result.data.y_axis.fields[0].field_id).to.equal('col2');
      expect(result.data.y_axis.fields[1].field_id).to.equal('col3');
      expect(result.data.y_axis.fields[0]).to.not.have.property('column_id');
    });

    it('category column_id → field_id (pie/donut)', () => {
      const result = mapConfigToSnakeCase({
        data: { category: { column_id: 'cat_col' } },
      });
      expect(result.data.category.field_id).to.equal('cat_col');
      expect(result.data.category).to.not.have.property('column_id');
    });

    it('value column_id → field_id (pie/donut summary)', () => {
      const result = mapConfigToSnakeCase({
        data: {
          value: { type: 'summary', column_id: 'val_col', aggregation: 'sum' },
        },
      });
      expect(result.data.value.field_id).to.equal('val_col');
      expect(result.data.value).to.not.have.property('column_id');
    });

    it('metric column_id → field_id (metric widget)', () => {
      const result = mapConfigToSnakeCase({
        metric: { type: 'summary', column_id: 'metric_col', aggregation: 'avg' },
      });
      expect(result.metric.field_id).to.equal('metric_col');
      expect(result.metric).to.not.have.property('column_id');
    });

    it('API field_id → column_id for x_axis', () => {
      const result = mapConfigToCamelCase({
        data: { x_axis: { field_id: 'f1' } },
      });
      expect(result.data.xAxis.column_id).to.equal('f1');
      expect(result.data.xAxis).to.not.have.property('field_id');
    });

    it('API field_id → column_id for y_axis fields[]', () => {
      const result = mapConfigToCamelCase({
        data: {
          y_axis: { fields: [{ field_id: 'f2' }] },
        },
      });
      expect(result.data.yAxis.fields[0].column_id).to.equal('f2');
    });

    it('API field_id → column_id for category', () => {
      const result = mapConfigToCamelCase({
        data: { category: { field_id: 'cat_f' } },
      });
      expect(result.data.category.column_id).to.equal('cat_f');
      expect(result.data.category).to.not.have.property('field_id');
    });

    it('API field_id → column_id for value (summary)', () => {
      const result = mapConfigToCamelCase({
        data: {
          value: { type: 'summary', field_id: 'val_f', aggregation: 'sum' },
        },
      });
      expect(result.data.value.column_id).to.equal('val_f');
      expect(result.data.value).to.not.have.property('field_id');
    });

    it('API field_id → column_id for metric', () => {
      const result = mapConfigToCamelCase({
        metric: { type: 'summary', field_id: 'met_f', aggregation: 'avg' },
      });
      expect(result.metric.column_id).to.equal('met_f');
      expect(result.metric).to.not.have.property('field_id');
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────

  describe('Edge cases', () => {
    it('null config returns null', () => {
      expect(mapConfigToSnakeCase(null as any)).to.be.null;
      expect(mapConfigToCamelCase(null as any)).to.be.null;
    });

    it('undefined config returns undefined', () => {
      expect(mapConfigToSnakeCase(undefined as any)).to.be.undefined;
      expect(mapConfigToCamelCase(undefined as any)).to.be.undefined;
    });

    it('empty object returns empty object', () => {
      expect(mapConfigToSnakeCase({})).to.deep.equal({});
      expect(mapConfigToCamelCase({})).to.deep.equal({});
    });

    it('unknown keys pass through unchanged', () => {
      const result = mapConfigToSnakeCase({
        customField: 'value',
        data: { xAxis: { column_id: 'c1', unknownProp: true } },
      });
      expect(result.customField).to.equal('value');
      expect(result.data.x_axis.unknownProp).to.equal(true);
    });

    it('data without xAxis/yAxis/category/value still works', () => {
      const result = mapConfigToSnakeCase({
        data: { someCustom: 'data' },
      });
      expect(result.data.someCustom).to.equal('data');
    });

    it('appearance without formatting/font still works', () => {
      const result = mapConfigToSnakeCase({
        appearance: { size: 'medium' },
      });
      expect(result.appearance.size).to.equal('medium');
    });

    it('yAxis without fields array still works', () => {
      const result = mapConfigToSnakeCase({
        data: { yAxis: { startAtZero: true } },
      });
      expect(result.data.y_axis.start_at_zero).to.equal(true);
    });

    it('xAxis without sortBy still works', () => {
      const result = mapConfigToSnakeCase({
        data: { xAxis: { column_id: 'c1', orderBy: 'asc' } },
      });
      expect(result.data.x_axis.field_id).to.equal('c1');
      expect(result.data.x_axis.order_by).to.equal('asc');
      expect(result.data.x_axis).to.not.have.property('sort_by');
    });
  });
}

export function dashboardV3ConfigTransformTest() {
  describe('Dashboard V3 Config Transform', dashboardV3ConfigTransformTests);
}
