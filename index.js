const { spawn } = require('child_process');
const NAME = 'HookShellScriptPlugin';

class HookShellScriptPlugin {
  /**
   * Add hooks and scripts to run on each hook.
   * @param {{[hookName: string]: Array<string | {command: string, args: string[]}>}} hooks
   */
  constructor(hooks) {
    this.procs = {};
    this.hooks = hooks || {};
  }

  /**
   * Add callbacks for each hook. If a hook doesn't exist on the compiler, throw an error.
   */
  apply(compiler) {
    this.watch = compiler.options.watch;
    Object.keys(this.hooks).forEach(hookName => {
      if (!compiler.hooks[hookName]) {
        this.handleError(`The hook ${hookName} does not exist on the Webpack compiler.`);
      }
      compiler.hooks[hookName].tap(NAME, () => {
        this.hooks[hookName].forEach(s => this.handleScript(s));
      });
    });
  }

  /**
   * Parse a given script into a command and arguments
   * @param {string | {command: string, args: string[]}} script
   */
  parseScript(script) {
    if (typeof script === 'string') {
      const [command, ...args] = script.split(' ');
      return { command, args };
    }
    const { command, args } = script;
    return { command, args };
  }

  /**
   * Run a script, cancelling an already running iteration of that script.
   * @param {string | {command: string, args: string[]}} script
   */
  handleScript(script) {
    const key = typeof script === 'string' ? script : JSON.stringify(script);
    if (this.procs[key]) this.killProc(key);
    this.log(`Running script: ${key}\n`);
    const { command, args } = this.parseScript(script);
    this.procs[key] = spawn(command, args, { stdio: 'pipe' });
    this.procs[key].on('error', this.onScriptError.bind(this, key));
    this.procs[key].stderr.on('data', this.onScriptError.bind(this, key));
    this.procs[key].on('exit', this.onScriptComplete.bind(this, key));
  }

  /**
   * Kill a running process.
   * @param {string} key
   */
  killProc(key) {
    this.procs[key].kill();
  }

  /**
   * Handle an error by killing the build if not in watch mode.
   * @param {string} msg
   */
  handleError(msg) {
    msg = `\n[${NAME}] ${msg}\n`;
    if (!this.watch) {
      throw new Error(msg);
    }
    console.error(msg);
  }

  /**
   * Log a message to the console.
   * @param {string} msg
   */
  log(msg) {
    const msg = `\n[${NAME}] ${msg}\n`;
    console.log(msg);
  }

  /**
   * When the script has completed, log a success if there was no error while running it.
   * @param {string} key
   * @param {number} error
   * @param {string} msg
   */
  onScriptComplete(key, error, msg) {
    this.procs[key] = null;
    if (msg === 'SIGTERM' || msg === 'SIGINT') {
      this.log(`Killing script: ${key}\n`);
    } else if (!error) {
      this.log(`Completed script: ${key}\n`);
    }
  }

  /**
   * When a script has errored out, log or throw the error.
   * @param {string} script
   * @param {string} error
   */
  onScriptError(script, error) {
    this.handleError(`Error while running \`${script}\`: ${error}`);
  }
}

module.exports = HookShellScriptPlugin;
