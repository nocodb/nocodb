module.exports = {
  mode: 'production',
  entry: './index.js',
  output: {
    filename: 'lib/or.min.js',
    library: {
      name: 'OpenReplay',
      type: 'umd',
    },
    globalObject: 'this'
  }
};
