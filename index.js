const { spawn } = require('child_process');
const NAME = 'HookShellScriptPlugin';

class HookShellScriptPlugin {
  /**
   * Add hooks and scripts to run on each hook.
   * @param {{[hookName: string]: Array<string | {command: string, args: string[]} | (...params: any[]) => {command: string, args: string[]}>}} hooks
   */
  constructor(hooks = {}) {
    this._procs = {};
    this._hooks = hooks;
  }

  /**
   * Add callbacks for each hook. If a hook doesn't exist on the compiler, throw an error.
   */
  apply(compiler) {
    this.watch = compiler.options.watch;
    this.logger = compiler.getInfrastructureLogger(NAME);
    Object.keys(this._hooks).forEach(hookName => {
      if (!compiler.hooks[hookName]) {
        this._handleError(`The hook ${hookName} does not exist on the Webpack compiler.`);
      }
      compiler.hooks[hookName].tap(NAME, (...args) => {
        this._hooks[hookName].forEach(s => this._handleScript(s, args));
      });
    });
  }

  /**
   * Parse a given script into a command and arguments
   * @param {string | {command: string, args: string[]} | (...params: any[]) => {command: string, args: string[]}} script
   * @param {any[]} params
   * @returns {{command: string, args: string[]}}
   */
  _parseScript(script, params) {
    switch (typeof script) {
      case 'string': {
        const [command, ...args] = script.split(' ');
        return { command, args };
      }
      case 'function':
        return this._parseScript(script(...params));
      case 'object':
        return script;
      default:
        return null;
    }
  }

  /**
   * Run a script, cancelling an already running iteration of that script.
   * @param {string | {command: string, args: string[]} | (...params: any[]) => {command: string, args: string[]} script
   * @param {any[]} params
   */
  _handleScript(script, params) {
    const { command, args = [] } = this._parseScript(script, params);
    if (!command) this._handleError(`Missing command for script ${script}`);
    const key = `${command} ${args.join(' ')}`;
    this._log(`Running script: ${key}`);
    if (this._procs[key]) this._killProc(key);
    this._procs[key] = spawn(command, args, { stdio: 'pipe', shell: true });
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
    if (!this.watch) {
      throw new Error(`[${NAME}] ${msg}`);
    }
    this.logger.error(msg);
  }

  /**
   * Log a message to the console.
   * @param {string} msg
   */
  _log(msg) {
    this.logger.info(msg);
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
      this._log(`Killing script: ${key}`);
    } else if (!error) {
      this._log(`Completed script: ${key}`);
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
