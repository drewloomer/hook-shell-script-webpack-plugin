import test from 'ava';
import { fake, spy, stub } from 'sinon';
import proxyquire from 'proxyquire';

// Stub child_process so we can mock its calls
const spawnStub = stub();
const HookShellScriptPlugin = proxyquire('../', {
  child_process: {
    spawn: spawnStub
  }
});

// Test data
const testHooks = { beforeRun: ['cat README.md'], afterCompile: ['ls', { command: 'git', args: ['status'] }] };

// Mocks
const mockHook = (delay = 0) => ({
  taps: [],
  tap: fake(function(name, cb) {
    this.taps.push({ name, cb });
  }),
  runAll: function() {
    this.taps.map(t => setTimeout(() => t.cb(t.name), delay));
  }
});
const mockCompiler = () => ({
  options: { watch: false },
  hooks: {
    beforeRun: mockHook(),
    afterCompile: mockHook()
  }
});
const spawns = {};
const mockSpawn = cmd => ({
  on: fake((msg, cb) => {
    spawns[cmd] = spawns[cmd] || {};
    spawns[cmd][msg] = cb;
  }),
  stderr: { on: fake() },
  kill: killFake
});

const completeSpawn = (cmd, msg, ...args) => {
  spawns[cmd][msg].apply(this, args);
};

// Runs before each test to setup fake spawn, kill, console.log and console.error logic
let killFake;
const logSpy = spy(console, 'log');
const errorSpy = spy(console, 'error');
test.beforeEach(() => {
  killFake = fake();
  spawnStub.resetHistory();
  spawnStub.callsFake(mockSpawn);
  logSpy.resetHistory();
  errorSpy.resetHistory();
});

test('it creates a new instance', ({ truthy }) => {
  const plugin = new HookShellScriptPlugin();
  truthy(plugin);
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
  try {
    plugin.apply({ options: { watch: true }, hooks: {} });
  } catch (e) {
    truthy(errorSpy.calledWith('\n[HookShellScriptPlugin] The hook beforeRun does not exist on the Webpack compiler.\n'));
    end();
  }
});

test('it applies the hooks to the compiler', ({ is }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  plugin.apply(compiler);
  is(1, compiler.hooks.beforeRun.tap.callCount);
  is(1, compiler.hooks.afterCompile.tap.callCount);
});

test.serial.cb('it runs a script', ({ truthy, end }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  plugin.apply(compiler);
  compiler.hooks.beforeRun.runAll();
  compiler.hooks.afterCompile.runAll();
  setTimeout(() => {
    truthy(spawnStub.called);
    truthy(spawnStub.calledWith('cat', ['README.md']));
    truthy(spawnStub.calledWith('ls', []));
    truthy(spawnStub.calledWith('git', ['status']));
    logSpy.calledWith('\n[HookShellScriptPlugin] Running script: cat README.md\n\n');
  }, 0);

  setTimeout(() => {
    completeSpawn('cat', 'exit');
    logSpy.calledWith('\n[HookShellScriptPlugin] Completed script: cat README.md\n\n');
    end();
  }, 10);
});

test.serial.cb('it kills already running scripts with a SIGTERM', ({ truthy, end }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  compiler.hooks.beforeRun = mockHook(10);
  plugin.apply(compiler);
  compiler.hooks.beforeRun.runAll();
  setTimeout(() => {
    compiler.hooks.beforeRun.runAll();
  }, 1);
  setTimeout(() => {
    completeSpawn('cat', 'exit', 1, 'SIGTERM');
    truthy(spawnStub.called);
    truthy(killFake.called);
    logSpy.calledWith('\n[HookShellScriptPlugin] Killing script: cat README.md\n\n');
    end();
  }, 15);
});

test.serial.cb('it kills already running scripts with a SIGINT', ({ truthy, end }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  compiler.hooks.beforeRun = mockHook(10);
  plugin.apply(compiler);
  compiler.hooks.beforeRun.runAll();
  setTimeout(() => {
    compiler.hooks.beforeRun.runAll();
  }, 1);
  setTimeout(() => {
    completeSpawn('cat', 'exit', 1, 'SIGINT');
    truthy(spawnStub.called);
    truthy(killFake.called);
    logSpy.calledWith('\n[HookShellScriptPlugin] Killing script: cat README.md\n\n');
    end();
  }, 15);
});

test.serial.cb('it handles errors when running a script', ({ truthy, end }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  compiler.hooks.beforeRun = mockHook(10);
  compiler.options.watch = true;
  plugin.apply(compiler);
  compiler.hooks.beforeRun.runAll();
  setTimeout(() => {
    compiler.hooks.beforeRun.runAll();
  }, 1);
  setTimeout(() => {
    completeSpawn('cat', 'error', 'Uh oh.');
    truthy(spawnStub.called);
    logSpy.calledWith('\n[HookShellScriptPlugin] Error while running `cat README.md`: Uh oh.\n\n');
    end();
  }, 15);
});

test.serial.cb('it ignores complete error events that are not term or interupt', ({ end }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  compiler.hooks.beforeRun = mockHook(10);
  plugin.apply(compiler);
  compiler.hooks.beforeRun.runAll();
  setTimeout(() => {
    compiler.hooks.beforeRun.runAll();
  }, 1);
  setTimeout(() => {
    completeSpawn('cat', 'exit', 1, 'JUNK');
    end();
  }, 15);
});
