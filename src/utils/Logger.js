import fs from 'fs';
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
        fileLogging: false,
        logFilePath: '',
        logHistory: [],
        maxLogHistory: 100,
        logDirectory: ''
    };

    /**
     * Detect current environment
     * @returns {Object} Environment details
     */
    static #detectEnvironment() {
        // Check for Node.js environment
        const isNode = typeof process !== 'undefined' && 
                       process.versions && 
                       process.versions.node;
        
        // Check for Electron environment
        const isElectron = typeof window !== 'undefined' && 
                           window.process && 
                           window.process.type === 'renderer';
        
        const isBrowser = typeof window !== 'undefined' && 
                          typeof document !== 'undefined' && 
                          !isElectron;
        
        return {
            isNode,
            isElectron,
            isBrowser,
            canWriteFiles: isNode || isElectron,
            environment: isNode ? 'node' : 
                         isElectron ? 'electron' : 
                         'browser'
        };
    }

    /**
     * Browser-specific local storage logging
     * @param {Object} logEntry - Log entry to store
     */
    static #browserLocalStorageLog(logEntry) {
        try {
            // Retrieve existing logs from local storage
            const storedLogsKey = 'app_logs';
            const existingLogsJson = localStorage.getItem(storedLogsKey) || '[]';
            const existingLogs = JSON.parse(existingLogsJson);

            // Add new log entry
            existingLogs.push(logEntry);

            // Trim log history if it exceeds max length
            if (existingLogs.length > this.#config.maxLogHistory) {
                existingLogs.splice(0, existingLogs.length - this.#config.maxLogHistory);
            }

            // Store back in local storage
            localStorage.setItem(storedLogsKey, JSON.stringify(existingLogs));
        } catch (error) {
            console.error('Error storing log in local storage:', error);
        }
    }

    /**
     * Determine absolute path for logs
     * @returns {string} Absolute path to logs directory
     */
    static #determineLogPath() {
        const env = this.#detectEnvironment();

        // If not Node.js or Electron, cannot write traditional files
        if (!env.canWriteFiles) {
            return null;
        }

        try {
            // Electron-specific path
            if (env.isElectron) {
                const { app } = window.require('electron');
                const logPath = path.join(app.getPath('userData'), 'logs');
                
                return logPath;
            }

            // Node.js paths
            const possiblePaths = [
                process.cwd(), // Current working directory
                path.resolve(process.cwd(), 'logs'), // Logs subdirectory
                path.resolve(__dirname, '..', '..', 'logs'), // Project root logs
                path.resolve(process.env.HOME || process.env.USERPROFILE, 'logs') // User home logs
            ];

            for (const logPath of possiblePaths) {
                try {
                    // Ensure directory exists
                    if (!fs.existsSync(logPath)) {
                        fs.mkdirSync(logPath, { recursive: true });
                    }

                    // Test write permission
                    const testFile = path.join(logPath, 'logger-test.txt');
                    fs.writeFileSync(testFile, 'Logger permission test');
                    fs.unlinkSync(testFile);

                    return logPath;
                } catch (writeError) {
                    // Silently continue to next path
                    continue;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Configure the logger
     * @param {Object} options - Configuration options
     */
    static configure(options = {}) {
        // Merge provided options
        this.#config = { ...this.#config, ...options };

        const env = this.#detectEnvironment();

        // Only attempt file logging in Node.js or Electron environment
        if (env.canWriteFiles && this.#config.fileLogging) {
            try {
                // Determine log directory
                const logDirectory = this.#determineLogPath();
                
                if (logDirectory) {
                    this.#config.logDirectory = logDirectory;

                    // Create log file path
                    const logFileName = `app-${new Date().toISOString().replace(/:/g, '-')}.log`;
                    this.#config.logFilePath = path.join(this.#config.logDirectory, logFileName);
                } else {
                    this.#config.fileLogging = false;
                }
            } catch (error) {
                this.#config.fileLogging = false;
            }
        }
    }

    /**
     * Write log entry to file (Node.js only)
     * @param {Object} logEntry - Log entry to write
     */
    static #writeToFile(logEntry) {
        const env = this.#detectEnvironment();

        // Only write to file in Node.js or Electron environment
        if (env.canWriteFiles && this.#config.fileLogging && this.#config.logFilePath) {
            try {
                const logMessage = `${logEntry.timestamp} [${logEntry.level.toUpperCase()}]: ${logEntry.message}` +
                    (Object.keys(logEntry.metadata).length ? ` ${JSON.stringify(logEntry.metadata)}` : '') + 
                    '\n';
                
                fs.appendFileSync(this.#config.logFilePath, logMessage);
            } catch (error) {
                console.error('Error writing to log file:', error);
            }
        } else if (env.isBrowser) {
            // Fallback to browser local storage logging
            this.#browserLocalStorageLog(logEntry);
        }
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

        const currentPriority = levelPriorities[this.#config.level] || 3;
        const incomingPriority = levelPriorities[level] || 3;

        return this.#config.enabled && incomingPriority >= currentPriority;
    }

    /**
     * Internal log method
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} [metadata] - Additional metadata
     */
    static #log(level, message, metadata = {}) {
        // Check if log should be output
        if (!this.#shouldLog(level)) return;

        // Prepare log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata
        };

        // Store in log history
        if (this.#config.logHistory.length >= this.#config.maxLogHistory) {
            this.#config.logHistory.shift();
        }
        this.#config.logHistory.push(logEntry);

        // Console output
        if (this.#config.consoleOutput) {
            const consoleMethod = this.#getConsoleMethod(level);
            
            // Format log message
            const formattedMessage = `[${level.toUpperCase()}] ${message}`;
            
            // Log with or without metadata
            if (Object.keys(metadata).length) {
                consoleMethod(formattedMessage, metadata);
            } else {
                consoleMethod(formattedMessage);
            }
        }

        // Attempt to write to file or local storage
        this.#writeToFile(logEntry);

        return logEntry;
    }

    /**
     * Get appropriate console method based on log level
     * @param {string} level - Log level
     * @returns {Function} Console method to use
     */
    static #getConsoleMethod(level) {
        switch (level) {
            case this.LEVELS.ERROR: return console.error;
            case this.LEVELS.WARN: return console.warn;
            case this.LEVELS.DEBUG: return console.debug;
            case this.LEVELS.TRACE: return console.trace;
            default: return console.log;
        }
    }

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Object} [metadata] - Additional metadata
     */
    static error(message, metadata = {}) {
        return this.#log(this.LEVELS.ERROR, message, metadata);
    }

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {Object} [metadata] - Additional metadata
     */
    static warn(message, metadata = {}) {
        return this.#log(this.LEVELS.WARN, message, metadata);
    }

    /**
     * Log an informational message
     * @param {string} message - Info message
     * @param {Object} [metadata] - Additional metadata
     */
    static info(message, metadata = {}) {
        return this.#log(this.LEVELS.INFO, message, metadata);
    }

    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} [metadata] - Additional metadata
     */
    static debug(message, metadata = {}) {
        return this.#log(this.LEVELS.DEBUG, message, metadata);
    }

    /**
     * Log a trace message
     * @param {string} message - Trace message
     * @param {Object} [metadata] - Additional metadata
     */
    static trace(message, metadata = {}) {
        return this.#log(this.LEVELS.TRACE, message, metadata);
    }

    /**
     * Get current log history
     * @returns {Array} Array of log entries
     */
    static getLogHistory() {
        return [...this.#config.logHistory];
    }

    /**
     * Clear log history
     */
    static clearLogHistory() {
        this.#config.logHistory = [];
    }

    /**
     * Get current log file path
     * @returns {string} Current log file path or empty string
     */
    static getLogFilePath() {
        return this.#config.logFilePath || '';
    }

    /**
     * Get current log directory
     * @returns {string} Current log directory
     */
    static getLogDirectory() {
        return this.#config.logDirectory || '';
    }

    /**
     * Retrieve logs from browser local storage
     * @returns {Array} Stored log entries
     */
    static getBrowserLogs() {
        try {
            const storedLogsJson = localStorage.getItem('app_logs') || '[]';
            return JSON.parse(storedLogsJson);
        } catch (error) {
            console.error('Error retrieving browser logs:', error);
            return [];
        }
    }

    /**
     * Clear logs from browser local storage
     */
    static clearBrowserLogs() {
        try {
            localStorage.removeItem('app_logs');
        } catch (error) {
            console.error('Error clearing browser logs:', error);
        }
    }
}

export default Logger;
