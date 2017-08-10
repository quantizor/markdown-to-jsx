const plugins = [
    'emotion',
];

if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-react-remove-prop-types');
}

module.exports = {
    plugins,
    presets: [
        process.env.BABEL_ENV === 'esm' ? [
            'es2015', {
                modules: false,
            }
        ] : 'es2015',
        'react',
        'stage-2',
    ],
};
