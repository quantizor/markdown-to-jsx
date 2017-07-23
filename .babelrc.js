module.exports = {
    presets: [
        process.env.BABEL_ENV === 'esm' ? [
            'es2015', {
                modules: false,
            }
        ] : 'es2015',
        'react',
        'stage-2',
    ],
}
