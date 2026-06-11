export default class Result<T = any> {
  public code: any;
  public sql_code?: string;
  public message: any;
  public data: T;
  public object: any;
  constructor(code = 0, message = '', data: T | any = {}, sql_code?: string) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.sql_code = sql_code;
  }
}
