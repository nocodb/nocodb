module.exports = {
  mode: 'production',
  entry: './index.js',
  output: {
    filename: 'lib/or.min.js',
    library: {
      name: 'OpenReplay', // this makes it window.OpenReplay
      type: 'window',     // outputs to global window
      export: 'default',
    },
  },
  devtool: false,
};
