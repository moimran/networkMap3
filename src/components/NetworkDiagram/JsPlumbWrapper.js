import { 
    ready as jsPlumbReady, 
    newInstance, 
    BlankEndpoint, 
    DotEndpoint,
    AnchorLocations
} from "@jsplumb/browser-ui";
import { 
    NETWORK_DIAGRAM_CONFIG, 
    Logger 
} from '../../utils/NetworkDiagramConfig';

/**
 * Comprehensive JsPlumb Wrapper for Network Diagram
 * Centralizes all jsPlumb-related API interactions and configurations
 */
class JsPlumbWrapper {
    constructor() {
        this.instance = null;
        this.containerRef = null;
        this.connections = [];
        this.endpoints = {};
        this.instanceCount = 0;
    }

    /**
     * Initialize jsPlumb instance with standard configuration
     * @param {HTMLElement} container - Container element for jsPlumb
     * @param {Object} options - Additional configuration options
     * @returns {Object} Initialized jsPlumb instance
     */
    initialize(container, options = {}) {
        // Prevent re-initialization for same container
        if (this.containerRef === container) {
            this.instanceCount++;
            return this.instance;
        }

        // Destroy existing instance if different container
        if (this.instance) {
            this.destroy();
        }

        const defaultConfig = {
            container: container,
            dragOptions: { 
                cursor: 'move', 
                grid: [
                    NETWORK_DIAGRAM_CONFIG.GRID.SIZE, 
                    NETWORK_DIAGRAM_CONFIG.GRID.SIZE
                ]
            },
            connectionType: 'basic',
            ...options
        };

        this.instance = newInstance(defaultConfig);
        this.containerRef = container;
        this.instanceCount = 1;

        this._bindStandardEvents();

        return this.instance;
    }

    /**
     * Bind standard jsPlumb events with comprehensive logging
     * @private
     */
    _bindStandardEvents() {
        if (!this.instance) return;

        this.instance.bind('connection', (info) => {
            this.connections.push(info);
            Logger.info('jsPlumb Connection Event', {
                sourceId: info.sourceId,
                targetId: info.targetId,
                sourceNode: info.source?.dataset?.nodeName,
                targetNode: info.target?.dataset?.nodeName
            });
        });

        this.instance.bind('connectionDetached', (info) => {
            this.connections = this.connections.filter(
                conn => conn.id !== info.connection.id
            );
            Logger.info('jsPlumb Connection Detached', {
                sourceId: info.sourceId,
                targetId: info.targetId
            });
        });
    }

