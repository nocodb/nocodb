export default class Result<T = any> {
  public code: any;
  public message: any;
  public data: T;
  public object: any;
  constructor(code = 0, message = '', data: T | any = {}) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
}
