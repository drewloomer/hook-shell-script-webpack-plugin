import test from 'ava';
import HookShellScriptPlugin from '../';
import { fake, spy } from 'sinon';

const testHooks = { beforeRun: ['cat README.md'], afterCompile: ['ls', { command: 'git', args: ['status'] }] };
const mockHook = () => ({
  tap: fake((_, cb) => {
    console.log(_, cb);
    return { call: cb };
  })
});
const mockCompiler = () => ({
  options: { watch: false },
  hooks: {
    beforeRun: mockHook(),
    afterCompile: mockHook()
  }
});

test('it adds the hooks', ({ is, deepEqual }) => {
  const plugin = new HookShellScriptPlugin();
  const plugin2 = new HookShellScriptPlugin(testHooks);
  deepEqual(plugin.hooks, {});
  is(plugin2.hooks, testHooks);
});

test.cb('it blows up when a hook does not exist', ({ end, is, truthy }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  try {
    plugin.apply({ options: {}, hooks: {} });
  } catch (e) {
    truthy(e instanceof Error);
    is(e.message, '\n[HookShellScriptPlugin] The hook beforeRun does not exist on the Webpack compiler.\n');
    end();
  }
});

test.cb('it logs errors when in watch mode', ({ end, truthy }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const s = spy(console, 'error');
  try {
    plugin.apply({ options: { watch: true }, hooks: {} });
  } catch (e) {
    truthy(s.calledWith('\n[HookShellScriptPlugin] The hook beforeRun does not exist on the Webpack compiler.\n'));
    end();
  }
});

test('it applies the hooks', ({ is }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  plugin.apply(compiler);
  is(1, compiler.hooks.beforeRun.tap.callCount);
  is(1, compiler.hooks.afterCompile.tap.callCount);
});

// mock spawn and capture calls

test.todo('it kills already running scripts');
test.todo('it handles errors when running a script');
