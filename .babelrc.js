const prod = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: ['emotion', prod && 'transform-react-remove-prop-types'].filter(
    Boolean
  ),
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
