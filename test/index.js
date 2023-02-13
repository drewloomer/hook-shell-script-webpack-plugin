import test from 'ava';
import proxyquire from 'proxyquire';
import { assert, fake, stub } from 'sinon';

// Stub child_process so we can mock its calls
const spawnStub = stub();
const HookShellScriptPlugin = proxyquire('../', {
  child_process: {
    spawn: spawnStub
  }
});

// Test data
const testHooks = {
  beforeRun: ['cat README.md'],
  afterCompile: ['ls', { command: 'git', args: ['status'] }],
  assetEmitted: [name => `touch ${name}`]
};

// Mocks
function mockHook(ms = 0) {
  const taps = [];
  return {
    taps,
    tap: fake((name, cb) => taps.push({ name, cb })),
    async runAll(...args) {
      return Promise.all(
        taps.map(async t => {
          await delay(ms);
          t.cb(...args);
        })
      );
    }
  };
}
const mockLogger = {
  info: fake(),
  error: fake()
};
const createLogger = () => mockLogger;
const mockCompiler = (hooks = {}) => ({
  options: { watch: false },
  hooks: {
    beforeRun: mockHook(),
    afterCompile: mockHook(),
    assetEmitted: mockHook(),
    ...hooks
  },
  getInfrastructureLogger: createLogger
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

// Runs before each test to setup fake spawn, kill, and logging logic
let killFake;
test.beforeEach(() => {
  killFake = fake();
  spawnStub.resetHistory();
  spawnStub.callsFake(mockSpawn);
  mockLogger.info.resetHistory();
  mockLogger.error.resetHistory();
});

const delay = ms => new Promise(res => setTimeout(res, ms));

test('it creates a new instance', ({ truthy }) => {
  const plugin = new HookShellScriptPlugin();
  truthy(plugin);
});

test('it blows up when a hook does not exist', ({ throws }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  throws(
    () => plugin.apply({ options: {}, hooks: {}, getInfrastructureLogger: createLogger }),
    Error,
    '[HookShellScriptPlugin] The hook beforeRun does not exist on the Webpack compiler.'
  );
});

test('it logs errors when in watch mode', ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  try {
    plugin.apply({ options: { watch: true }, hooks: {}, getInfrastructureLogger: createLogger });
  } catch (e) {
    assert.calledWith(mockLogger.error, 'The hook beforeRun does not exist on the Webpack compiler.');
    pass();
  }
});

test('it applies the hooks to the compiler', ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  plugin.apply(compiler);
  assert.calledOnce(compiler.hooks.beforeRun.tap);
  assert.calledOnce(compiler.hooks.afterCompile.tap);
  assert.calledOnce(compiler.hooks.assetEmitted.tap);
  pass();
});

test.serial('it runs a script', async ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler();
  plugin.apply(compiler);

  await compiler.hooks.beforeRun.runAll();
  await compiler.hooks.afterCompile.runAll();
  await compiler.hooks.assetEmitted.runAll('filename');

  assert.callCount(spawnStub, 4);
  assert.calledWith(spawnStub, 'cat', ['README.md']);
  assert.calledWith(spawnStub, 'ls', []);
  assert.calledWith(spawnStub, 'git', ['status']);
  assert.calledWith(spawnStub, 'touch', ['filename']);
  assert.calledWith(mockLogger.info, 'Running script: cat README.md');

  await delay(10);
  completeSpawn('cat', 'exit');
  assert.calledWith(mockLogger.info, 'Completed script: cat README.md');
  pass();
});

test.serial('it kills already running scripts with a SIGTERM', async ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler({
    beforeRun: mockHook(10)
  });
  plugin.apply(compiler);

  await Promise.all([delay(0).then(compiler.hooks.beforeRun.runAll), delay(1).then(compiler.hooks.beforeRun.runAll)]);

  completeSpawn('cat', 'exit', 1, 'SIGTERM');
  assert.called(spawnStub);
  assert.called(killFake);
  assert.calledWith(mockLogger.info, 'Killing script: cat README.md');
  pass();
});

test.serial('it kills already running scripts with a SIGINT', async ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler({
    beforeRun: mockHook(10)
  });
  plugin.apply(compiler);

  await Promise.all([delay(0).then(compiler.hooks.beforeRun.runAll), delay(1).then(compiler.hooks.beforeRun.runAll)]);

  completeSpawn('cat', 'exit', 1, 'SIGINT');
  assert.called(spawnStub);
  assert.called(killFake);
  assert.calledWith(mockLogger.info, 'Killing script: cat README.md');
  pass();
});

test.serial('it handles errors when running a script', async ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler({
    beforeRun: mockHook(10)
  });
  compiler.options.watch = true;
  plugin.apply(compiler);

  await Promise.all([delay(0).then(compiler.hooks.beforeRun.runAll), delay(1).then(compiler.hooks.beforeRun.runAll)]);

  completeSpawn('cat', 'error', 'Uh oh.');
  assert.called(spawnStub);
  assert.calledWith(mockLogger.error, 'Error while running `cat README.md`: Uh oh.');
  pass();
});

test.serial('it ignores complete error events that are not term or interupt', async ({ pass }) => {
  const plugin = new HookShellScriptPlugin(testHooks);
  const compiler = mockCompiler({
    beforeRun: mockHook(10)
  });
  plugin.apply(compiler);

  await Promise.all([delay(0).then(compiler.hooks.beforeRun.runAll), delay(1).then(compiler.hooks.beforeRun.runAll)]);

  completeSpawn('cat', 'exit', 1, 'JUNK');
  pass();
});
