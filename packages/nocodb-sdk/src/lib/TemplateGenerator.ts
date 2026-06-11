import UITypes from './UITypes';

export interface Column {
  column_name: string;
  ref_column_name: string;
  uidt?: UITypes;
  dtxp?: any;
  dt?: any;
}
export interface Table {
  table_name: string;
  ref_table_name: string;
  columns: Array<Column>;
}
export interface Template {
  title: string;
  tables: Array<Table>;
}

export default abstract class TemplateGenerator {
  abstract parse(): Promise<any>;
  abstract parseTemplate(): Promise<Template>;
  abstract getColumns(): Promise<any>;
  abstract parseData(): Promise<any>;
  abstract getData(): Promise<{
    [table_name: string]: Array<{
      [key: string]: any;
    }>;
  }>;
}
