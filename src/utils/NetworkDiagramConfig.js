import Logger from './Logger';

/**
 * Centralized Configuration for Network Diagram
 * Designed to be easily adaptable to different libraries and requirements
 */
const NETWORK_DIAGRAM_CONFIG = {
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
 * UUID Generation Utility
 * Provides a robust way to generate unique identifiers
 */
const makeId = () => {
    const timestamp = new Date().getTime();
    const randomPart = Math.floor(Math.random() * 1000000);
    return `${timestamp}-${randomPart}`;
};

/**
 * Deprecated: Keep for backwards compatibility
 */
const generateUUID = makeId;

/**
 * Endpoint Configuration Loader
 * Dynamically loads device-specific endpoint configurations
 */
const EndpointConfigLoader = {
    /**
     * Load endpoint configurations for a specific device type
     * @param {string} iconPath - Path to the device icon
     * @returns {Object} Endpoint configuration for the device
     */
    async loadDeviceEndpoints(iconPath) {
        try {
            // Extract device type by removing path and file extension, convert to lowercase
            const deviceType = iconPath
                .split('/')           // Split by path separator
                .pop()                // Get the filename
                .replace(/\.(svg|png)$/, '')  // Remove .svg or .png extension
                .toLowerCase();        // Convert to lowercase

            const response = await fetch(
                `${NETWORK_DIAGRAM_CONFIG.PATHS.DEVICE_CONFIG}/${deviceType}.json`
            );
            
            if (!response.ok) {
                // Log detailed error for failed endpoint configuration fetch
                Logger.error('Endpoint Configuration Fetch Failed', {
                    iconPath,
                    deviceType,
                    status: response.status,
                    url: `${NETWORK_DIAGRAM_CONFIG.PATHS.DEVICE_CONFIG}/${deviceType}.json`
                });
                return null;
            }

            const endpointConfig = await response.json();

            // Log successful endpoint configuration load
            Logger.info('Endpoint Configuration Loaded', {
                deviceType,
                iconPath,
                endpointCount: endpointConfig?.interfaces?.length || 0
            });

            return endpointConfig;
        } catch (error) {
            // Comprehensive error logging
            Logger.error('Endpoint Configuration Load Error', {
                iconPath,
                errorMessage: error.message,
                errorStack: error.stack
            });
            return null;
        }
    }
};

export {
    Logger,
    NETWORK_DIAGRAM_CONFIG,
    makeId,
    generateUUID,
    EndpointConfigLoader
};
