const plugins = [
    'emotion',
];

if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-react-remove-prop-types');
}

module.exports = {
    plugins,
    presets: [
        ['es2015', {
            loose: true,
            modules: process.env.BABEL_ENV === 'esm' ? false : 'commonjs',
        }],
        'react',
        'stage-2',
    ],
};
