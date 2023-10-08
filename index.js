//@ts-check

const { spawn } = require('child_process');
const NAME = 'HookShellScriptPlugin';

/**
 * @typedef {import('webpack').Compiler} Compiler
 * @typedef {string | {command: string, args: string[]}} CommandAndArgs
 * @typedef {(...params: any[]) => CommandAndArgs} HookFunc
 * @typedef {CommandAndArgs | HookFunc} HookValueType
 */

/**
 * @typedef {Compiler["hooks"][T] extends import('tapable').Hook<infer A> ? A extends any[] ? A : any[] : any[]} Args<T>
 * @template {keyof Compiler["hooks"]} T
 */

class HookShellScriptPlugin {
  /**
   * Add hooks and scripts to run on each hook.
   * @param {Partial<{[hookName in keyof Compiler["hooks"]]: (CommandAndArgs | ((...args: Args<hookName>) => CommandAndArgs))[]}>} hooks
   */
  constructor(hooks = {}) {
    this._procs = {};
    this._hooks = hooks;
  }

  /**
   * Add callbacks for each hook. If a hook doesn't exist on the compiler, throw an error.
   * @param {Compiler} compiler
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
   * @param {HookValueType} script
   * @param {...any[]} params
   * @returns {{command: string | null, args: string[]}}
   */
  _parseScript(script, ...params) {
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
        return { command: null, args: [] };
    }
  }

  /**
   * Run a script, cancelling an already running iteration of that script.
   * @param {HookValueType} script
   * @param {any[]} params
   */
  _handleScript(script, params) {
    const { command, args = [] } = this._parseScript(script, ...params);
    if (!command) {
      this._handleError(`Missing command for script ${script}`);
      return;
    }
    let key = command;
    if (args.length > 0) {
      key += ` ${args.join(' ')}`;
    }
    this._log(`Running script: ${key}`);
    if (this._procs[key]) this._killProc(key);
    this._procs[key] = spawn(command, args, { stdio: 'inherit', shell: true });
    this._procs[key].on('error', this._onScriptError.bind(this, key));
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
    // @ts-ignore
    this.logger.error(msg);
  }

  /**
   * Log a message to the console.
   * @param {string} msg
   */
  _log(msg) {
    // @ts-ignore
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
    } else if (error) {
      this._onScriptError(key, error);
    }
    this._log(`Completed script: ${key}`);
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
