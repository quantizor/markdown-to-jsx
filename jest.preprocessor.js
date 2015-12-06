const babelJest = require('babel-jest');

module.exports = {
    process: function(src, filename) {
        return   filename.indexOf('node_modules') === -1
               ? babelJest.process(src, filename)
               : src;
    }
};
