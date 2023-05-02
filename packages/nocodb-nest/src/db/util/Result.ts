export default class Result {
  public code: any;
  public message: any;
  public data: any;
  public object: any;
  constructor(code = 0, message = '', data = {}) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
}
