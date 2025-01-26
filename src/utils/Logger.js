/**
 * Centralized Logging Utility
 * Provides a flexible and configurable logging mechanism
 */
class Logger {
    /**
     * Logging levels with numeric priorities
     */
    static LEVELS = {
        ERROR: { name: 'error', priority: 50 },
        WARN: { name: 'warn', priority: 40 },
        INFO: { name: 'info', priority: 30 },
        DEBUG: { name: 'debug', priority: 20 },
        TRACE: { name: 'trace', priority: 10 }
    };

    /**
     * Default configuration for logging
     */
    static #config = {
        level: 'info',
        enabled: true,
        consoleOutput: true,
        externalLogger: null,
        includeCallerInfo: true
    };

    /**
     * Capture caller information in a browser-compatible way
     * @returns {Object} Caller details
     */
    static #getCaller() {
        try {
            // Create a new Error to capture stack trace
            const error = new Error();
            
            // Split the stack trace into lines
            const stackLines = error.stack.split('\n');
            
            // Find the first line that is not from Logger internals
            const callerLine = stackLines.find(line => 
                line.includes('at ') && 
                !line.includes('Logger.js') && 
                !line.includes('#getCaller') &&
                !line.includes('_log')
            );
            
            // If no caller line found, return default
            if (!callerLine) {
                return {
                    fileName: 'unknown',
                    functionName: 'unknown',
                    lineNumber: 'unknown'
                };
            }
            
            // Regex to extract file, function, and line number
            const fileRegex = /at\s+(?:(.+?)\s+)?\(?([^:]+):(\d+)(?::\d+)?\)?/;
            const match = callerLine.match(fileRegex);
            
            if (match) {
                // Extract components
                const fullPath = match[2] || 'unknown';
                const fileName = fullPath.split('/').pop().replace(/\?.*$/, '');
                const functionName = match[1] || 'unknown';
                const lineNumber = match[3] || 'unknown';
                
                return {
                    fileName,
                    functionName,
                    lineNumber
                };
            }
            
            // Fallback if regex fails
            return {
                fileName: 'unknown',
                functionName: 'unknown',
                lineNumber: 'unknown'
            };
        } catch (e) {
            // Log any parsing errors
            console.error('Error capturing caller information:', e);
            
            return {
                fileName: 'unknown',
                functionName: 'unknown',
                lineNumber: 'unknown'
            };
        }
    }

    /**
     * Configure the logger
     * @param {Object} options - Configuration options
     */
    static configure(options = {}) {
        // Merge provided options with existing configuration
        this.#config = { ...this.#config, ...options };
    }

    /**
     * Determine if a log should be output based on current configuration
     * @param {string} level - Log level to check
     * @returns {boolean} Whether the log should be output
     */
    static #shouldLogLevel(level) {
        // If logging is disabled, return false
        if (!this.#config.enabled) return false;

        // Find the priority of the current config level
        const currentLevelPriority = Object.values(this.LEVELS)
            .find(l => l.name === this.#config.level)?.priority || 0;

        // Find the priority of the incoming log level
        const incomingLevelPriority = Object.values(this.LEVELS)
            .find(l => l.name === level)?.priority || 0;

        // Log if incoming level priority is higher or equal to current level
        return incomingLevelPriority >= currentLevelPriority;
    }

    /**
     * Internal log method with enhanced metadata
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata] - Additional log metadata
     */
    static #log(level, message, metadata = {}) {
        // Check if log should be output based on current config
        if (!this.#shouldLogLevel(level)) return;

        // Prepare log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata: { ...metadata }
        };

        // Add caller information if enabled
        if (this.#config.includeCallerInfo) {
            const callerInfo = this.#getCaller();
            logEntry.caller = callerInfo;
        }

        // Console output
        if (this.#config.consoleOutput) {
            const consoleMethod = this.#getConsoleMethod(level);
            consoleMethod(
                `[${level.toUpperCase()}] ${message}`,
                logEntry.caller 
                    ? `File: ${logEntry.caller.fileName}, Line: ${logEntry.caller.lineNumber}` 
                    : '',
                metadata
            );
        }

        // External logging (if configured)
        if (this.#config.externalLogger) {
            this.#config.externalLogger(logEntry);
        }

        return logEntry;
    }

    /**
     * Get appropriate console method based on log level
     * @param {string} level - Log level
     * @returns {Function} Console method to use
     */
    static #getConsoleMethod(level) {
        switch (level) {
            case 'error': return console.error;
            case 'warn': return console.warn;
            case 'debug': return console.debug;
            case 'trace': return console.trace;
            default: return console.log;
        }
    }

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Object} [metadata] - Additional metadata
     */
    static error(message, metadata = {}) {
        return this.#log('error', message, metadata);
    }

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {Object} [metadata] - Additional metadata
     */
    static warn(message, metadata = {}) {
        return this.#log('warn', message, metadata);
    }

    /**
     * Log an informational message
     * @param {string} message - Info message
     * @param {Object} [metadata] - Additional metadata
     */
    static info(message, metadata = {}) {
        return this.#log('info', message, metadata);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} [metadata] - Additional metadata
     */
    static debug(message, metadata = {}) {
        return this.#log('debug', message, metadata);
    }

    /**
     * Log a trace message
     * @param {string} message - Trace message
     * @param {Object} [metadata] - Additional metadata
     */
    static trace(message, metadata = {}) {
        return this.#log('trace', message, metadata);
    }
}

export default Logger;
