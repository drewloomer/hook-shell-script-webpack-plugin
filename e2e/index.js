import test from 'ava';
import webpack from 'webpack';
import HookShellScriptPlugin from '../';
import { resolve, join } from 'path';
import { remove } from 'fs-extra';

const outputPath = resolve(__dirname, '../.tmp');

function build(config) {
  return new Promise((resolve, reject) =>
    webpack(config, (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(err || stats.toJson('errors-only').errors);
        return;
      }
      resolve(`${config.output.path}/${config.output.filename}`);
    })
  );
}

function createConfig(pluginConfig) {
  return {
    entry: resolve(__dirname, './entry.js'),
    mode: 'production',
    output: {
      path: outputPath,
      filename: `tmp.js`
    },
    plugins: [new HookShellScriptPlugin(pluginConfig)]
  };
}

test(`it runs a shell script in a file`, async ({ truthy }) => {
  return build(createConfig({ beforeRun: ['sh ./e2e/test.sh'] }))
    .then(() => {
      const testJson = require('../.tmp/test.json');
      const testModule = require(join(outputPath, 'tmp.js'));
      truthy(testJson.test);
      truthy(testModule);
    })
    .catch(e => {
      console.error(e);
    });
});

test.after.always('cleanup dist folder', () => remove(outputPath));
