# Shell Script Webpack Plugin [![Build Status](https://travis-ci.org/drewloomer/hook-shell-script-webpack-plugin.svg?branch=master)](http://travis-ci.org/drewloomer/hook-shell-script-webpack-plugin)

This is a [webpack](https://webpack.github.io) plugin for running arbitrary shell scripts when [webpack compiler hooks](https://webpack.js.org/api/compiler-hooks/) are triggered.

## Installation

Install the plugin with npm:

```sh
$ npm install hook-shell-script-webpack-plugin --save-dev
$ yarn --dev hook-shell-script-webpack-plugin
```

## Usage

```js
// webpack.config.js
const webpack = require('webpack');
const HookShellScriptPlugin = require('hook-shell-script-webpack-plugin');

module.exports = {
  // ...
  plugins: [
    new HookShellScriptPlugin({
      afterEmit: ['npx tsc --emitDeclarationOnly']
      // ...
    })
  ]
};
```

## Thanks

Big thanks to [webpack-hook-plugin](https://github.com/tienne/webpack-hook-plugin) for the inspiration.

## License

The MIT License

Copyright :copyright: 2019 Drew Loomer, https://drewloomer.com
