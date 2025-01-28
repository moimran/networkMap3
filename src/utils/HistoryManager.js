import Logger from './Logger';

/**
 * Manages the undo/redo functionality for the network diagram
 * This implementation uses the Command pattern to track and manage changes
 */
class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // Limit stack size to prevent memory issues
    }

    /**
     * Add a new action to the history
     * @param {Object} action Action to add
     * @param {Function} action.execute Function to execute the action
     * @param {Function} action.undo Function to undo the action
     * @param {string} action.description Description of the action
     */
    addAction(action) {
        try {
            // Clear redo stack when new action is added
            this.redoStack = [];
            
            // Add action to undo stack
            this.undoStack.push(action);

            // Trim history if it exceeds max size
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift();
            }

            Logger.debug('Action added to history', {
                description: action.description,
                undoStackSize: this.undoStack.length
            });
        } catch (error) {
            Logger.error('Error adding action to history', {
                error: error.message,
                action: action.description
            });
        }
    }

    /**
     * Undo the last action
     * @returns {boolean} Whether the undo was successful
     */
    undo() {
        try {
            if (this.undoStack.length === 0) {
                Logger.info('No actions to undo');
                return false;
            }

            const action = this.undoStack.pop();
            action.undo();
            this.redoStack.push(action);

            Logger.debug('Action undone', {
                description: action.description,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length
            });

            return true;
        } catch (error) {
            Logger.error('Error during undo operation', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Redo the last undone action
     * @returns {boolean} Whether the redo was successful
     */
    redo() {
        try {
            if (this.redoStack.length === 0) {
                Logger.info('No actions to redo');
                return false;
            }

            const action = this.redoStack.pop();
            action.execute();
            this.undoStack.push(action);

            Logger.debug('Action redone', {
                description: action.description,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length
            });

            return true;
        } catch (error) {
            Logger.error('Error during redo operation', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        Logger.info('History cleared');
    }

    /**
     * Get the current history state
     * @returns {Object} Current history state
     */
    getState() {
        return {
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
            undoStackSize: this.undoStack.length,
            redoStackSize: this.redoStack.length
        };
    }
}

// Export a singleton instance
export default new HistoryManager();
