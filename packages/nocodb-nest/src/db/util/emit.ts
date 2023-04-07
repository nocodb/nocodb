import Emittery from 'emittery';

let emitSingleton = null;

export default class Emit {
  public evt: any;

  constructor() {
    if (emitSingleton) return emitSingleton;
    this.evt = new Emittery();
    emitSingleton = this;
  }
}
