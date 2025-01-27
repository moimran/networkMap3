/**
 * Toast Notification Utility
 * Provides a simple, consistent way to show notifications across the application
 */
class ToastManager {
    /**
     * Show a success toast notification
     * @param {string} message - Message to display
     * @param {Object} [options] - Additional toast options
     */
    success(message, options = {}) {
        console.log(`✅ SUCCESS: ${message}`);
        this._showToast(message, 'success', options);
    }

    /**
     * Show a warning toast notification
     * @param {string} message - Message to display
     * @param {Object} [options] - Additional toast options
     */
    warning(message, options = {}) {
        console.warn(`⚠️ WARNING: ${message}`);
        this._showToast(message, 'warning', options);
    }

    /**
     * Show an error toast notification
     * @param {string} message - Message to display
     * @param {Object} [options] - Additional toast options
     */
    error(message, options = {}) {
        console.error(`❌ ERROR: ${message}`);
        this._showToast(message, 'error', options);
    }

    /**
     * Show an info toast notification
     * @param {string} message - Message to display
     * @param {Object} [options] - Additional toast options
     */
    info(message, options = {}) {
        console.info(`ℹ️ INFO: ${message}`);
        this._showToast(message, 'info', options);
    }

    /**
     * Internal method to show toast
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, warning, error, info)
     * @param {Object} options - Additional toast options
     */
    _showToast(message, type, options = {}) {
        // Fallback to console if no toast library is available
        const defaultOptions = {
            position: 'top-right',
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
        };

        const finalOptions = { ...defaultOptions, ...options };

        // Log to console with styling
        switch (type) {
            case 'success':
                console.log(`%c${message}`, 'color: green; font-weight: bold');
                break;
            case 'warning':
                console.warn(`%c${message}`, 'color: orange; font-weight: bold');
                break;
            case 'error':
                console.error(`%c${message}`, 'color: red; font-weight: bold');
                break;
            case 'info':
                console.info(`%c${message}`, 'color: blue; font-weight: bold');
                break;
        }
    }
}

// Export a singleton instance
export default new ToastManager();
