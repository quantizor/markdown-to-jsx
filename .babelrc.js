const prod = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: ['emotion'],
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
    prod && 'minify',
  ].filter(Boolean),
};
