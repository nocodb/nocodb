//define class
class Order {
  private matrix: any;
  private squareLen: any;
  constructor(squareMatrix) {
    if (squareMatrix) {
      this.matrix = squareMatrix;
      this.squareLen = this.matrix.length;
    }
  }

  _hasColumnZeroes(index) {
    for (let i = 0; i < this.matrix.length; ++i) {
      if (this.matrix[i][index] !== 0) {
        return false;
      }
    }

    return true;
  }

  _makeAllElementsInRowAsZero(index) {
    for (let i = 0; i < this.matrix.length; ++i) {
      this.matrix[index][i] = 0;
    }
  }

  _selfPointing() {
    const self = {};
    for (let i = 0; i < this.matrix.length; ++i) {
      if (this.matrix[i][i] === 1) {
        this.matrix[i][i] = 0;
        self[i] = i;
      }
    }
    return self;
  }

  _CycleBetweenNodes() {
    const two = [];

    for (let i = 0; i < this.matrix.length; ++i) {
      for (let j = i + 1; j < this.matrix.length; ++j) {
        if (i !== j && this.matrix[i][j] === 1 && this.matrix[j][i] === 1) {
          two.push([i, j]);
          console.log(i, j);
        }
      }
    }

    return two;
  }

  /***
   *
   * @returns {order:[],one:{},two:[],cycle:{}}
   */
  getOrder() {
    console.time('getOrder');

    const visited = {};
    const cycle = {};
    const order = [];
    const one = this._selfPointing();
    const two = this._CycleBetweenNodes();

    for (let i = 0; i < this.squareLen; ++i) {
      cycle[i] = i;
    }

    for (let i = 0; i < this.squareLen; ++i) {
      for (let j = 0; j < this.squareLen; ++j) {
        //console.log('- - - - - - - - - - - -- ');

        if (j in visited) {
          //console.log('Already visited',j);
        } else if (this._hasColumnZeroes(j)) {
          //console.log('Inserting to visit order --> ',j);
          visited[j] = j;
          delete cycle[j];
          order.push(j);
          this._makeAllElementsInRowAsZero(j);
        } else {
          //console.log('Column does not have zeroes',j);
        }

        if (order.length === this.squareLen) {
          console.timeEnd('getOrder');
          return { order, one, cycle };
        }
      }
    }

    console.timeEnd('getOrder');
    return { order, one, cycle, two };
  }

  setIndex(i, j) {
    if (i < this.matrix.length && j < this.matrix.length) {
      this.matrix[i][j] = 1;
    }
  }

  resetIndex(i, j) {
    if (i < this.matrix.length && j < this.matrix.length) {
      this.matrix[i][j] = 0;
    }
  }
}

export default Order;