    /**
     * Create a node endpoint with flexible configuration
     * @param {string} nodeId - ID of the node
     * @param {Object} customConfig - Custom endpoint configuration
     * @returns {Object} Created endpoint
     */
    createNodeEndpoint(nodeId, customConfig = {}) {
        if (!this.instance) {
            Logger.error('Cannot create endpoint: jsPlumb not initialized');
            return null;
        }

        try {
            // Get DOM element
            const element = typeof nodeId === 'string' ? document.getElementById(nodeId) : nodeId;
            if (!element) {
                Logger.error('Cannot create endpoint: DOM element not found', { nodeId });
                return null;
            }

            const defaultConfig = {
                endpoint: BlankEndpoint,
                anchor: AnchorLocations.Continuous,
                isSource: true,
                isTarget: true,
                connector: ["Flowchart", { cornerRadius: 5 }],
                paintStyle: { 
                    fill: "transparent",
                    stroke: "transparent"
                },
                hoverPaintStyle: { 
                    fill: "transparent",
                    stroke: "transparent"
                },
                connectorStyle: {
                    strokeWidth: 2,
                    stroke: "#666",
                    joinstyle: "round"
                },
                connectorHoverStyle: {
                    strokeWidth: 3,
                    stroke: "#FF6600"
                },
                maxConnections: -1,
                ...customConfig
            };

            // Create endpoint
            const endpoint = this.instance.addEndpoint(element, defaultConfig);
            
            // Track endpoints for each node
            const elementId = element.id || nodeId;
            if (!this.endpoints[elementId]) {
                this.endpoints[elementId] = [];
            }
            this.endpoints[elementId].push(endpoint);

            return endpoint;
        } catch (error) {
            Logger.error('Endpoint Creation Failed', {
                nodeId,
                errorMessage: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    /**
     * Connect two nodes with comprehensive configuration
     * @param {Object} sourceNode - Source node element
     * @param {Object} targetNode - Target node element
     * @param {Object} connectionDetails - Connection configuration details
     * @returns {Object|null} Created connection or null
     */
    connectNodes(sourceNode, targetNode, connectionDetails = {}) {
        if (!this.instance) {
            Logger.warn('Connection Creation Failed: jsPlumb not initialized');
            return null;
        }

        // Validate source and target nodes
        if (!sourceNode || !targetNode) {
            Logger.warn('Connection Creation Failed: Invalid source or target node');
            return null;
        }

        // Determine connection type based on interface type
        const connectionType = connectionDetails.interfaceType?.toLowerCase() === 'serial' 
            ? 'SERIAL' 
            : 'ETHERNET';

        const defaultConnectionConfig = {
            source: sourceNode,
            target: targetNode,
            ...NETWORK_DIAGRAM_CONFIG.CONNECTION_TYPES[connectionType],
            ...connectionDetails
        };

        try {
            const connection = this.instance.connect(defaultConnectionConfig);
            
            // Optional: Add custom overlays or labels
            if (connectionDetails.label) {
                connection.addOverlay([
                    "Label", 
                    { 
                        label: connectionDetails.label, 
                        location: 0.5 
                    }
                ]);
            }

            return connection;
        } catch (error) {
            Logger.error('Node Connection Failed', {
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id,
                errorMessage: error.message
            });
            return null;
        }
    }

    /**
     * Remove all connections and endpoints for a specific node
     * @param {string} nodeId - ID of the node to remove
     */
    removeNodeConnections(nodeId) {
        if (!this.instance) return;

        // Remove node-specific endpoints
        if (this.endpoints[nodeId]) {
            this.endpoints[nodeId].forEach(endpoint => {
                try {
                    this.instance.deleteEndpoint(endpoint);
                } catch (error) {
                    Logger.warn('Endpoint Deletion Failed', { 
                        nodeId, 
                        errorMessage: error.message 
                    });
                }
            });
            delete this.endpoints[nodeId];
        }

        // Remove node-related connections
        const connectionsToRemove = this.connections.filter(
            conn => conn.sourceId === nodeId || conn.targetId === nodeId
        );
        connectionsToRemove.forEach(conn => {
            try {
                this.instance.deleteConnection(conn);
            } catch (error) {
                Logger.warn('Connection Deletion Failed', { 
                    nodeId, 
                    errorMessage: error.message 
                });
            }
        });
    }

    /**
     * Reset the jsPlumb instance, clearing all connections and endpoints
     */
    reset() {
        if (!this.instance) return;

        try {
            // Clear connections and endpoints
            this.instance.deleteEveryConnection();
            
            // Use multiple methods for endpoint deletion
            if (this.instance.deleteEveryEndpoint) {
                this.instance.deleteEveryEndpoint();
            } else if (this.instance.deleteAllEndpoints) {
                this.instance.deleteAllEndpoints();
            }

            // Reset tracked data
            this.connections = [];
            this.endpoints = {};
        } catch (error) {
            Logger.warn('jsPlumb Reset Failed', { 
                error: error.message,
                instanceMethods: Object.keys(this.instance || {})
            });
        }
    }

    /**
     * Destroy the jsPlumb instance
     */
    destroy() {
        this.instanceCount--;

        if (this.instanceCount <= 0) {
            if (this.instance) {
                try {
                    this.reset();
                    
                    // Multiple destruction method attempts
                    if (typeof this.instance.destroy === 'function') {
                        this.instance.destroy();
                    } else if (typeof this.instance.destroyDraggable === 'function') {
                        this.instance.destroyDraggable();
                    }
                } catch (error) {
                    Logger.warn('jsPlumb Destruction Failed', { 
                        error: error.message,
                        instanceMethods: Object.keys(this.instance)
                    });
                }
                
                this.instance = null;
                this.containerRef = null;
            }
        }
    }
}

/**
 * Wrapper class for jsPlumb core functions and utilities
 */
class JsPlumbCoreWrapper {
    /**
     * Wait for DOM to be ready before initializing jsPlumb
     * @param {Function} callback - Function to execute when ready
     */
    static ready(callback) {
        try {
            jsPlumbReady(() => {
                Logger.info('jsPlumb DOM Ready');
                callback();
            });
        } catch (error) {
            Logger.error('jsPlumb Ready Failed', {
                errorMessage: error.message
            });
        }
    }

    /**
     * Create a blank endpoint with optional configuration
     * @param {Object} config - Endpoint configuration
     * @returns {Object} Blank endpoint
     */
    static createBlankEndpoint(config = {}) {
        try {
            return {
                ...BlankEndpoint,
                ...config
            };
        } catch (error) {
            Logger.error('Blank Endpoint Creation Failed', {
                errorMessage: error.message
            });
            return BlankEndpoint;
        }
    }

    /**
     * Create a dot endpoint with optional configuration
     * @param {Object} config - Endpoint configuration
     * @returns {Object} Dot endpoint
     */
    static createDotEndpoint(config = {}) {
        try {
            return {
                ...DotEndpoint,
                ...config
            };
        } catch (error) {
            Logger.error('Dot Endpoint Creation Failed', {
                errorMessage: error.message
            });
            return DotEndpoint;
        }
    }

    /**
     * Get predefined anchor locations
     * @returns {Object} Anchor locations
     */
    static getAnchorLocations() {
        return AnchorLocations;
    }
}

// Export the core wrapper along with the existing JsPlumbWrapper
export { JsPlumbCoreWrapper };
export default new JsPlumbWrapper();
