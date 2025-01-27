import path from 'path';

/**
 * Lightweight, cross-environment logging utility
 */
class Logger {
    // Log levels
    static LEVELS = {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug',
        TRACE: 'trace'
    };

    // Current configuration
    static #config = {
        level: 'info',
        enabled: true,
        consoleOutput: true,
        logHistory: [],
        maxLogHistory: 100
    };

    /**
     * Configure the logger
     * @param {Object} options - Configuration options
     */
    static configure(options = {}) {
        // Merge provided options
        this.#config = { ...this.#config, ...options };
    }

    /**
     * Determine if a log should be output based on current configuration
     * @param {string} level - Log level to check
     * @returns {boolean} Whether the log should be output
     */
    static #shouldLog(level) {
        const levelPriorities = {
            [this.LEVELS.ERROR]: 5,
            [this.LEVELS.WARN]: 4,
            [this.LEVELS.INFO]: 3,
            [this.LEVELS.DEBUG]: 2,
            [this.LEVELS.TRACE]: 1
        };

        const currentPriority = levelPriorities[this.#config.level] || 0;
        const inputPriority = levelPriorities[level] || 0;

        return this.#config.enabled && inputPriority >= currentPriority;
    }

    /**
     * Log a message
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static #log(level, message, metadata = {}) {
        // Validate log level
        if (!Object.values(this.LEVELS).includes(level)) {
            throw new Error(`Invalid log level: ${level}`);
        }

        // Check if log should be output
        if (!this.#shouldLog(level)) {
            return null;
        }

        // Create log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata
        };

        // Console output if enabled
        if (this.#config.consoleOutput) {
            const consoleMethod = console[level] || console.log;
            consoleMethod(
                `${logEntry.timestamp} [${level.toUpperCase()}]: ${message}`,
                Object.keys(metadata).length ? metadata : ''
            );
        }

        // Maintain log history
        if (this.#config.logHistory.length >= this.#config.maxLogHistory) {
            this.#config.logHistory.shift();
        }
        this.#config.logHistory.push(logEntry);

        return logEntry;
    }

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static error(message, metadata = {}) {
        return this.#log(this.LEVELS.ERROR, message, metadata);
    }

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static warn(message, metadata = {}) {
        return this.#log(this.LEVELS.WARN, message, metadata);
    }

    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static info(message, metadata = {}) {
        return this.#log(this.LEVELS.INFO, message, metadata);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static debug(message, metadata = {}) {
        return this.#log(this.LEVELS.DEBUG, message, metadata);
    }

    /**
     * Log a trace message
     * @param {string} message - Trace message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Log entry
     */
    static trace(message, metadata = {}) {
        return this.#log(this.LEVELS.TRACE, message, metadata);
    }

    /**
     * Get current log history
     * @returns {Array} Log history
     */
    static getLogHistory() {
        return [...this.#config.logHistory];
    }
}

export default Logger;
