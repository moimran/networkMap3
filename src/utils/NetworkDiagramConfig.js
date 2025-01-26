/**
 * Centralized Configuration for Network Diagram
 * Designed to be easily adaptable to different libraries and requirements
 */
export const NETWORK_DIAGRAM_CONFIG = {
    // Grid Configuration
    GRID: {
        SIZE: 20,
        ENABLED: true
    },

    // Path Configuration for Easy Management
    PATHS: {
        BASE: '/networkmap',
        DEVICE_CONFIG: '/deviceconfig',
        ICONS: '/assets/icons',
        ENDPOINTS: '/deviceconfig/endpoints'
    },

    // Connection Type Configurations
    CONNECTION_TYPES: {
        ETHERNET: {
            id: 'ETHERNET',
            name: 'Ethernet Connection',
            connector: {
                type: 'Bezier',
                options: { curviness: 50 }
            },
            style: {
                strokeWidth: 2,
                color: '#0066aa',
                dashStyle: 'solid'
            },
            endpoints: {
                source: 'Dot',
                target: 'Arrow'
            }
        },
        SERIAL: {
            id: 'SERIAL',
            name: 'Serial Connection',
            connector: {
                type: 'Straight',
                options: {}
            },
            style: {
                strokeWidth: 2,
                color: '#ff6347',
                dashStyle: 'dashed'
            },
            endpoints: {
                source: 'Square',
                target: 'Dot'
            }
        }
    },

    // Connection Constraints
    CONSTRAINTS: {
        MAX_CONNECTIONS_PER_NODE: 4,
        ALLOW_SELF_CONNECTIONS: false
    }
};

/**
 * Performance and Logging Utility
 * Provides standardized logging across the application
 */
export const PerformanceLogger = {
    /**
     * Log informational messages
     * @param {string} action - Action being performed
     * @param {Object} details - Additional details about the action
     */
    log: (action, details = {}) => {
        console.log(`[NetworkDiagram] ${action}`, {
            timestamp: new Date().toISOString(),
            ...details
        });
    },

    /**
     * Log error messages
     * @param {string} action - Action that failed
     * @param {Error} error - Error object
     */
    error: (action, error) => {
        console.error(`[NetworkDiagram] ${action}`, {
            timestamp: new Date().toISOString(),
            errorMessage: error.message,
            errorStack: error.stack
        });
    }
};

/**
 * Endpoint Configuration Loader
 * Dynamically loads device-specific endpoint configurations
 */
export const EndpointConfigLoader = {
    /**
     * Load endpoint configurations for a specific device type
     * @param {string} iconPath - Path to the device icon
     * @returns {Object} Endpoint configuration for the device
     */
    async loadDeviceEndpoints(iconPath) {
        try {
            // Extract device type by removing path and file extension
            const deviceType = iconPath
                .split('/')           // Split by path separator
                .pop()                // Get the filename
                .replace(/\.(svg|png)$/, '');  // Remove .svg or .png extension

            const response = await fetch(
                `${NETWORK_DIAGRAM_CONFIG.PATHS.DEVICE_CONFIG}/${deviceType}.json`
            );
            
            if (!response.ok) {
                // Log detailed error for failed endpoint configuration fetch
                PerformanceLogger.error('Endpoint Configuration Fetch Failed', {
                    iconPath,
                    deviceType,
                    status: response.status,
                    url: `${NETWORK_DIAGRAM_CONFIG.PATHS.DEVICE_CONFIG}/${deviceType}.json`
                });
                return null;
            }

            const endpointConfig = await response.json();

            // Log successful endpoint configuration load
            PerformanceLogger.log('Endpoint Configuration Loaded', {
                deviceType,
                iconPath,
                endpointCount: endpointConfig?.endpoints?.length || 0
            });

            return endpointConfig;
        } catch (error) {
            // Comprehensive error logging
            PerformanceLogger.error('Endpoint Configuration Load Error', {
                iconPath,
                errorMessage: error.message,
                errorStack: error.stack
            });
            return null;
        }
    }
};
