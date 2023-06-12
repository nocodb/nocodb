const Emittery = require('emittery');

let emitSingleton = null;

class Emit {
  public readonly evt: any;

  constructor() {
    if (emitSingleton) return emitSingleton;
    this.evt = new Emittery();
    emitSingleton = this;
  }
}
module.exports = Emit;
