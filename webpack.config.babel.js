import path from 'path';

export default {
  devServer: {
    compress: true,
    contentBase: path.resolve(__dirname, 'docs'),
  },
  devtool: 'inline-source-map',
  entry: path.resolve(__dirname, 'site.js'),
  mode: 'development',
  module: {
    rules: [
      {
        exclude: /(node_modules)/,
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            plugins: ['emotion'],
            presets: [
              [
                'env',
                {
                  loose: true,
                  modules: false,
                },
              ],
              'react',
              'stage-2',
            ],
          },
        },
      },
    ],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'docs'),
  },
  plugins: [],
  resolve: {
    alias: {
      react: 'preact-compat',
      'react-dom': 'preact-compat',
    },
  },
};
