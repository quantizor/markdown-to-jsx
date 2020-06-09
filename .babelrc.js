const prod = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: ['styled-components'],
  presets: [
    [
      'env',
      {
        loose: true,
        modules: process.env.BABEL_ENV === 'esm' ? false : 'commonjs',
      },
    ],
    'react',
    'stage-2',
    prod && ['minify', { flipComparisons: false }],
  ].filter(Boolean),
};
