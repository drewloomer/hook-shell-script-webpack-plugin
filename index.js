const { spawn } = require('child_process');
const NAME = 'HookShellScriptPlugin';

class HookShellScriptPlugin {
  /**
   * Add hooks and scripts to run on each hook.
   * @param {{[hookName: string]: Array<string | {command: string, args: string[]}>}} hooks
   */
  constructor(hooks) {
    this._procs = {};
    this._hooks = hooks || {};
  }

  /**
   * Add callbacks for each hook. If a hook doesn't exist on the compiler, throw an error.
   */
  apply(compiler) {
    this.watch = compiler.options.watch;
    Object.keys(this._hooks).forEach(hookName => {
      if (!compiler.hooks[hookName]) {
        this._handleError(`The hook ${hookName} does not exist on the Webpack compiler.`);
      }
      compiler.hooks[hookName].tap(NAME, () => {
        this._hooks[hookName].forEach(s => this._handleScript(s));
      });
    });
  }

  /**
   * Parse a given script into a command and arguments
   * @param {string | {command: string, args: string[]}} script
   */
  _parseScript(script) {
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
  _handleScript(script) {
    const key = typeof script === 'string' ? script : JSON.stringify(script);
    if (this._procs[key]) this._killProc(key);
    this._log(`Running script: ${key}\n`);
    const { command, args } = this._parseScript(script);
    this._procs[key] = spawn(command, args, { stdio: 'pipe' });
    this._procs[key].on('error', this._onScriptError.bind(this, key));
    this._procs[key].stderr.on('data', this._onScriptError.bind(this, key));
    this._procs[key].on('exit', this._onScriptComplete.bind(this, key));
  }

  /**
   * Kill a running process.
   * @param {string} key
   */
  _killProc(key) {
    this._procs[key].kill();
  }

  /**
   * Handle an error by killing the build if not in watch mode.
   * @param {string} msg
   */
  _handleError(msg) {
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
  _log(msg) {
    msg = `\n[${NAME}] ${msg}\n`;
    console.log(msg);
  }

  /**
   * When the script has completed, log a success if there was no error while running it.
   * @param {string} key
   * @param {number} error
   * @param {string} msg
   */
  _onScriptComplete(key, error, msg) {
    this._procs[key] = null;
    if (msg === 'SIGTERM' || msg === 'SIGINT') {
      this._log(`Killing script: ${key}\n`);
    } else if (!error) {
      this._log(`Completed script: ${key}\n`);
    }
  }

  /**
   * When a script has errored out, log or throw the error.
   * @param {string} script
   * @param {string} error
   */
  _onScriptError(script, error) {
    this._handleError(`Error while running \`${script}\`: ${error}`);
  }
}

module.exports = HookShellScriptPlugin;
