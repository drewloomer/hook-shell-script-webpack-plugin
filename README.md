# Shell Script Webpack Plugin [![Build Status](https://travis-ci.org/drewloomer/hook-shell-script-webpack-plugin.svg?branch=master)](http://travis-ci.org/drewloomer/hook-shell-script-webpack-plugin)

This is a [webpack](https://webpack.github.io) plugin for running arbitrary shell scripts when [webpack compiler hooks](https://webpack.js.org/api/compiler-hooks/) are triggered.

## Installation

Install the plugin with npm:

```sh
$ npm install --save-dev hook-shell-script-webpack-plugin
$ yarn add --dev hook-shell-script-webpack-plugin
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
      // run a single command
      afterEmit: ['npx tsc --emitDeclarationOnly'],
      // run multiple commands in parallel
      done: [
        // either as a string
        'command1 with args',
        // or as a command with args
        {command: 'command2', args: ['with', 'args']}
      ],
      // run a command based on the hook arguments
      assetEmitted: [
        // you can return a string
        (name, info) => `node ${info.outputPath}`
        // or an object with command and args
        (name, info) => ({command: 'node', args: [info.outputPath]})
      ],
      // return a command and argrs object
    })
  ]
};
```

## Thanks

Big thanks to [webpack-hook-plugin](https://github.com/tienne/webpack-hook-plugin) for the inspiration.

## License

The MIT License

Copyright :copyright: 2021 Drew Loomer, https://drewloomer.com
