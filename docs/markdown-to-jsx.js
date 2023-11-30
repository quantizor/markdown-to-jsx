(function (React, ReactDOM, styled) {

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
      Object.keys(e).forEach(function (k) {
        if (k !== 'default') {
          var d = Object.getOwnPropertyDescriptor(e, k);
          Object.defineProperty(n, k, d.get ? d : {
            enumerable: true,
            get: function () {
              return e[k];
            }
          });
        }
      });
    }
    n['default'] = e;
    return n;
  }

  var React__namespace = /*#__PURE__*/_interopNamespace(React);
  var ReactDOM__namespace = /*#__PURE__*/_interopNamespace(ReactDOM);
  var styled__default = /*#__PURE__*/_interopDefaultLegacy(styled);

  function _extends$1() {
    _extends$1 = Object.assign ? Object.assign.bind() : function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends$1.apply(this, arguments);
  }
  function _taggedTemplateLiteralLoose(strings, raw) {
    if (!raw) {
      raw = strings.slice(0);
    }
    strings.raw = raw;
    return strings;
  }

  function _extends() {
    _extends = Object.assign ? Object.assign.bind() : function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends.apply(this, arguments);
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };
    return _setPrototypeOf(o, p);
  }

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _isNativeFunction(fn) {
    return Function.toString.call(fn).indexOf("[native code]") !== -1;
  }

  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;
    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _construct(Parent, args, Class) {
    if (_isNativeReflectConstruct()) {
      _construct = Reflect.construct.bind();
    } else {
      _construct = function _construct(Parent, args, Class) {
        var a = [null];
        a.push.apply(a, args);
        var Constructor = Function.bind.apply(Parent, a);
        var instance = new Constructor();
        if (Class) _setPrototypeOf(instance, Class.prototype);
        return instance;
      };
    }
    return _construct.apply(null, arguments);
  }

  function _wrapNativeSuper(Class) {
    var _cache = typeof Map === "function" ? new Map() : undefined;
    _wrapNativeSuper = function _wrapNativeSuper(Class) {
      if (Class === null || !_isNativeFunction(Class)) return Class;
      if (typeof Class !== "function") {
        throw new TypeError("Super expression must either be null or a function");
      }
      if (typeof _cache !== "undefined") {
        if (_cache.has(Class)) return _cache.get(Class);
        _cache.set(Class, Wrapper);
      }
      function Wrapper() {
        return _construct(Class, arguments, _getPrototypeOf(this).constructor);
      }
      Wrapper.prototype = Object.create(Class.prototype, {
        constructor: {
          value: Wrapper,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
      return _setPrototypeOf(Wrapper, Class);
    };
    return _wrapNativeSuper(Class);
  }

  // based on https://github.com/styled-components/styled-components/blob/fcf6f3804c57a14dd7984dfab7bc06ee2edca044/src/utils/error.js

  /**
   * Parse errors.md and turn it into a simple hash of code: message
   * @private
   */
  var ERRORS = {
    "1": "Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75 }).\n\n",
    "2": "Passed invalid arguments to hsla, please pass multiple numbers e.g. hsla(360, 0.75, 0.4, 0.7) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75, alpha: 0.7 }).\n\n",
    "3": "Passed an incorrect argument to a color function, please pass a string representation of a color.\n\n",
    "4": "Couldn't generate valid rgb string from %s, it returned %s.\n\n",
    "5": "Couldn't parse the color string. Please provide the color as a string in hex, rgb, rgba, hsl or hsla notation.\n\n",
    "6": "Passed invalid arguments to rgb, please pass multiple numbers e.g. rgb(255, 205, 100) or an object e.g. rgb({ red: 255, green: 205, blue: 100 }).\n\n",
    "7": "Passed invalid arguments to rgba, please pass multiple numbers e.g. rgb(255, 205, 100, 0.75) or an object e.g. rgb({ red: 255, green: 205, blue: 100, alpha: 0.75 }).\n\n",
    "8": "Passed invalid argument to toColorString, please pass a RgbColor, RgbaColor, HslColor or HslaColor object.\n\n",
    "9": "Please provide a number of steps to the modularScale helper.\n\n",
    "10": "Please pass a number or one of the predefined scales to the modularScale helper as the ratio.\n\n",
    "11": "Invalid value passed as base to modularScale, expected number or em string but got \"%s\"\n\n",
    "12": "Expected a string ending in \"px\" or a number passed as the first argument to %s(), got \"%s\" instead.\n\n",
    "13": "Expected a string ending in \"px\" or a number passed as the second argument to %s(), got \"%s\" instead.\n\n",
    "14": "Passed invalid pixel value (\"%s\") to %s(), please pass a value like \"12px\" or 12.\n\n",
    "15": "Passed invalid base value (\"%s\") to %s(), please pass a value like \"12px\" or 12.\n\n",
    "16": "You must provide a template to this method.\n\n",
    "17": "You passed an unsupported selector state to this method.\n\n",
    "18": "minScreen and maxScreen must be provided as stringified numbers with the same units.\n\n",
    "19": "fromSize and toSize must be provided as stringified numbers with the same units.\n\n",
    "20": "expects either an array of objects or a single object with the properties prop, fromSize, and toSize.\n\n",
    "21": "expects the objects in the first argument array to have the properties `prop`, `fromSize`, and `toSize`.\n\n",
    "22": "expects the first argument object to have the properties `prop`, `fromSize`, and `toSize`.\n\n",
    "23": "fontFace expects a name of a font-family.\n\n",
    "24": "fontFace expects either the path to the font file(s) or a name of a local copy.\n\n",
    "25": "fontFace expects localFonts to be an array.\n\n",
    "26": "fontFace expects fileFormats to be an array.\n\n",
    "27": "radialGradient requries at least 2 color-stops to properly render.\n\n",
    "28": "Please supply a filename to retinaImage() as the first argument.\n\n",
    "29": "Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.\n\n",
    "30": "Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n",
    "31": "The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation\n\n",
    "32": "To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])\nTo pass a single animation please supply them in simple values, e.g. animation('rotate', '2s')\n\n",
    "33": "The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation\n\n",
    "34": "borderRadius expects a radius value as a string or number as the second argument.\n\n",
    "35": "borderRadius expects one of \"top\", \"bottom\", \"left\" or \"right\" as the first argument.\n\n",
    "36": "Property must be a string value.\n\n",
    "37": "Syntax Error at %s.\n\n",
    "38": "Formula contains a function that needs parentheses at %s.\n\n",
    "39": "Formula is missing closing parenthesis at %s.\n\n",
    "40": "Formula has too many closing parentheses at %s.\n\n",
    "41": "All values in a formula must have the same unit or be unitless.\n\n",
    "42": "Please provide a number of steps to the modularScale helper.\n\n",
    "43": "Please pass a number or one of the predefined scales to the modularScale helper as the ratio.\n\n",
    "44": "Invalid value passed as base to modularScale, expected number or em/rem string but got %s.\n\n",
    "45": "Passed invalid argument to hslToColorString, please pass a HslColor or HslaColor object.\n\n",
    "46": "Passed invalid argument to rgbToColorString, please pass a RgbColor or RgbaColor object.\n\n",
    "47": "minScreen and maxScreen must be provided as stringified numbers with the same units.\n\n",
    "48": "fromSize and toSize must be provided as stringified numbers with the same units.\n\n",
    "49": "Expects either an array of objects or a single object with the properties prop, fromSize, and toSize.\n\n",
    "50": "Expects the objects in the first argument array to have the properties prop, fromSize, and toSize.\n\n",
    "51": "Expects the first argument object to have the properties prop, fromSize, and toSize.\n\n",
    "52": "fontFace expects either the path to the font file(s) or a name of a local copy.\n\n",
    "53": "fontFace expects localFonts to be an array.\n\n",
    "54": "fontFace expects fileFormats to be an array.\n\n",
    "55": "fontFace expects a name of a font-family.\n\n",
    "56": "linearGradient requries at least 2 color-stops to properly render.\n\n",
    "57": "radialGradient requries at least 2 color-stops to properly render.\n\n",
    "58": "Please supply a filename to retinaImage() as the first argument.\n\n",
    "59": "Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.\n\n",
    "60": "Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n",
    "61": "Property must be a string value.\n\n",
    "62": "borderRadius expects a radius value as a string or number as the second argument.\n\n",
    "63": "borderRadius expects one of \"top\", \"bottom\", \"left\" or \"right\" as the first argument.\n\n",
    "64": "The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation.\n\n",
    "65": "To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])\\nTo pass a single animation please supply them in simple values, e.g. animation('rotate', '2s').\n\n",
    "66": "The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation.\n\n",
    "67": "You must provide a template to this method.\n\n",
    "68": "You passed an unsupported selector state to this method.\n\n",
    "69": "Expected a string ending in \"px\" or a number passed as the first argument to %s(), got %s instead.\n\n",
    "70": "Expected a string ending in \"px\" or a number passed as the second argument to %s(), got %s instead.\n\n",
    "71": "Passed invalid pixel value %s to %s(), please pass a value like \"12px\" or 12.\n\n",
    "72": "Passed invalid base value %s to %s(), please pass a value like \"12px\" or 12.\n\n",
    "73": "Please provide a valid CSS variable.\n\n",
    "74": "CSS variable not found and no default was provided.\n\n",
    "75": "important requires a valid style object, got a %s instead.\n\n",
    "76": "fromSize and toSize must be provided as stringified numbers with the same units as minScreen and maxScreen.\n\n",
    "77": "remToPx expects a value in \"rem\" but you provided it in \"%s\".\n\n",
    "78": "base must be set in \"px\" or \"%\" but you set it in \"%s\".\n"
  };
  /**
   * super basic version of sprintf
   * @private
   */

  function format() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var a = args[0];
    var b = [];
    var c;
    for (c = 1; c < args.length; c += 1) {
      b.push(args[c]);
    }
    b.forEach(function (d) {
      a = a.replace(/%[a-z]/, d);
    });
    return a;
  }
  /**
   * Create an error file out of errors.md for development and a simple web link to the full errors
   * in production mode.
   * @private
   */

  var PolishedError = /*#__PURE__*/function (_Error) {
    _inheritsLoose(PolishedError, _Error);
    function PolishedError(code) {
      var _this;
      {
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        _this = _Error.call(this, format.apply(void 0, [ERRORS[code]].concat(args))) || this;
      }
      return _assertThisInitialized(_this);
    }
    return PolishedError;
  }( /*#__PURE__*/_wrapNativeSuper(Error));
  function colorToInt(color) {
    return Math.round(color * 255);
  }
  function convertToInt(red, green, blue) {
    return colorToInt(red) + "," + colorToInt(green) + "," + colorToInt(blue);
  }
  function hslToRgb(hue, saturation, lightness, convert) {
    if (convert === void 0) {
      convert = convertToInt;
    }
    if (saturation === 0) {
      // achromatic
      return convert(lightness, lightness, lightness);
    } // formulae from https://en.wikipedia.org/wiki/HSL_and_HSV

    var huePrime = (hue % 360 + 360) % 360 / 60;
    var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    var secondComponent = chroma * (1 - Math.abs(huePrime % 2 - 1));
    var red = 0;
    var green = 0;
    var blue = 0;
    if (huePrime >= 0 && huePrime < 1) {
      red = chroma;
      green = secondComponent;
    } else if (huePrime >= 1 && huePrime < 2) {
      red = secondComponent;
      green = chroma;
    } else if (huePrime >= 2 && huePrime < 3) {
      green = chroma;
      blue = secondComponent;
    } else if (huePrime >= 3 && huePrime < 4) {
      green = secondComponent;
      blue = chroma;
    } else if (huePrime >= 4 && huePrime < 5) {
      red = secondComponent;
      blue = chroma;
    } else if (huePrime >= 5 && huePrime < 6) {
      red = chroma;
      blue = secondComponent;
    }
    var lightnessModification = lightness - chroma / 2;
    var finalRed = red + lightnessModification;
    var finalGreen = green + lightnessModification;
    var finalBlue = blue + lightnessModification;
    return convert(finalRed, finalGreen, finalBlue);
  }
  var namedColorMap = {
    aliceblue: 'f0f8ff',
    antiquewhite: 'faebd7',
    aqua: '00ffff',
    aquamarine: '7fffd4',
    azure: 'f0ffff',
    beige: 'f5f5dc',
    bisque: 'ffe4c4',
    black: '000',
    blanchedalmond: 'ffebcd',
    blue: '0000ff',
    blueviolet: '8a2be2',
    brown: 'a52a2a',
    burlywood: 'deb887',
    cadetblue: '5f9ea0',
    chartreuse: '7fff00',
    chocolate: 'd2691e',
    coral: 'ff7f50',
    cornflowerblue: '6495ed',
    cornsilk: 'fff8dc',
    crimson: 'dc143c',
    cyan: '00ffff',
    darkblue: '00008b',
    darkcyan: '008b8b',
    darkgoldenrod: 'b8860b',
    darkgray: 'a9a9a9',
    darkgreen: '006400',
    darkgrey: 'a9a9a9',
    darkkhaki: 'bdb76b',
    darkmagenta: '8b008b',
    darkolivegreen: '556b2f',
    darkorange: 'ff8c00',
    darkorchid: '9932cc',
    darkred: '8b0000',
    darksalmon: 'e9967a',
    darkseagreen: '8fbc8f',
    darkslateblue: '483d8b',
    darkslategray: '2f4f4f',
    darkslategrey: '2f4f4f',
    darkturquoise: '00ced1',
    darkviolet: '9400d3',
    deeppink: 'ff1493',
    deepskyblue: '00bfff',
    dimgray: '696969',
    dimgrey: '696969',
    dodgerblue: '1e90ff',
    firebrick: 'b22222',
    floralwhite: 'fffaf0',
    forestgreen: '228b22',
    fuchsia: 'ff00ff',
    gainsboro: 'dcdcdc',
    ghostwhite: 'f8f8ff',
    gold: 'ffd700',
    goldenrod: 'daa520',
    gray: '808080',
    green: '008000',
    greenyellow: 'adff2f',
    grey: '808080',
    honeydew: 'f0fff0',
    hotpink: 'ff69b4',
    indianred: 'cd5c5c',
    indigo: '4b0082',
    ivory: 'fffff0',
    khaki: 'f0e68c',
    lavender: 'e6e6fa',
    lavenderblush: 'fff0f5',
    lawngreen: '7cfc00',
    lemonchiffon: 'fffacd',
    lightblue: 'add8e6',
    lightcoral: 'f08080',
    lightcyan: 'e0ffff',
    lightgoldenrodyellow: 'fafad2',
    lightgray: 'd3d3d3',
    lightgreen: '90ee90',
    lightgrey: 'd3d3d3',
    lightpink: 'ffb6c1',
    lightsalmon: 'ffa07a',
    lightseagreen: '20b2aa',
    lightskyblue: '87cefa',
    lightslategray: '789',
    lightslategrey: '789',
    lightsteelblue: 'b0c4de',
    lightyellow: 'ffffe0',
    lime: '0f0',
    limegreen: '32cd32',
    linen: 'faf0e6',
    magenta: 'f0f',
    maroon: '800000',
    mediumaquamarine: '66cdaa',
    mediumblue: '0000cd',
    mediumorchid: 'ba55d3',
    mediumpurple: '9370db',
    mediumseagreen: '3cb371',
    mediumslateblue: '7b68ee',
    mediumspringgreen: '00fa9a',
    mediumturquoise: '48d1cc',
    mediumvioletred: 'c71585',
    midnightblue: '191970',
    mintcream: 'f5fffa',
    mistyrose: 'ffe4e1',
    moccasin: 'ffe4b5',
    navajowhite: 'ffdead',
    navy: '000080',
    oldlace: 'fdf5e6',
    olive: '808000',
    olivedrab: '6b8e23',
    orange: 'ffa500',
    orangered: 'ff4500',
    orchid: 'da70d6',
    palegoldenrod: 'eee8aa',
    palegreen: '98fb98',
    paleturquoise: 'afeeee',
    palevioletred: 'db7093',
    papayawhip: 'ffefd5',
    peachpuff: 'ffdab9',
    peru: 'cd853f',
    pink: 'ffc0cb',
    plum: 'dda0dd',
    powderblue: 'b0e0e6',
    purple: '800080',
    rebeccapurple: '639',
    red: 'f00',
    rosybrown: 'bc8f8f',
    royalblue: '4169e1',
    saddlebrown: '8b4513',
    salmon: 'fa8072',
    sandybrown: 'f4a460',
    seagreen: '2e8b57',
    seashell: 'fff5ee',
    sienna: 'a0522d',
    silver: 'c0c0c0',
    skyblue: '87ceeb',
    slateblue: '6a5acd',
    slategray: '708090',
    slategrey: '708090',
    snow: 'fffafa',
    springgreen: '00ff7f',
    steelblue: '4682b4',
    tan: 'd2b48c',
    teal: '008080',
    thistle: 'd8bfd8',
    tomato: 'ff6347',
    turquoise: '40e0d0',
    violet: 'ee82ee',
    wheat: 'f5deb3',
    white: 'fff',
    whitesmoke: 'f5f5f5',
    yellow: 'ff0',
    yellowgreen: '9acd32'
  };
  /**
   * Checks if a string is a CSS named color and returns its equivalent hex value, otherwise returns the original color.
   * @private
   */

  function nameToHex(color) {
    if (typeof color !== 'string') return color;
    var normalizedColorName = color.toLowerCase();
    return namedColorMap[normalizedColorName] ? "#" + namedColorMap[normalizedColorName] : color;
  }
  var hexRegex = /^#[a-fA-F0-9]{6}$/;
  var hexRgbaRegex = /^#[a-fA-F0-9]{8}$/;
  var reducedHexRegex = /^#[a-fA-F0-9]{3}$/;
  var reducedRgbaHexRegex = /^#[a-fA-F0-9]{4}$/;
  var rgbRegex = /^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i;
  var rgbaRegex = /^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;
  var hslRegex = /^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i;
  var hslaRegex = /^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;
  /**
   * Returns an RgbColor or RgbaColor object. This utility function is only useful
   * if want to extract a color component. With the color util `toColorString` you
   * can convert a RgbColor or RgbaColor object back to a string.
   *
   * @example
   * // Assigns `{ red: 255, green: 0, blue: 0 }` to color1
   * const color1 = parseToRgb('rgb(255, 0, 0)');
   * // Assigns `{ red: 92, green: 102, blue: 112, alpha: 0.75 }` to color2
   * const color2 = parseToRgb('hsla(210, 10%, 40%, 0.75)');
   */

  function parseToRgb(color) {
    if (typeof color !== 'string') {
      throw new PolishedError(3);
    }
    var normalizedColor = nameToHex(color);
    if (normalizedColor.match(hexRegex)) {
      return {
        red: parseInt("" + normalizedColor[1] + normalizedColor[2], 16),
        green: parseInt("" + normalizedColor[3] + normalizedColor[4], 16),
        blue: parseInt("" + normalizedColor[5] + normalizedColor[6], 16)
      };
    }
    if (normalizedColor.match(hexRgbaRegex)) {
      var alpha = parseFloat((parseInt("" + normalizedColor[7] + normalizedColor[8], 16) / 255).toFixed(2));
      return {
        red: parseInt("" + normalizedColor[1] + normalizedColor[2], 16),
        green: parseInt("" + normalizedColor[3] + normalizedColor[4], 16),
        blue: parseInt("" + normalizedColor[5] + normalizedColor[6], 16),
        alpha: alpha
      };
    }
    if (normalizedColor.match(reducedHexRegex)) {
      return {
        red: parseInt("" + normalizedColor[1] + normalizedColor[1], 16),
        green: parseInt("" + normalizedColor[2] + normalizedColor[2], 16),
        blue: parseInt("" + normalizedColor[3] + normalizedColor[3], 16)
      };
    }
    if (normalizedColor.match(reducedRgbaHexRegex)) {
      var _alpha = parseFloat((parseInt("" + normalizedColor[4] + normalizedColor[4], 16) / 255).toFixed(2));
      return {
        red: parseInt("" + normalizedColor[1] + normalizedColor[1], 16),
        green: parseInt("" + normalizedColor[2] + normalizedColor[2], 16),
        blue: parseInt("" + normalizedColor[3] + normalizedColor[3], 16),
        alpha: _alpha
      };
    }
    var rgbMatched = rgbRegex.exec(normalizedColor);
    if (rgbMatched) {
      return {
        red: parseInt("" + rgbMatched[1], 10),
        green: parseInt("" + rgbMatched[2], 10),
        blue: parseInt("" + rgbMatched[3], 10)
      };
    }
    var rgbaMatched = rgbaRegex.exec(normalizedColor.substring(0, 50));
    if (rgbaMatched) {
      return {
        red: parseInt("" + rgbaMatched[1], 10),
        green: parseInt("" + rgbaMatched[2], 10),
        blue: parseInt("" + rgbaMatched[3], 10),
        alpha: parseFloat("" + rgbaMatched[4]) > 1 ? parseFloat("" + rgbaMatched[4]) / 100 : parseFloat("" + rgbaMatched[4])
      };
    }
    var hslMatched = hslRegex.exec(normalizedColor);
    if (hslMatched) {
      var hue = parseInt("" + hslMatched[1], 10);
      var saturation = parseInt("" + hslMatched[2], 10) / 100;
      var lightness = parseInt("" + hslMatched[3], 10) / 100;
      var rgbColorString = "rgb(" + hslToRgb(hue, saturation, lightness) + ")";
      var hslRgbMatched = rgbRegex.exec(rgbColorString);
      if (!hslRgbMatched) {
        throw new PolishedError(4, normalizedColor, rgbColorString);
      }
      return {
        red: parseInt("" + hslRgbMatched[1], 10),
        green: parseInt("" + hslRgbMatched[2], 10),
        blue: parseInt("" + hslRgbMatched[3], 10)
      };
    }
    var hslaMatched = hslaRegex.exec(normalizedColor.substring(0, 50));
    if (hslaMatched) {
      var _hue = parseInt("" + hslaMatched[1], 10);
      var _saturation = parseInt("" + hslaMatched[2], 10) / 100;
      var _lightness = parseInt("" + hslaMatched[3], 10) / 100;
      var _rgbColorString = "rgb(" + hslToRgb(_hue, _saturation, _lightness) + ")";
      var _hslRgbMatched = rgbRegex.exec(_rgbColorString);
      if (!_hslRgbMatched) {
        throw new PolishedError(4, normalizedColor, _rgbColorString);
      }
      return {
        red: parseInt("" + _hslRgbMatched[1], 10),
        green: parseInt("" + _hslRgbMatched[2], 10),
        blue: parseInt("" + _hslRgbMatched[3], 10),
        alpha: parseFloat("" + hslaMatched[4]) > 1 ? parseFloat("" + hslaMatched[4]) / 100 : parseFloat("" + hslaMatched[4])
      };
    }
    throw new PolishedError(5);
  }
  function rgbToHsl(color) {
    // make sure rgb are contained in a set of [0, 255]
    var red = color.red / 255;
    var green = color.green / 255;
    var blue = color.blue / 255;
    var max = Math.max(red, green, blue);
    var min = Math.min(red, green, blue);
    var lightness = (max + min) / 2;
    if (max === min) {
      // achromatic
      if (color.alpha !== undefined) {
        return {
          hue: 0,
          saturation: 0,
          lightness: lightness,
          alpha: color.alpha
        };
      } else {
        return {
          hue: 0,
          saturation: 0,
          lightness: lightness
        };
      }
    }
    var hue;
    var delta = max - min;
    var saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        // blue case
        hue = (red - green) / delta + 4;
        break;
    }
    hue *= 60;
    if (color.alpha !== undefined) {
      return {
        hue: hue,
        saturation: saturation,
        lightness: lightness,
        alpha: color.alpha
      };
    }
    return {
      hue: hue,
      saturation: saturation,
      lightness: lightness
    };
  }

  /**
   * Returns an HslColor or HslaColor object. This utility function is only useful
   * if want to extract a color component. With the color util `toColorString` you
   * can convert a HslColor or HslaColor object back to a string.
   *
   * @example
   * // Assigns `{ hue: 0, saturation: 1, lightness: 0.5 }` to color1
   * const color1 = parseToHsl('rgb(255, 0, 0)');
   * // Assigns `{ hue: 128, saturation: 1, lightness: 0.5, alpha: 0.75 }` to color2
   * const color2 = parseToHsl('hsla(128, 100%, 50%, 0.75)');
   */
  function parseToHsl(color) {
    // Note: At a later stage we can optimize this function as right now a hsl
    // color would be parsed converted to rgb values and converted back to hsl.
    return rgbToHsl(parseToRgb(color));
  }

  /**
   * Reduces hex values if possible e.g. #ff8866 to #f86
   * @private
   */
  var reduceHexValue = function reduceHexValue(value) {
    if (value.length === 7 && value[1] === value[2] && value[3] === value[4] && value[5] === value[6]) {
      return "#" + value[1] + value[3] + value[5];
    }
    return value;
  };
  var reduceHexValue$1 = reduceHexValue;
  function numberToHex(value) {
    var hex = value.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }
  function colorToHex(color) {
    return numberToHex(Math.round(color * 255));
  }
  function convertToHex(red, green, blue) {
    return reduceHexValue$1("#" + colorToHex(red) + colorToHex(green) + colorToHex(blue));
  }
  function hslToHex(hue, saturation, lightness) {
    return hslToRgb(hue, saturation, lightness, convertToHex);
  }

  /**
   * Returns a string value for the color. The returned result is the smallest possible hex notation.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: hsl(359, 0.75, 0.4),
   *   background: hsl({ hue: 360, saturation: 0.75, lightness: 0.4 }),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${hsl(359, 0.75, 0.4)};
   *   background: ${hsl({ hue: 360, saturation: 0.75, lightness: 0.4 })};
   * `
   *
   * // CSS in JS Output
   *
   * element {
   *   background: "#b3191c";
   *   background: "#b3191c";
   * }
   */
  function hsl(value, saturation, lightness) {
    if (typeof value === 'number' && typeof saturation === 'number' && typeof lightness === 'number') {
      return hslToHex(value, saturation, lightness);
    } else if (typeof value === 'object' && saturation === undefined && lightness === undefined) {
      return hslToHex(value.hue, value.saturation, value.lightness);
    }
    throw new PolishedError(1);
  }

  /**
   * Returns a string value for the color. The returned result is the smallest possible rgba or hex notation.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: hsla(359, 0.75, 0.4, 0.7),
   *   background: hsla({ hue: 360, saturation: 0.75, lightness: 0.4, alpha: 0,7 }),
   *   background: hsla(359, 0.75, 0.4, 1),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${hsla(359, 0.75, 0.4, 0.7)};
   *   background: ${hsla({ hue: 360, saturation: 0.75, lightness: 0.4, alpha: 0,7 })};
   *   background: ${hsla(359, 0.75, 0.4, 1)};
   * `
   *
   * // CSS in JS Output
   *
   * element {
   *   background: "rgba(179,25,28,0.7)";
   *   background: "rgba(179,25,28,0.7)";
   *   background: "#b3191c";
   * }
   */
  function hsla(value, saturation, lightness, alpha) {
    if (typeof value === 'number' && typeof saturation === 'number' && typeof lightness === 'number' && typeof alpha === 'number') {
      return alpha >= 1 ? hslToHex(value, saturation, lightness) : "rgba(" + hslToRgb(value, saturation, lightness) + "," + alpha + ")";
    } else if (typeof value === 'object' && saturation === undefined && lightness === undefined && alpha === undefined) {
      return value.alpha >= 1 ? hslToHex(value.hue, value.saturation, value.lightness) : "rgba(" + hslToRgb(value.hue, value.saturation, value.lightness) + "," + value.alpha + ")";
    }
    throw new PolishedError(2);
  }

  /**
   * Returns a string value for the color. The returned result is the smallest possible hex notation.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: rgb(255, 205, 100),
   *   background: rgb({ red: 255, green: 205, blue: 100 }),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${rgb(255, 205, 100)};
   *   background: ${rgb({ red: 255, green: 205, blue: 100 })};
   * `
   *
   * // CSS in JS Output
   *
   * element {
   *   background: "#ffcd64";
   *   background: "#ffcd64";
   * }
   */
  function rgb(value, green, blue) {
    if (typeof value === 'number' && typeof green === 'number' && typeof blue === 'number') {
      return reduceHexValue$1("#" + numberToHex(value) + numberToHex(green) + numberToHex(blue));
    } else if (typeof value === 'object' && green === undefined && blue === undefined) {
      return reduceHexValue$1("#" + numberToHex(value.red) + numberToHex(value.green) + numberToHex(value.blue));
    }
    throw new PolishedError(6);
  }

  /**
   * Returns a string value for the color. The returned result is the smallest possible rgba or hex notation.
   *
   * Can also be used to fade a color by passing a hex value or named CSS color along with an alpha value.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: rgba(255, 205, 100, 0.7),
   *   background: rgba({ red: 255, green: 205, blue: 100, alpha: 0.7 }),
   *   background: rgba(255, 205, 100, 1),
   *   background: rgba('#ffffff', 0.4),
   *   background: rgba('black', 0.7),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${rgba(255, 205, 100, 0.7)};
   *   background: ${rgba({ red: 255, green: 205, blue: 100, alpha: 0.7 })};
   *   background: ${rgba(255, 205, 100, 1)};
   *   background: ${rgba('#ffffff', 0.4)};
   *   background: ${rgba('black', 0.7)};
   * `
   *
   * // CSS in JS Output
   *
   * element {
   *   background: "rgba(255,205,100,0.7)";
   *   background: "rgba(255,205,100,0.7)";
   *   background: "#ffcd64";
   *   background: "rgba(255,255,255,0.4)";
   *   background: "rgba(0,0,0,0.7)";
   * }
   */
  function rgba(firstValue, secondValue, thirdValue, fourthValue) {
    if (typeof firstValue === 'string' && typeof secondValue === 'number') {
      var rgbValue = parseToRgb(firstValue);
      return "rgba(" + rgbValue.red + "," + rgbValue.green + "," + rgbValue.blue + "," + secondValue + ")";
    } else if (typeof firstValue === 'number' && typeof secondValue === 'number' && typeof thirdValue === 'number' && typeof fourthValue === 'number') {
      return fourthValue >= 1 ? rgb(firstValue, secondValue, thirdValue) : "rgba(" + firstValue + "," + secondValue + "," + thirdValue + "," + fourthValue + ")";
    } else if (typeof firstValue === 'object' && secondValue === undefined && thirdValue === undefined && fourthValue === undefined) {
      return firstValue.alpha >= 1 ? rgb(firstValue.red, firstValue.green, firstValue.blue) : "rgba(" + firstValue.red + "," + firstValue.green + "," + firstValue.blue + "," + firstValue.alpha + ")";
    }
    throw new PolishedError(7);
  }
  var isRgb = function isRgb(color) {
    return typeof color.red === 'number' && typeof color.green === 'number' && typeof color.blue === 'number' && (typeof color.alpha !== 'number' || typeof color.alpha === 'undefined');
  };
  var isRgba = function isRgba(color) {
    return typeof color.red === 'number' && typeof color.green === 'number' && typeof color.blue === 'number' && typeof color.alpha === 'number';
  };
  var isHsl = function isHsl(color) {
    return typeof color.hue === 'number' && typeof color.saturation === 'number' && typeof color.lightness === 'number' && (typeof color.alpha !== 'number' || typeof color.alpha === 'undefined');
  };
  var isHsla = function isHsla(color) {
    return typeof color.hue === 'number' && typeof color.saturation === 'number' && typeof color.lightness === 'number' && typeof color.alpha === 'number';
  };
  /**
   * Converts a RgbColor, RgbaColor, HslColor or HslaColor object to a color string.
   * This util is useful in case you only know on runtime which color object is
   * used. Otherwise we recommend to rely on `rgb`, `rgba`, `hsl` or `hsla`.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: toColorString({ red: 255, green: 205, blue: 100 }),
   *   background: toColorString({ red: 255, green: 205, blue: 100, alpha: 0.72 }),
   *   background: toColorString({ hue: 240, saturation: 1, lightness: 0.5 }),
   *   background: toColorString({ hue: 360, saturation: 0.75, lightness: 0.4, alpha: 0.72 }),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${toColorString({ red: 255, green: 205, blue: 100 })};
   *   background: ${toColorString({ red: 255, green: 205, blue: 100, alpha: 0.72 })};
   *   background: ${toColorString({ hue: 240, saturation: 1, lightness: 0.5 })};
   *   background: ${toColorString({ hue: 360, saturation: 0.75, lightness: 0.4, alpha: 0.72 })};
   * `
   *
   * // CSS in JS Output
   * element {
   *   background: "#ffcd64";
   *   background: "rgba(255,205,100,0.72)";
   *   background: "#00f";
   *   background: "rgba(179,25,25,0.72)";
   * }
   */

  function toColorString(color) {
    if (typeof color !== 'object') throw new PolishedError(8);
    if (isRgba(color)) return rgba(color);
    if (isRgb(color)) return rgb(color);
    if (isHsla(color)) return hsla(color);
    if (isHsl(color)) return hsl(color);
    throw new PolishedError(8);
  }

  // Type definitions taken from https://github.com/gcanti/flow-static-land/blob/master/src/Fun.js
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-redeclare
  function curried(f, length, acc) {
    return function fn() {
      // eslint-disable-next-line prefer-rest-params
      var combined = acc.concat(Array.prototype.slice.call(arguments));
      return combined.length >= length ? f.apply(this, combined) : curried(f, length, combined);
    };
  } // eslint-disable-next-line no-redeclare

  function curry(f) {
    // eslint-disable-line no-redeclare
    return curried(f, f.length, []);
  }
  function guard(lowerBoundary, upperBoundary, value) {
    return Math.max(lowerBoundary, Math.min(upperBoundary, value));
  }

  /**
   * Returns a string value for the lightened color.
   *
   * @example
   * // Styles as object usage
   * const styles = {
   *   background: lighten(0.2, '#CCCD64'),
   *   background: lighten('0.2', 'rgba(204,205,100,0.7)'),
   * }
   *
   * // styled-components usage
   * const div = styled.div`
   *   background: ${lighten(0.2, '#FFCD64')};
   *   background: ${lighten('0.2', 'rgba(204,205,100,0.7)')};
   * `
   *
   * // CSS in JS Output
   *
   * element {
   *   background: "#e5e6b1";
   *   background: "rgba(229,230,177,0.7)";
   * }
   */

  function lighten(amount, color) {
    if (color === 'transparent') return color;
    var hslColor = parseToHsl(color);
    return toColorString(_extends({}, hslColor, {
      lightness: guard(0, 1, hslColor.lightness + parseFloat(amount))
    }));
  } // prettier-ignore

  var curriedLighten = /*#__PURE__*/curry
  /* ::<number | string, string, string> */(lighten);
  var curriedLighten$1 = curriedLighten;

  function r() {
    return r = Object.assign ? Object.assign.bind() : function (n) {
      for (var r = 1; r < arguments.length; r++) {
        var t = arguments[r];
        for (var e in t) Object.prototype.hasOwnProperty.call(t, e) && (n[e] = t[e]);
      }
      return n;
    }, r.apply(this, arguments);
  }
  var t = ["children", "options"],
    e = ["allowFullScreen", "allowTransparency", "autoComplete", "autoFocus", "autoPlay", "cellPadding", "cellSpacing", "charSet", "className", "classId", "colSpan", "contentEditable", "contextMenu", "crossOrigin", "encType", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "frameBorder", "hrefLang", "inputMode", "keyParams", "keyType", "marginHeight", "marginWidth", "maxLength", "mediaGroup", "minLength", "noValidate", "radioGroup", "readOnly", "rowSpan", "spellCheck", "srcDoc", "srcLang", "srcSet", "tabIndex", "useMap"].reduce(function (n, r) {
      return n[r.toLowerCase()] = r, n;
    }, {
      "for": "htmlFor"
    }),
    o = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "“"
    },
    u = ["style", "script"],
    a = /([-A-Z0-9_:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|(?:\{((?:\\.|{[^}]*?}|[^}])*)\})))?/gi,
    c = /mailto:/i,
    i = /\n{2,}$/,
    _ = /^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/,
    f = /^ *> ?/gm,
    l = /^ {2,}\n/,
    s = /^(?:( *[-*_])){3,} *(?:\n *)+\n/,
    d = /^\s*(`{3,}|~{3,}) *(\S+)?([^\n]*?)?\n([\s\S]+?)\s*\1 *(?:\n *)*\n?/,
    p = /^(?: {4}[^\n]+\n*)+(?:\n *)+\n?/,
    m = /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    g = /^(?:\n *)*\n/,
    v = /\r\n?/g,
    y = /^\[\^([^\]]+)](:.*)\n/,
    h = /^\[\^([^\]]+)]/,
    k = /\f/g,
    x = /^\s*?\[(x|\s)\]/,
    b = /^ *(#{1,6}) *([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/,
    S = /^ *(#{1,6}) +([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/,
    $ = /^([^\n]+)\n *(=|-){3,} *(?:\n *)+\n/,
    z = /^ *(?!<[a-z][^ >/]* ?\/>)<([a-z][^ >/]*) ?([^>]*)\/{0}>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1)[\s\S])*?)<\/\1>\n*/i,
    w = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/gi,
    A = /^<!--[\s\S]*?(?:-->)/,
    H = /^(data|aria|x)-[a-z_][a-z\d_.-]*$/,
    E = /^ *<([a-z][a-z0-9:]*)(?:\s+((?:<.*?>|[^>])*))?\/?>(?!<\/\1>)(\s*\n)?/i,
    L = /^\{.*\}$/,
    M = /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    O = /^<([^ >]+@[^ >]+)>/,
    I = /^<([^ >]+:\/[^ >]+)>/,
    j = /-([a-z])?/gi,
    B = /^(.*\|?.*)\n *(\|? *[-:]+ *\|[-| :]*)\n((?:.*\|.*\n)*)\n?/,
    R = /^\[([^\]]*)\]:\s+<?([^\s>]+)>?\s*("([^"]*)")?/,
    T = /^!\[([^\]]*)\] ?\[([^\]]*)\]/,
    C = /^\[([^\]]*)\] ?\[([^\]]*)\]/,
    D = /(\[|\])/g,
    F = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/,
    N = /\t/g,
    P = /^ *\| */,
    Z = /(^ *\||\| *$)/g,
    G = / *$/,
    q = /^ *:-+: *$/,
    U = /^ *:-+ *$/,
    V = /^ *-+: *$/,
    W = /^([*_])\1((?:\[.*?\][([].*?[)\]]|<.*?>(?:.*?<.*?>)?|`.*?`|~+.*?~+|.)*?)\1\1(?!\1)/,
    Q = /^([*_])((?:\[.*?\][([].*?[)\]]|<.*?>(?:.*?<.*?>)?|`.*?`|~+.*?~+|.)*?)\1(?!\1|\w)/,
    X = /^==((?:\[.*?\]|<.*?>(?:.*?<.*?>)?|`.*?`|.)*?)==/,
    J = /^~~((?:\[.*?\]|<.*?>(?:.*?<.*?>)?|`.*?`|.)*?)~~/,
    K = /^\\([^0-9A-Za-z\s])/,
    Y = /^[\s\S]+?(?=[^0-9A-Z\s\u00c0-\uffff&#;.()'"]|\d+\.|\n\n| {2,}\n|\w+:\S|$)/i,
    nn = /^\n+/,
    rn = /^([ \t]*)/,
    tn = /\\([^\\])/g,
    en = / *\n+$/,
    on = /(?:^|\n)( *)$/,
    un = "(?:\\d+\\.)",
    an = "(?:[*+-])";
  function cn(n) {
    return "( *)(" + (1 === n ? un : an) + ") +";
  }
  var _n = cn(1),
    fn = cn(2);
  function ln(n) {
    return new RegExp("^" + (1 === n ? _n : fn));
  }
  var sn = ln(1),
    dn = ln(2);
  function pn(n) {
    return new RegExp("^" + (1 === n ? _n : fn) + "[^\\n]*(?:\\n(?!\\1" + (1 === n ? un : an) + " )[^\\n]*)*(\\n|$)", "gm");
  }
  var mn = pn(1),
    gn = pn(2);
  function vn(n) {
    var r = 1 === n ? un : an;
    return new RegExp("^( *)(" + r + ") [\\s\\S]+?(?:\\n{2,}(?! )(?!\\1" + r + " (?!" + r + " ))\\n*|\\s*\\n*$)");
  }
  var yn = vn(1),
    hn = vn(2);
  function kn(n, r) {
    var t = 1 === r,
      e = t ? yn : hn,
      o = t ? mn : gn,
      u = t ? sn : dn;
    return {
      t: function t(n, r, _t) {
        var o = on.exec(_t);
        return o && (r.o || !r.u && !r.i) ? e.exec(n = o[1] + n) : null;
      },
      _: Fn.HIGH,
      l: function l(n, r, e) {
        var a = t ? +n[2] : void 0,
          c = n[0].replace(i, "\n").match(o),
          _ = !1;
        return {
          p: c.map(function (n, t) {
            var o = u.exec(n)[0].length,
              a = new RegExp("^ {1," + o + "}", "gm"),
              i = n.replace(a, "").replace(u, ""),
              f = t === c.length - 1,
              l = -1 !== i.indexOf("\n\n") || f && _;
            _ = l;
            var s,
              d = e.u,
              p = e.o;
            e.o = !0, l ? (e.u = !1, s = i.replace(en, "\n\n")) : (e.u = !0, s = i.replace(en, ""));
            var m = r(s, e);
            return e.u = d, e.o = p, m;
          }),
          m: t,
          g: a
        };
      },
      v: function v(r, t, e) {
        return n(r.m ? "ol" : "ul", {
          key: e.h,
          start: r.g
        }, r.p.map(function (r, o) {
          return n("li", {
            key: o
          }, t(r, e));
        }));
      }
    };
  }
  var xn = /^\[([^\]]*)]\( *((?:\([^)]*\)|[^() ])*) *"?([^)"]*)?"?\)/,
    bn = /^!\[([^\]]*)]\( *((?:\([^)]*\)|[^() ])*) *"?([^)"]*)?"?\)/,
    Sn = [_, d, p, b, $, S, A, B, mn, yn, gn, hn],
    $n = [].concat(Sn, [/^[^\n]+(?:  \n|\n{2,})/, z, E]);
  function zn(n) {
    return n.replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, "a").replace(/[çÇ]/g, "c").replace(/[ðÐ]/g, "d").replace(/[ÈÉÊËéèêë]/g, "e").replace(/[ÏïÎîÍíÌì]/g, "i").replace(/[Ññ]/g, "n").replace(/[øØœŒÕõÔôÓóÒò]/g, "o").replace(/[ÜüÛûÚúÙù]/g, "u").replace(/[ŸÿÝý]/g, "y").replace(/[^a-z0-9- ]/gi, "").replace(/ /gi, "-").toLowerCase();
  }
  function wn(n) {
    return V.test(n) ? "right" : q.test(n) ? "center" : U.test(n) ? "left" : null;
  }
  function An(n, r, t) {
    var e = t.k;
    t.k = !0;
    var o = r(n.trim(), t);
    t.k = e;
    var u = [[]];
    return o.forEach(function (n, r) {
      "tableSeparator" === n.type ? 0 !== r && r !== o.length - 1 && u.push([]) : ("text" !== n.type || null != o[r + 1] && "tableSeparator" !== o[r + 1].type || (n.S = n.S.replace(G, "")), u[u.length - 1].push(n));
    }), u;
  }
  function Hn(n, r, t) {
    t.u = !0;
    var e = An(n[1], r, t),
      o = n[2].replace(Z, "").split("|").map(wn),
      u = function (n, r, t) {
        return n.trim().split("\n").map(function (n) {
          return An(n, r, t);
        });
      }(n[3], r, t);
    return t.u = !1, {
      $: o,
      A: u,
      H: e,
      type: "table"
    };
  }
  function En(n, r) {
    return null == n.$[r] ? {} : {
      textAlign: n.$[r]
    };
  }
  function Ln(n) {
    return function (r, t) {
      return t.u ? n.exec(r) : null;
    };
  }
  function Mn(n) {
    return function (r, t) {
      return t.u || t.i ? n.exec(r) : null;
    };
  }
  function On(n) {
    return function (r, t) {
      return t.u || t.i ? null : n.exec(r);
    };
  }
  function In(n) {
    return function (r) {
      return n.exec(r);
    };
  }
  function jn(n, r, t) {
    if (r.u || r.i) return null;
    if (t && !t.endsWith("\n")) return null;
    var e = "";
    n.split("\n").every(function (n) {
      return !Sn.some(function (r) {
        return r.test(n);
      }) && (e += n + "\n", n.trim());
    });
    var o = e.trimEnd();
    return "" == o ? null : [e, o];
  }
  function Bn(n) {
    try {
      if (decodeURIComponent(n).replace(/[^A-Za-z0-9/:]/g, "").match(/^\s*(javascript|vbscript|data(?!:image)):/i)) return;
    } catch (n) {
      return null;
    }
    return n;
  }
  function Rn(n) {
    return n.replace(tn, "$1");
  }
  function Tn(n, r, t) {
    var e = t.u || !1,
      o = t.i || !1;
    t.u = !0, t.i = !0;
    var u = n(r, t);
    return t.u = e, t.i = o, u;
  }
  function Cn(n, r, t) {
    var e = t.u || !1,
      o = t.i || !1;
    t.u = !1, t.i = !0;
    var u = n(r, t);
    return t.u = e, t.i = o, u;
  }
  function Dn(n, r, t) {
    return t.u = !1, n(r, t);
  }
  var Fn,
    Nn = function Nn(n, r, t) {
      return {
        S: Tn(r, n[1], t)
      };
    };
  function Pn() {
    return {};
  }
  function Zn() {
    return null;
  }
  function Gn() {
    return [].slice.call(arguments).filter(Boolean).join(" ");
  }
  function qn(n, r, t) {
    for (var e = n, o = r.split("."); o.length && void 0 !== (e = e[o[0]]);) o.shift();
    return e || t;
  }
  function Un(n, r) {
    var t = qn(r, n);
    return t ? "function" == typeof t || "object" == typeof t && "render" in t ? t : qn(r, n + ".component", n) : n;
  }
  function Vn(t, i) {
    void 0 === i && (i = {}), i.overrides = i.overrides || {}, i.slugify = i.slugify || zn, i.namedCodesToUnicode = i.namedCodesToUnicode ? r({}, o, i.namedCodesToUnicode) : o;
    var Z = i.createElement || React__namespace.createElement;
    function G(n, t) {
      var e = qn(i.overrides, n + ".props", {});
      return Z.apply(void 0, [Un(n, i.overrides), r({}, t, e, {
        className: Gn(null == t ? void 0 : t.className, e.className) || void 0
      })].concat([].slice.call(arguments, 2)));
    }
    function q(r) {
      var t = !1;
      i.forceInline ? t = !0 : i.forceBlock || (t = !1 === F.test(r));
      for (var e = an(un(t ? r : r.trimEnd().replace(nn, "") + "\n\n", {
        u: t
      })); "string" == typeof e[e.length - 1] && !e[e.length - 1].trim();) e.pop();
      if (null === i.wrapper) return e;
      var o,
        u = i.wrapper || (t ? "span" : "div");
      if (e.length > 1 || i.forceWrapper) o = e;else {
        if (1 === e.length) return "string" == typeof (o = e[0]) ? G("span", {
          key: "outer"
        }, o) : o;
        o = null;
      }
      return React__namespace.createElement(u, {
        key: "outer"
      }, o);
    }
    function U(r) {
      var t = r.match(a);
      return t ? t.reduce(function (r, t, o) {
        var u = t.indexOf("=");
        if (-1 !== u) {
          var a = function (n) {
              return -1 !== n.indexOf("-") && null === n.match(H) && (n = n.replace(j, function (n, r) {
                return r.toUpperCase();
              })), n;
            }(t.slice(0, u)).trim(),
            c = function (n) {
              var r = n[0];
              return ('"' === r || "'" === r) && n.length >= 2 && n[n.length - 1] === r ? n.slice(1, -1) : n;
            }(t.slice(u + 1).trim()),
            i = e[a] || a,
            _ = r[i] = function (n, r) {
              return "style" === n ? r.split(/;\s?/).reduce(function (n, r) {
                var t = r.slice(0, r.indexOf(":"));
                return n[t.replace(/(-[a-z])/g, function (n) {
                  return n[1].toUpperCase();
                })] = r.slice(t.length + 1).trim(), n;
              }, {}) : "href" === n ? Bn(r) : (r.match(L) && (r = r.slice(1, r.length - 1)), "true" === r || "false" !== r && r);
            }(a, c);
          "string" == typeof _ && (z.test(_) || E.test(_)) && (r[i] = React__namespace.cloneElement(q(_.trim()), {
            key: o
          }));
        } else "style" !== t && (r[e[t] || t] = !0);
        return r;
      }, {}) : null;
    }
    var V = [],
      tn = {},
      en = {
        blockQuote: {
          t: On(_),
          _: Fn.HIGH,
          l: function l(n, r, t) {
            return {
              S: r(n[0].replace(f, ""), t)
            };
          },
          v: function v(n, r, t) {
            return G("blockquote", {
              key: t.h
            }, r(n.S, t));
          }
        },
        breakLine: {
          t: In(l),
          _: Fn.HIGH,
          l: Pn,
          v: function v(n, r, t) {
            return G("br", {
              key: t.h
            });
          }
        },
        breakThematic: {
          t: On(s),
          _: Fn.HIGH,
          l: Pn,
          v: function v(n, r, t) {
            return G("hr", {
              key: t.h
            });
          }
        },
        codeBlock: {
          t: On(p),
          _: Fn.MAX,
          l: function l(n) {
            return {
              S: n[0].replace(/^ {4}/gm, "").replace(/\n+$/, ""),
              L: void 0
            };
          },
          v: function v(n, t, e) {
            return console.log("AHHHHHHHH"), "latex" === n.L ? G("div", {
              key: e.h
            }, n.S) : G("pre", {
              key: e.h
            }, G("code", r({}, n.M, {
              className: n.L ? "lang-" + n.L : ""
            }), n.S));
          }
        },
        codeFenced: {
          t: On(d),
          _: Fn.MAX,
          l: function l(n) {
            return console.log(n), {
              M: U(n[3] || ""),
              S: n[4],
              L: n[2] || void 0,
              type: "codeBlock"
            };
          }
        },
        codeInline: {
          t: Mn(m),
          _: Fn.LOW,
          l: function l(n) {
            return {
              S: n[2]
            };
          },
          v: function v(n, r, t) {
            return G("code", {
              key: t.h
            }, n.S);
          }
        },
        footnote: {
          t: On(y),
          _: Fn.MAX,
          l: function l(n) {
            return V.push({
              O: n[2],
              I: n[1]
            }), {};
          },
          v: Zn
        },
        footnoteReference: {
          t: Ln(h),
          _: Fn.HIGH,
          l: function l(n) {
            return {
              S: n[1],
              j: "#" + i.slugify(n[1])
            };
          },
          v: function v(n, r, t) {
            return G("a", {
              key: t.h,
              href: Bn(n.j)
            }, G("sup", {
              key: t.h
            }, n.S));
          }
        },
        gfmTask: {
          t: Ln(x),
          _: Fn.HIGH,
          l: function l(n) {
            return {
              B: "x" === n[1].toLowerCase()
            };
          },
          v: function v(n, r, t) {
            return G("input", {
              checked: n.B,
              key: t.h,
              readOnly: !0,
              type: "checkbox"
            });
          }
        },
        heading: {
          t: On(i.enforceAtxHeadings ? S : b),
          _: Fn.HIGH,
          l: function l(n, r, t) {
            return {
              S: Tn(r, n[2], t),
              R: i.slugify(n[2]),
              T: n[1].length
            };
          },
          v: function v(n, r, t) {
            return G("h" + n.T, {
              id: n.R,
              key: t.h
            }, r(n.S, t));
          }
        },
        headingSetext: {
          t: On($),
          _: Fn.MAX,
          l: function l(n, r, t) {
            return {
              S: Tn(r, n[1], t),
              T: "=" === n[2] ? 1 : 2,
              type: "heading"
            };
          }
        },
        htmlComment: {
          t: In(A),
          _: Fn.HIGH,
          l: function l() {
            return {};
          },
          v: Zn
        },
        image: {
          t: Mn(bn),
          _: Fn.HIGH,
          l: function l(n) {
            return {
              C: n[1],
              j: Rn(n[2]),
              D: n[3]
            };
          },
          v: function v(n, r, t) {
            return G("img", {
              key: t.h,
              alt: n.C || void 0,
              title: n.D || void 0,
              src: Bn(n.j)
            });
          }
        },
        link: {
          t: Ln(xn),
          _: Fn.LOW,
          l: function l(n, r, t) {
            return {
              S: Cn(r, n[1], t),
              j: Rn(n[2]),
              D: n[3]
            };
          },
          v: function v(n, r, t) {
            return G("a", {
              key: t.h,
              href: Bn(n.j),
              title: n.D
            }, r(n.S, t));
          }
        },
        linkAngleBraceStyleDetector: {
          t: Ln(I),
          _: Fn.MAX,
          l: function l(n) {
            return {
              S: [{
                S: n[1],
                type: "text"
              }],
              j: n[1],
              type: "link"
            };
          }
        },
        linkBareUrlDetector: {
          t: function t(n, r) {
            return r.F ? null : Ln(M)(n, r);
          },
          _: Fn.MAX,
          l: function l(n) {
            return {
              S: [{
                S: n[1],
                type: "text"
              }],
              j: n[1],
              D: void 0,
              type: "link"
            };
          }
        },
        linkMailtoDetector: {
          t: Ln(O),
          _: Fn.MAX,
          l: function l(n) {
            var r = n[1],
              t = n[1];
            return c.test(t) || (t = "mailto:" + t), {
              S: [{
                S: r.replace("mailto:", ""),
                type: "text"
              }],
              j: t,
              type: "link"
            };
          }
        },
        orderedList: kn(G, 1),
        unorderedList: kn(G, 2),
        newlineCoalescer: {
          t: On(g),
          _: Fn.LOW,
          l: Pn,
          v: function v() {
            return "\n";
          }
        },
        paragraph: {
          t: jn,
          _: Fn.LOW,
          l: Nn,
          v: function v(n, r, t) {
            return G("p", {
              key: t.h
            }, r(n.S, t));
          }
        },
        ref: {
          t: Ln(R),
          _: Fn.MAX,
          l: function l(n) {
            return tn[n[1]] = {
              j: n[2],
              D: n[4]
            }, {};
          },
          v: Zn
        },
        refImage: {
          t: Mn(T),
          _: Fn.MAX,
          l: function l(n) {
            return {
              C: n[1] || void 0,
              N: n[2]
            };
          },
          v: function v(n, r, t) {
            return G("img", {
              key: t.h,
              alt: n.C,
              src: Bn(tn[n.N].j),
              title: tn[n.N].D
            });
          }
        },
        refLink: {
          t: Ln(C),
          _: Fn.MAX,
          l: function l(n, r, t) {
            return {
              S: r(n[1], t),
              P: r(n[0].replace(D, "\\$1"), t),
              N: n[2]
            };
          },
          v: function v(n, r, t) {
            return tn[n.N] ? G("a", {
              key: t.h,
              href: Bn(tn[n.N].j),
              title: tn[n.N].D
            }, r(n.S, t)) : G("span", {
              key: t.h
            }, r(n.P, t));
          }
        },
        table: {
          t: On(B),
          _: Fn.HIGH,
          l: Hn,
          v: function v(n, r, t) {
            return G("table", {
              key: t.h
            }, G("thead", null, G("tr", null, n.H.map(function (e, o) {
              return G("th", {
                key: o,
                style: En(n, o)
              }, r(e, t));
            }))), G("tbody", null, n.A.map(function (e, o) {
              return G("tr", {
                key: o
              }, e.map(function (e, o) {
                return G("td", {
                  key: o,
                  style: En(n, o)
                }, r(e, t));
              }));
            })));
          }
        },
        tableSeparator: {
          t: function t(n, r) {
            return r.k ? (r.u = !0, P.exec(n)) : null;
          },
          _: Fn.HIGH,
          l: function l() {
            return {
              type: "tableSeparator"
            };
          },
          v: function v() {
            return " | ";
          }
        },
        text: {
          t: In(Y),
          _: Fn.MIN,
          l: function l(n) {
            return {
              S: n[0].replace(w, function (n, r) {
                return i.namedCodesToUnicode[r] ? i.namedCodesToUnicode[r] : n;
              })
            };
          },
          v: function v(n) {
            return n.S;
          }
        },
        textBolded: {
          t: Mn(W),
          _: Fn.MED,
          l: function l(n, r, t) {
            return {
              S: r(n[2], t)
            };
          },
          v: function v(n, r, t) {
            return G("strong", {
              key: t.h
            }, r(n.S, t));
          }
        },
        textEmphasized: {
          t: Mn(Q),
          _: Fn.LOW,
          l: function l(n, r, t) {
            return {
              S: r(n[2], t)
            };
          },
          v: function v(n, r, t) {
            return G("em", {
              key: t.h
            }, r(n.S, t));
          }
        },
        textEscaped: {
          t: Mn(K),
          _: Fn.HIGH,
          l: function l(n) {
            return {
              S: n[1],
              type: "text"
            };
          }
        },
        textMarked: {
          t: Mn(X),
          _: Fn.LOW,
          l: Nn,
          v: function v(n, r, t) {
            return G("mark", {
              key: t.h
            }, r(n.S, t));
          }
        },
        textStrikethroughed: {
          t: Mn(J),
          _: Fn.LOW,
          l: Nn,
          v: function v(n, r, t) {
            return G("del", {
              key: t.h
            }, r(n.S, t));
          }
        }
      };
    !0 !== i.disableParsingRawHTML && (en.htmlBlock = {
      t: In(z),
      _: Fn.HIGH,
      l: function l(n, r, t) {
        var e,
          o = n[3].match(rn),
          a = new RegExp("^" + o[1], "gm"),
          c = n[3].replace(a, ""),
          i = (e = c, $n.some(function (n) {
            return n.test(e);
          }) ? Dn : Tn),
          _ = n[1].toLowerCase(),
          f = -1 !== u.indexOf(_);
        t.F = t.F || "a" === _;
        var l = f ? n[3] : i(r, c, t);
        return t.F = !1, {
          M: U(n[2]),
          S: l,
          Z: f,
          G: f ? _ : n[1]
        };
      },
      v: function v(n, t, e) {
        return G(n.G, r({
          key: e.h
        }, n.M), n.Z ? n.S : t(n.S, e));
      }
    }, en.htmlSelfClosing = {
      t: In(E),
      _: Fn.HIGH,
      l: function l(n) {
        return {
          M: U(n[2] || ""),
          G: n[1]
        };
      },
      v: function v(n, t, e) {
        return G(n.G, r({}, n.M, {
          key: e.h
        }));
      }
    });
    var on,
      un = function (n) {
        var r = Object.keys(n);
        function t(e, o) {
          for (var u = [], a = ""; e;) for (var c = 0; c < r.length;) {
            var i = r[c],
              _ = n[i],
              f = _.t(e, o, a);
            if (f) {
              var l = f[0];
              e = e.substring(l.length);
              var s = _.l(f, t, o);
              null == s.type && (s.type = i), u.push(s), a = l;
              break;
            }
            c++;
          }
          return u;
        }
        return r.sort(function (r, t) {
          var e = n[r]._,
            o = n[t]._;
          return e !== o ? e - o : r < t ? -1 : 1;
        }), function (n, r) {
          return t(function (n) {
            return n.replace(v, "\n").replace(k, "").replace(N, "    ");
          }(n), r);
        };
      }(en),
      an = (on = function (n) {
        return function (r, t, e) {
          return n[r.type].v(r, t, e);
        };
      }(en), function n(r, t) {
        if (void 0 === t && (t = {}), Array.isArray(r)) {
          for (var e = t.h, o = [], u = !1, a = 0; a < r.length; a++) {
            t.h = a;
            var c = n(r[a], t),
              i = "string" == typeof c;
            i && u ? o[o.length - 1] += c : null !== c && o.push(c), u = i;
          }
          return t.h = e, o;
        }
        return on(r, n, t);
      }),
      cn = q(t);
    return V.length ? G("div", null, cn, G("footer", {
      key: "footer"
    }, V.map(function (n) {
      return G("div", {
        id: i.slugify(n.I),
        key: n.I
      }, n.I, an(un(n.O, {
        u: !0
      })));
    }))) : cn;
  }
  !function (n) {
    n[n.MAX = 0] = "MAX", n[n.HIGH = 1] = "HIGH", n[n.MED = 2] = "MED", n[n.LOW = 3] = "LOW", n[n.MIN = 4] = "MIN";
  }(Fn || (Fn = {}));
  function Markdown (r) {
    var e = r.children,
      o = r.options,
      u = function (n, r) {
        if (null == n) return {};
        var t,
          e,
          o = {},
          u = Object.keys(n);
        for (e = 0; e < u.length; e++) r.indexOf(t = u[e]) >= 0 || (o[t] = n[t]);
        return o;
      }(r, t);
    return React__namespace.cloneElement(Vn(e, o), u);
  }

  var _templateObject, _templateObject2, _templateObject3, _templateObject4, _templateObject5, _templateObject6, _templateObject7, _templateObject8, _templateObject9;
  function TryItLive() {
    var _React$useState = React__namespace.useState(document.getElementById('sample-content').textContent.trim()),
      markdown = _React$useState[0],
      setMarkdown = _React$useState[1];
    var handleInput = React__namespace.useCallback(function (e) {
      return setMarkdown(e.target.value);
    }, []);
    return /*#__PURE__*/React__namespace.createElement("main", null, /*#__PURE__*/React__namespace.createElement(GlobalStyles, null), /*#__PURE__*/React__namespace.createElement(Header, null, /*#__PURE__*/React__namespace.createElement("a", {
      target: "_blank",
      href: "https://github.com/probablyup/markdown-to-jsx",
      title: "Check out the markdown-to-jsx source code",
      rel: "noopener noreferrer"
    }, /*#__PURE__*/React__namespace.createElement("img", {
      src: "./images/logo.svg",
      alt: "markdown-to-jsx logo"
    })), /*#__PURE__*/React__namespace.createElement(Description, null, /*#__PURE__*/React__namespace.createElement("h1", null, /*#__PURE__*/React__namespace.createElement("code", null, "markdown-to-jsx"), " is an easy-to-use markdown component that takes Github-flavored Markdown (GFM) and makes native JSX without dangerous hacks.\xA0"), /*#__PURE__*/React__namespace.createElement("h2", null, "It's lightweight, customizable, and happily supports React-like libraries.")), /*#__PURE__*/React__namespace.createElement(LearnMore, null, "See the", ' ', /*#__PURE__*/React__namespace.createElement("a", {
      target: "_blank",
      href: "https://github.com/probablyup/markdown-to-jsx/blob/main/README.md",
      rel: "noopener noreferrer"
    }, "project README"), ' ', "for detailed installation & usage instructions.")), /*#__PURE__*/React__namespace.createElement(Demo, null, /*#__PURE__*/React__namespace.createElement(Textarea, {
      onInput: handleInput,
      value: markdown
    }), /*#__PURE__*/React__namespace.createElement(Compiled, null, /*#__PURE__*/React__namespace.createElement(Markdown, {
      options: options
    }, markdown))));
  }
  var COLOR_ACCENT = 'rgba(255, 255, 255, 0.5)';
  var COLOR_BODY = '#fefefe';
  var GlobalStyles = styled.createGlobalStyle(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n\t*,\n\t*::before,\n\t*::after {\n\t\tbox-sizing: border-box;\n\t\toutline-color: ", ";\n\t}\n\n\thtml,\n\tbody,\n\t#root,\n\tmain {\n\t\tmargin: 0;\n\t\tmin-height: 100vh;\n\t}\n\n\thtml {\n\t\tbackground: #222;\n\t\tcolor: ", ";\n\t\tfont-family: 'Source Sans Pro', Helvetica Neue, Helvetica, sans-serif;\n\t\tfont-size: 14px;\n\t\tline-height: 1.5;\n\t}\n\n\th1,\n\th2,\n\th3,\n\th4,\n\th5,\n\th6 {\n\t\tmargin: 0 0 1rem;\n\t}\n\n\th1 {\n\t\tfont-size: 2rem;\n\t}\n\n\th2 {\n\t\tfont-size: 1.8rem;\n\t}\n\n\th3 {\n\t\tfont-size: 1.6rem;\n\t}\n\n\th4 {\n\t\tfont-size: 1.4rem;\n\t}\n\n\th5 {\n\t\tfont-size: 1.2rem;\n\t}\n\n\th6 {\n\t\tfont-size: 1rem;\n\t}\n\n\ta {\n\t\tcolor: ", ";\n\t\ttransition: color 200ms ease;\n\n\t\t&:hover,\n\t\t&:focus {\n\t\t\tcolor: ", ";\n\t\t}\n\t}\n\n\tcode {\n\t\tbackground: ", ";\n\t\tdisplay: inline-block;\n\t\tpadding: 0 2px;\n\t}\n\n\tpre code {\n\t\tbackground: transparent;\n\t\tborder: 0;\n\t\tdisplay: block;\n\t\tpadding: 1em;\n\t}\n\n\tmain {\n\t\tdisplay: flex;\n\t\tflex-direction: column;\n\t\tpadding: 3rem 1.5rem 0;\n\t\tmargin: 0;\n\n\t\t@media all and (min-width: 1024px) {\n\t\t\tpadding: 3rem;\n\t\t}\n\t}\n"])), COLOR_ACCENT, COLOR_BODY, COLOR_ACCENT, rgba(COLOR_ACCENT, 0.75), rgba(COLOR_ACCENT, 0.05));
  var Header = styled__default['default'].header(_templateObject2 || (_templateObject2 = _taggedTemplateLiteralLoose(["\n  flex-shrink: 0;\n  margin-bottom: 2em;\n  text-align: center;\n\n  img {\n    height: 100px;\n  }\n"])));
  var Description = styled__default['default'].p(_templateObject3 || (_templateObject3 = _taggedTemplateLiteralLoose(["\n  font-size: 18px;\n  margin-left: auto;\n  margin-right: auto;\n  max-width: 60vw;\n\n  h1,\n  h2 {\n    font: inherit;\n  }\n\n  @media all and (max-width: 500px) {\n    max-width: none;\n  }\n\n  @media all and (max-width: 1023px) {\n    h1,\n    h2 {\n      display: block;\n      margin-bottom: 1.5rem;\n    }\n  }\n"])));
  var LearnMore = styled__default['default'].p(_templateObject4 || (_templateObject4 = _taggedTemplateLiteralLoose(["\n  color: ", ";\n"])), curriedLighten$1(0.2, COLOR_BODY));
  var sharedCss = styled.css(_templateObject5 || (_templateObject5 = _taggedTemplateLiteralLoose(["\n  flex: 0 0 50%;\n  padding: 1em;\n"])));
  var Demo = styled__default['default'].section(_templateObject6 || (_templateObject6 = _taggedTemplateLiteralLoose(["\n  display: flex;\n  flex-grow: 1;\n  margin-left: -1.5rem;\n  margin-right: -1.5rem;\n\n  @media all and (min-width: 1024px) {\n    margin-left: 0;\n    margin-right: 0;\n  }\n\n  @media all and (max-width: 500px) {\n    flex-direction: column;\n  }\n"])));
  var Textarea = styled__default['default'].textarea(_templateObject7 || (_templateObject7 = _taggedTemplateLiteralLoose(["\n  ", ";\n  background: ", ";\n  border: 0;\n  color: inherit;\n  position: sticky;\n  top: 0;\n  font-family: 'Source Code Pro', Consolas, Monaco, monospace;\n  font-size: inherit;\n  max-height: 100vh;\n\n  @media all and (max-width: 500px) {\n    height: 300px;\n    position: relative;\n  }\n"])), sharedCss, rgba(COLOR_ACCENT, 0.05));
  var Compiled = styled__default['default'].div(_templateObject8 || (_templateObject8 = _taggedTemplateLiteralLoose(["\n  ", ";\n  padding-left: 2rem;\n  padding-right: 1rem;\n  overflow: auto;\n  overflow-x: hidden;\n"])), sharedCss);
  var ShinyButton = styled__default['default'].button(_templateObject9 || (_templateObject9 = _taggedTemplateLiteralLoose(["\n  background: #444;\n  color: #ddd;\n  cursor: pointer;\n  font: inherit;\n  transition: background 200ms ease;\n\n  &:hover,\n  &:focus {\n    background: #222;\n  }\n\n  &:active {\n    background: #000;\n  }\n"])));
  function MyComponent(props) {
    return /*#__PURE__*/React__namespace.createElement(ShinyButton, _extends$1({}, props, {
      onClick: function onClick() {
        alert("Look ma, I'm a real component!");
      }
    }));
  }
  var options = {
    overrides: {
      MyComponent: {
        component: MyComponent
      }
    }
  };
  ReactDOM__namespace.render( /*#__PURE__*/React__namespace.createElement(TryItLive, null), document.getElementById('root'));

}(React, ReactDOM, styled));
//# sourceMappingURL=markdown-to-jsx.js.map
