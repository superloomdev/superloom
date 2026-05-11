// Info: Structured logging library with log levels, dual output formats, and
// performance audit support. Zero runtime dependencies - no external libs required.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Debug interface
// with its own config. shared_libs is accepted for interface uniformity but
// unused - Debug has no external lib dependencies.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
config. shared_libs is accepted for interface uniformity but unused.

@param {Object} shared_libs - Lib container (unused)
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./config'),
    config || {}
  );

  // Create and return the public interface
  return createInterface(CONFIG);

};///////////////////////////// Module-Loader END ////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public functions close
over the provided CONFIG.

@param {Object} CONFIG - Merged configuration for this instance

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (CONFIG) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Debug = { // Public functions accessible by other modules

    /********************************************************************
    Log a debug-level message. Use for verbose development diagnostics.

    @param {String} message - Log message
    @param {Object} [data] - (Optional) Additional data to log

    @return {void}
    *********************************************************************/
    debug: function (message, data) {

      _Debug.writeLog('debug', message, data);

    },


    /********************************************************************
    Log an info-level message. Use for general operational information.

    @param {String} message - Log message
    @param {Object} [data] - (Optional) Additional data to log

    @return {void}
    *********************************************************************/
    info: function (message, data) {

      _Debug.writeLog('info', message, data);

    },


    /********************************************************************
    Log a warn-level message. Use for recoverable issues or deprecations.

    @param {String} message - Log message
    @param {Object} [data] - (Optional) Additional data to log

    @return {void}
    *********************************************************************/
    warn: function (message, data) {

      _Debug.writeLog('warn', message, data);

    },


    /********************************************************************
    Log an error-level message. Use for errors that need investigation.

    @param {String} message - Log message
    @param {Error|Object} [error] - (Optional) Error object or additional data
    @param {String} [extra_info] - (Optional) Extra context for the error

    @return {void}
    *********************************************************************/
    error: function (message, error, extra_info) {

      const data = {};

      if (error) {
        data.error = error.message || String(error);
        data.code = error.code || null;

        if (CONFIG.INCLUDE_STACK_TRACE && error.stack) {
          data.stack = error.stack;
        }
      }

      if (extra_info) {
        data.extra = extra_info;
      }

      _Debug.writeLog('error', message, data);

    },


    /********************************************************************
    Backward-compatible interface to console.log.
    Logs at 'info' level. Use debug/info/warn/error for new code.

    @param {...*} args - Forward all arguments as-is

    @return {void}
    *********************************************************************/
    log: function () {

      if (_Debug.shouldLog('info')) {
        console.log(...arguments);
      }

    },


    /********************************************************************
    Performance audit log. Measures elapsed time and heap memory usage.
    Use to track connection times, query durations, and API response times.

    @param {String} action - Action identifier (e.g., 'Start', 'End')
    @param {String} routine - Process name being audited
    @param {Number} [reference_time] - (Optional) Start time in unix-milliseconds

    @return {void}
    *********************************************************************/
    performanceAuditLog: function (action, routine, reference_time) {

      if (!_Debug.shouldLog('debug')) {
        return;
      }

      // Calculation
      const current_time_in_ms = Date.now();
      const time_diff_in_ms = (reference_time !== null && reference_time !== undefined)
        ? (current_time_in_ms - reference_time)
        : null;

      const data = {
        action: action,
        routine: routine,
        elapsed_ms: time_diff_in_ms,
        timestamp_ms: current_time_in_ms
      };

      // Calculate memory usage if available
      if (
        CONFIG.INCLUDE_MEMORY_USAGE &&
        typeof process !== 'undefined' &&
        typeof process.memoryUsage === 'function'
      ) {
        const memory_usage = process.memoryUsage();
        data.heap_used_mb = Math.round((memory_usage.heapUsed / 1024 / 1024) * 1000) / 1000;
      }

      _Debug.writeLog('debug', '[AUDIT] ' + action + ' - ' + routine, data);

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _Debug = { // Private methods accessible within this module only

    // Log level numeric values for comparison
    LOG_LEVELS: {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3,
      'none': 4
    },


    /********************************************************************
    Check if a message at the given level should be logged

    @param {String} level - Log level to check ('debug'|'info'|'warn'|'error')

    @return {Boolean} - true if should log, false if suppressed
    *********************************************************************/
    shouldLog: function (level) {

      const threshold = _Debug.LOG_LEVELS[CONFIG.LOG_LEVEL] || 0;
      const message_level = _Debug.LOG_LEVELS[level] || 0;

      return message_level >= threshold;

    },


    /********************************************************************
    Write a log entry in the configured format

    @param {String} level - Log level ('debug'|'info'|'warn'|'error')
    @param {String} message - Log message
    @param {Object} [data] - (Optional) Additional structured data

    @return {void}
    *********************************************************************/
    writeLog: function (level, message, data) {

      // Check if this level should be logged
      if (!_Debug.shouldLog(level)) {
        return;
      }

      // Choose format
      if (CONFIG.LOG_FORMAT === 'json') {
        _Debug.writeJsonLog(level, message, data);
      }
      else {
        _Debug.writeTextLog(level, message, data);
      }

    },


    /********************************************************************
    Write a structured JSON log line (CloudWatch / log aggregator compatible)

    @param {String} level - Log level
    @param {String} message - Log message
    @param {Object} [data] - Additional data

    @return {void}
    *********************************************************************/
    writeJsonLog: function (level, message, data) {

      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message: message,
        app: CONFIG.APP_NAME,
        env: CONFIG.ENVIRONMENT
      };

      // Merge additional data
      if (data && typeof data === 'object') {
        entry.data = data;
      }

      // Use stderr for error level, stdout for everything else
      if (level === 'error') {
        console.error(JSON.stringify(entry));
      }
      else {
        console.log(JSON.stringify(entry));
      }

    },


    /********************************************************************
    Write a human-readable text log line (local dev / Docker stdout)

    @param {String} level - Log level
    @param {String} message - Log message
    @param {Object} [data] - Additional data

    @return {void}
    *********************************************************************/
    writeTextLog: function (level, message, data) {

      const prefix = '[' + new Date().toISOString() + '] [' + level.toUpperCase() + ']';
      let output = prefix + ' ' + message;

      // Append data if present
      if (data && typeof data === 'object') {

        // For errors, format nicely
        if (data.error) {
          output += '\n  Error: ' + data.error;
        }

        if (data.code) {
          output += '\n  Code: ' + data.code;
        }

        if (data.extra) {
          output += '\n  Extra: ' + data.extra;
        }

        if (data.stack) {
          output += '\n  Stack: ' + data.stack;
        }

        // For audit data, format inline
        if (data.elapsed_ms !== undefined) {
          output += ' [' + (data.elapsed_ms !== null ? data.elapsed_ms + ' ms' : 'Unknown') + ']';
        }

        if (data.heap_used_mb !== undefined) {
          output += ' [Heap: ' + data.heap_used_mb + ' mb]';
        }

        // For generic data objects (not error/audit), append as JSON
        if (!data.error && !data.code && !data.extra && !data.stack && data.elapsed_ms === undefined) {
          output += ' ' + JSON.stringify(data);
        }

      }

      // Use stderr for error level, stdout for everything else
      if (level === 'error') {
        console.error(output);
      }
      else {
        console.log(output);
      }

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return Debug;

};/////////////////////////// createInterface END ///////////////////////////////
