import Logger from './Logger';

// Global topology object, similar to reference project
const GlobalTopology = {
    nodes: {},
    connections: {},
    lines: {},
    networks: {},
    labinfo: {},
    theme: null,
    zoomLevel: null,
    panPosition: null
};

class TopologyManager {
    // Event listeners
    constructor() {
        // Singleton global topology
        this.topology = GlobalTopology;
        
        // Ensure topology has required properties
        if (!this.topology.nodes) {
            console.log('Initializing nodes in topology');
            this.topology.nodes = {};
        }
        
        // Event listeners
        this.eventListeners = {};

        // Connection rules based on interface types
        this.connectionRules = {
            interfaceTypeConnections: {
                'Serial': ['Serial'],
                'Ethernet': ['Ethernet']
            }
        };
    }

    /**
     * Add an event listener
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function
     */
    on(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
        return this;
    }

    /**
     * Remove an event listener
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function to remove
     */
    off(eventName, callback) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = 
                this.eventListeners[eventName].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * Emit an event
     * @param {string} eventName - Name of the event
     * @param {*} data - Event data
     */
    #emit(eventName, data) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    // Silent error handling
                }
            });
        }
    }

    /**
     * Validate connection between two interfaces
     * @param {Object} sourceInterface - Source interface details
     * @param {Object} targetInterface - Target interface details
     * @returns {boolean} Whether connection is valid
     */
    validateConnection(sourceInterface, targetInterface) {
        // Validate input interfaces
        if (!sourceInterface || !targetInterface) {
            Logger.warn('TopologyManager: Connection Validation Failed', {
                message: 'Source or target interface is undefined',
                sourceInterface,
                targetInterface
            });
            return false;
        }

        // Check if either endpoint is already in use
        const isEndpointInUse = (nodeId, interfaceName) => {
            return Object.values(this.topology.connections).some(conn => 
                (conn.sourceNode.id === nodeId && conn.sourceInterface.name === interfaceName) ||
                (conn.targetNode.id === nodeId && conn.targetInterface.name === interfaceName)
            );
        };

        // Check source endpoint usage
        if (isEndpointInUse(sourceInterface.nodeId, sourceInterface.name)) {
            Logger.warn('TopologyManager: Connection Validation Failed', {
                message: 'Source interface is already in use',
                nodeId: sourceInterface.nodeId,
                interface: sourceInterface.name
            });
            return false;
        }

        // Check target endpoint usage
        if (isEndpointInUse(targetInterface.nodeId, targetInterface.name)) {
            Logger.warn('TopologyManager: Connection Validation Failed', {
                message: 'Target interface is already in use',
                nodeId: targetInterface.nodeId,
                interface: targetInterface.name
            });
            return false;
        }

        // Normalize and validate interface types with multiple fallback strategies
        const extractInterfaceType = (interfaceObj) => {
            // Try multiple ways to extract interface type
            const typeExtractors = [
                () => interfaceObj.type,  // Direct type property
                () => interfaceObj.interfaceType,  // Alternative type property
                () => {
                    // Derive type from interface name (e.g., 'GigabitEthernet0/0' -> 'Ethernet')
                    const interfaceName = interfaceObj.name || '';
                    if (interfaceName.toLowerCase().includes('ethernet')) return 'Ethernet';
                    if (interfaceName.toLowerCase().includes('serial')) return 'Serial';
                    return undefined;
                },
                () => {
                    // Last resort: use node configuration
                    const node = this.topology.nodes[interfaceObj.nodeId];
                    const matchingInterface = node?.interfaces?.find(
                        iface => iface.name === interfaceObj.name
                    );
                    return matchingInterface?.type;
                }
            ];

            // Try extractors in order
            for (let extractor of typeExtractors) {
                const extractedType = extractor();
                if (extractedType) return extractedType.trim().toLowerCase();
            }

            return undefined;
        };

        const sourceType = extractInterfaceType(sourceInterface);
        const targetType = extractInterfaceType(targetInterface);

        // Detailed logging for type identification
        Logger.debug('TopologyManager: Connection Type Identification', {
            sourceInterface: {
                name: sourceInterface.name,
                originalType: sourceInterface.type,
                extractedType: sourceType
            },
            targetInterface: {
                name: targetInterface.name,
                originalType: targetInterface.type,
                extractedType: targetType
            }
        });

        // Validate types are present
        if (!sourceType || !targetType) {
            Logger.warn('TopologyManager: Connection Type Incompatibility', {
                sourceType,
                targetType,
                message: 'Unable to determine interface types',
                sourceInterfaceDetails: sourceInterface,
                targetInterfaceDetails: targetInterface
            });
            return false;
        }

        // Update connection rules to handle case-insensitive matching
        const allowedTypes = this.connectionRules.interfaceTypeConnections[
            sourceType.charAt(0).toUpperCase() + sourceType.slice(1)
        ] || this.connectionRules.interfaceTypeConnections[sourceType] || [];
        
        const isTypeCompatible = allowedTypes.some(
            allowedType => allowedType.toLowerCase() === targetType
        );

        if (!isTypeCompatible) {
            Logger.warn('TopologyManager: Connection Type Incompatibility', {
                sourceType,
                targetType,
                allowedTypes,
                message: 'Interfaces with incompatible types cannot be connected'
            });
            return false;
        }

        // Generate unique connection key
        const connectionKey = this.generateConnectionKey(
            {...sourceInterface, type: sourceType}, 
            {...targetInterface, type: targetType}
        );
        
        // Check for existing connection with same specific endpoints
        if (this.topology.connections[connectionKey]) {
            Logger.warn('TopologyManager: Duplicate Connection Attempt', {
                sourceInterface: sourceInterface.name,
                targetInterface: targetInterface.name,
                message: 'This specific interface connection already exists'
            });
            return false;
        }

        return true;
    }

    /**
     * Generate a unique connection key
     * @param {Object} sourceInterface - Source interface
     * @param {Object} targetInterface - Target interface
     * @returns {string} Unique connection identifier
     */
    generateConnectionKey(sourceInterface, targetInterface) {
        // Sort node IDs and interface names to ensure consistent key generation
        const sortedNodeIds = [sourceInterface.nodeId, targetInterface.nodeId].sort();
        const sortedInterfaceNames = [sourceInterface.name, targetInterface.name].sort();
        
        return `connection:${sortedNodeIds[0]}:${sortedNodeIds[1]}:${sortedInterfaceNames[0]}:${sortedInterfaceNames[1]}`;
    }

    /**
     * Create a connection between two nodes
     * @param {Object} sourceNode - Source node details
     * @param {Object} targetNode - Target node details
     * @param {Object} sourceInterface - Source interface details
     * @param {Object} targetInterface - Target interface details
     * @returns {Object|null} Created connection or null
     */
    createConnection(sourceNode, targetNode, sourceInterface, targetInterface) {
        // Comprehensive logging for connection creation attempt
        Logger.debug('TopologyManager: Connection Creation Attempt', {
            sourceNode: {
                id: sourceNode.id,
                name: sourceNode.name,
                fullObject: sourceNode
            },
            targetNode: {
                id: targetNode.id,
                name: targetNode.name,
                fullObject: targetNode
            },
            sourceInterface: {
                name: sourceInterface.name,
                type: sourceInterface.type,
                interfaceType: sourceInterface.interfaceType,
                nodeId: sourceInterface.nodeId,
                fullObject: sourceInterface
            },
            targetInterface: {
                name: targetInterface.name,
                type: targetInterface.type,
                interfaceType: targetInterface.interfaceType,
                nodeId: targetInterface.nodeId,
                fullObject: targetInterface
            }
        });

        // Validate connection before proceeding
        if (!this.validateConnection(
            {
                ...sourceInterface, 
                nodeId: sourceNode.id,
                name: sourceInterface.name
            }, 
            {
                ...targetInterface, 
                nodeId: targetNode.id,
                name: targetInterface.name
            }
        )) {
            // Validation failed, log detailed error
            Logger.warn('Connection Creation Blocked', {
                reason: 'Validation Failed',
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id,
                sourceInterface: sourceInterface.name,
                targetInterface: targetInterface.name
            });
            return null;
        }

        // Generate unique connection ID
        const connectionId = `${sourceNode.id}-${sourceInterface.name}-to-${targetNode.id}-${targetInterface.name}`;

        // Create connection object
        const connection = {
            id: connectionId,
            sourceNode: {
                id: sourceNode.id,
                name: sourceNode.name
            },
            targetNode: {
                id: targetNode.id,
                name: targetNode.name
            },
            sourceInterface: {
                name: sourceInterface.name,
                type: sourceInterface.type || sourceInterface.interfaceType
            },
            targetInterface: {
                name: targetInterface.name,
                type: targetInterface.type || targetInterface.interfaceType
            },
            timestamp: new Date().toISOString()
        };

        // Store connection in topology
        this.topology.connections[connectionId] = connection;

        // Log successful connection creation
        Logger.debug('TopologyManager: Connection Created Successfully', {
            connectionId,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceInterface: sourceInterface.name,
            targetInterface: targetInterface.name
        });

        // Emit event after successful connection creation
        this.#emit('connectionAdded', connection);

        return connection;
    }

    /**
     * Get all connections for a specific node
     * @param {string} nodeId - Node identifier
     * @returns {Array} List of connections involving the node
     */
    getTopologyNodeConnections(nodeId) {
        return Object.values(this.topology.connections)
            .filter(conn => 
                conn.sourceNode.id === nodeId || 
                conn.targetNode.id === nodeId
            );
    }

    /**
     * Add a node to the topology
     * @param {Object} node - Node details
     * @returns {Object|null} Added node or null if failed
     */
    addTopologyNode(node) {
        console.debug('Adding node:', node);
        if (!this.topology.nodes) {
            this.topology.nodes = {};
        }
        this.topology.nodes[node.id] = node;
        this.#emit('nodeAdded', node);
        console.log('Current nodes:', this.topology.nodes);
        return node;
    }

    /**
     * Add a connection to the topology
     * @param {Object} connection - Connection details
     * @returns {Object|null} Created connection or null if failed
     */
    addConnectionTopology(connection) {
        const result = this.createConnection(
            connection.sourceNode, 
            connection.targetNode, 
            connection.sourceInterface, 
            connection.targetInterface
        );
        
        if (result) {
            this.#emit('connectionAdded', result);
            Logger.debug('TopologyManager: Connection Added', {
                connectionId: result.id,
                totalConnections: Object.keys(this.topology.connections).length
            });
        }

        return result;
    }

    /**
     * Remove a node from the topology
     * @param {string} nodeId - ID of the node to remove
     * @returns {Object|null} Removed node or null if not found
     */
    removeTopologyNode(nodeId) {
        console.debug('TopologyManager: Before node removal - Connections:', this.topology.connections);
        
        // Find and remove all connections associated with this node
        const connectionsToRemove = Object.entries(this.topology.connections)
            .filter(([_, connection]) => 
                connection.sourceNode.id === nodeId || 
                connection.targetNode.id === nodeId
            );

        // Log connections being removed
        Logger.debug('TopologyManager: Removing connections for node', {
            nodeId,
            connectionsToRemove: connectionsToRemove.map(([key]) => key),
            connectionCount: connectionsToRemove.length
        });

        // Remove each connection and emit events
        connectionsToRemove.forEach(([key, connection]) => {
            // Remove the connection
            delete this.topology.connections[key];
            
            // Emit event for connection removal
            this.#emit('connectionRemoved', connection);
            
            Logger.debug('TopologyManager: Connection removed:', {
                connectionId: key,
                remainingConnections: Object.keys(this.topology.connections).length
            });
        });

        // Remove the node from topology
        const removedNode = this.topology.nodes[nodeId];
        delete this.topology.nodes[nodeId];

        console.debug('TopologyManager: After node removal - Connections:', {
            connections: this.topology.connections,
            connectionCount: Object.keys(this.topology.connections).length
        });

        // Log the node removal
        Logger.debug('TopologyManager: Node Removed from Topology', { 
            nodeId, 
            remainingNodes: Object.keys(this.topology.nodes).length,
            remainingConnections: Object.keys(this.topology.connections).length,
            connectionsBefore: connectionsToRemove.length,
            connectionsAfter: Object.keys(this.topology.connections).length
        });

        // Emit event after successful node removal
        if (removedNode) {
            this.#emit('nodeRemoved', removedNode);
        }

        return removedNode;
    }

    /**
     * Remove a connection from the topology
     * @param {string} connectionId - ID of the connection to remove
     * @returns {Object|null} Removed connection or null if not found
     */
    removeConnectionTopology(connectionId) {
        const connection = this.topology.connections[connectionId];
        if (connection) {
            delete this.topology.connections[connectionId];
            this.#emit('connectionRemoved', connection);
            
            Logger.debug('TopologyManager: Connection Removed', {
                connectionId,
                remainingConnections: Object.keys(this.topology.connections).length
            });

            return connection;
        }
        return null;
    }

    /**
     * Reset entire topology
     */
    resetTopology() {
        this.topology.nodes = {};
        this.topology.connections = {};
        this.topology.lines = {};
        this.topology.networks = {};
        this.topology.labinfo = {};
        
        Logger.debug('TopologyManager: Topology Reset');
    }

    /**
     * Get current topology data for saving
     * @returns {Object} Comprehensive topology configuration
     */
    getTopology() {
        // Capture full node and connection details for exact re-rendering
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            nodes: Object.entries(this.topology.nodes).reduce((acc, [nodeId, node]) => {
                acc[nodeId] = {
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    position: node.position,
                    size: node.size || { width: 100, height: 100 }, // Default size if not specified
                    icon: node.icon, // Capture full icon path
                    endpoints: node.endpoints || [], // Capture all endpoint details
                    properties: node.properties || {}, // Capture any additional node properties
                    interfaces: node.interfaces || [] // Capture interface details
                };
                return acc;
            }, {}),
            connections: Object.entries(this.topology.connections).reduce((acc, [connId, conn]) => {
                acc[connId] = {
                    id: connId,
                    sourceNode: {
                        id: conn.sourceNode.id,
                        interface: conn.sourceInterface?.name,
                        interfaceType: conn.sourceInterface?.type
                    },
                    targetNode: {
                        id: conn.targetNode.id,
                        interface: conn.targetInterface?.name,
                        interfaceType: conn.targetInterface?.type
                    },
                    connectionStyle: conn.connectionStyle || {}, // Capture connection styling
                    properties: conn.properties || {} // Capture any additional connection properties
                };
                return acc;
            }, {}),
            uiState: {
                // Capture any global UI state that might be relevant for re-rendering
                theme: GlobalTopology.theme,
                zoomLevel: GlobalTopology.zoomLevel,
                panPosition: GlobalTopology.panPosition
            }
        };
    }

    /**
     * Save topology configuration to a file
     * @param {string} filename - Optional filename for saving
     * @returns {Object} Saved configuration
     */
    saveTopology(filename = null) {
        const config = this.getTopology();
        
        // Validate configuration
        if (Object.keys(config.nodes).length === 0) {
            Logger.warn('TopologyManager: No nodes to save');
            return null;
        }

        // Optional file saving logic (for future implementation)
        if (filename) {
            // Placeholder for file saving mechanism
            Logger.debug('Saving topology to file:', filename);
        }

        // Emit save event with full configuration
        this.#emit('topologySaved', config);

        return config;
    }

    /**
     * Load topology configuration
     * @param {Object} config - Topology configuration to load
     * @returns {boolean} Whether loading was successful
     */
    loadTopology(config) {
        try {
            // Validate input
            if (!config || !config.nodes || !config.connections) {
                Logger.error('TopologyManager: Invalid topology configuration');
                return false;
            }

            Logger.debug('TopologyManager: Starting topology load', {
                nodeCount: Object.keys(config.nodes).length,
                connectionCount: Object.keys(config.connections).length,
                config
            });

            // Reset current topology
            this.resetTopology();

            // First, restore all nodes
            Object.entries(config.nodes).forEach(([nodeId, nodeData]) => {
                this.topology.nodes[nodeId] = {
                    ...nodeData,
                    id: nodeData.id,
                    type: nodeData.type,
                    name: nodeData.name,
                    position: nodeData.position || { x: 0, y: 0 },
                    size: nodeData.size || { width: 100, height: 100 },
                    icon: nodeData.icon,
                    endpoints: nodeData.endpoints || [],
                    properties: nodeData.properties || {},
                    interfaces: nodeData.interfaces || []
                };

                // Emit node added event
                this.#emit('nodeAdded', this.topology.nodes[nodeId]);
            });

            // Then restore all connections
            Object.entries(config.connections).forEach(([connId, connData]) => {
                try {
                    // Find source and target nodes
                    const sourceNode = this.topology.nodes[connData.sourceNode.id];
                    const targetNode = this.topology.nodes[connData.targetNode.id];

                    if (!sourceNode || !targetNode) {
                        Logger.warn('TopologyManager: Skipping connection due to missing nodes', {
                            connectionId: connId,
                            sourceNodeId: connData.sourceNode.id,
                            targetNodeId: connData.targetNode.id
                        });
                        return;
                    }

                    // Create connection with proper structure
                    this.topology.connections[connId] = {
                        id: connId,
                        sourceNode: {
                            id: sourceNode.id,
                            name: sourceNode.name
                        },
                        targetNode: {
                            id: targetNode.id,
                            name: targetNode.name
                        },
                        sourceInterface: {
                            name: connData.sourceNode.interface,
                            type: connData.sourceNode.interfaceType
                        },
                        targetInterface: {
                            name: connData.targetNode.interface,
                            type: connData.targetNode.interfaceType
                        },
                        connectionStyle: connData.connectionStyle || {},
                        properties: connData.properties || {}
                    };

                    // Emit connection added event
                    this.#emit('connectionAdded', this.topology.connections[connId]);

                } catch (error) {
                    Logger.error('TopologyManager: Error restoring connection', {
                        connectionId: connId,
                        error: error.message,
                        connectionData: connData
                    });
                }
            });

            // Restore UI state if available
            if (config.uiState) {
                GlobalTopology.theme = config.uiState.theme;
                GlobalTopology.zoomLevel = config.uiState.zoomLevel;
                GlobalTopology.panPosition = config.uiState.panPosition;
            }

            // Log final state
            Logger.info('TopologyManager: Topology loaded successfully', {
                nodeCount: Object.keys(this.topology.nodes).length,
                connectionCount: Object.keys(this.topology.connections).length,
                nodes: Object.keys(this.topology.nodes),
                connections: Object.keys(this.topology.connections)
            });

            // Emit load event with full topology
            this.#emit('topologyLoaded', {
                nodes: this.topology.nodes,
                connections: this.topology.connections,
                uiState: config.uiState
            });

            return true;

        } catch (error) {
            Logger.error('TopologyManager: Failed to load topology', {
                error: error.message,
                stack: error.stack,
                config
            });
            return false;
        }
    }

    /**
     * Get topology network statistics
     * @returns {Object} Network statistics
     */
    getTopologyNetworkStatistics() {
        return {
            totalNodes: Object.keys(this.topology.nodes).length,
            totalConnections: Object.keys(this.topology.connections).length,
            totalEndpoints: Object.values(this.topology.nodes)
                .reduce((total, node) => total + (node.interfaces?.length || 0), 0)
        };
    }

    /**
     * Get all unique nodes in the network
     * @returns {Array} List of unique nodes
     */
    getTopologyAllNodes() {
        // Get nodes directly from topology
        const nodes = Object.values(this.topology.nodes || {});
        console.debug('TopologyManager: Getting all nodes:', nodes);
        return nodes;
    }

    /**
     * Get all connections in the network
     * @returns {Array} List of connections
     */
    getTopologyAllConnections() {
        const connections = Object.values(this.topology.connections || {});
        console.debug('TopologyManager: Getting all connections:', {
            connections,
            count: connections.length,
            rawConnections: this.topology.connections
        });
        return connections;
    }

    /**
     * Get all endpoints in the network
     * @returns {Array} List of all endpoints from all nodes
     */
    getTopologyEndpoints() {
        const endpoints = [];
        
        // Get all nodes
        const nodes = Object.values(this.topology.nodes || {});
        
        // Collect all endpoints from each node
        nodes.forEach(node => {
            if (node.endpoints) {
                endpoints.push(...node.endpoints);
            }
        });

        console.debug('TopologyManager: All endpoints:', endpoints);
        return endpoints;
    }

    /**
     * Register a new node in the connection manager
     * @param {Object} nodeData - Raw node data
     * @param {Object} libraryNodeData - Library-specific node representation
     * @returns {string} Node registration ID
     */
    registerTopologyNode(nodeData, libraryNodeData = {}) {
        // Validate node data
        if (!nodeData) {
            throw new Error('TopologyManager: Cannot register undefined node');
        }

        if (!nodeData.id) {
            throw new Error('TopologyManager: Node must have an ID');
        }

        if (!nodeData.name) {
            nodeData.name = libraryNodeData.name || `Node-${nodeData.id}`;
        }

        // Store node in global topology
        this.topology.nodes[nodeData.id] = {
            ...nodeData,
            libraryData: libraryNodeData,
            connections: []  // Track connections for this node
        };

        // Log node registration
        Logger.info('TopologyManager: Node Registered', {
            nodeId: nodeData.id,
            nodeName: nodeData.name,
            type: nodeData.type,
            libraryDataAvailable: !!libraryNodeData
        });

        // Emit event after successful node registration
        this.#emit('nodeAdded', nodeData);

        return nodeData.id;  // Return node ID as registration result
    }

    /**
     * Get a registered node by its ID
     * @param {string} nodeId - Node identifier
     * @returns {Object|null} Node details or null if not found
     */
    getTopologyNode(nodeId) {
        return this.topology.nodes[nodeId] || null;
    }

    /**
     * Check if an endpoint is available for connections
     * @param {Object} endpoint - Endpoint to check
     * @returns {boolean} Whether the endpoint is available for connections
     */
    isEndpointAvailable(endpoint) {
        // Validate endpoint input
        if (!endpoint || !endpoint.nodeId) {
            Logger.warn('TopologyManager: Endpoint Availability Check Failed', {
                message: 'Invalid or incomplete endpoint',
                endpoint
            });
            return false;
        }

        // Find existing connections for this endpoint
        const existingConnections = Object.values(this.topology.connections)
            .filter(conn => 
                (conn.sourceInterface.name === endpoint.name && conn.sourceNode.id === endpoint.nodeId) ||
                (conn.targetInterface.name === endpoint.name && conn.targetNode.id === endpoint.nodeId)
            );

        // Log connection details for debugging
        Logger.debug('TopologyManager: Endpoint Availability Check', {
            endpointName: endpoint.name,
            nodeId: endpoint.nodeId,
            existingConnectionCount: existingConnections.length,
            existingConnections: existingConnections.map(conn => ({
                id: conn.id,
                sourceNode: conn.sourceNode.id,
                targetNode: conn.targetNode.id
            }))
        });

        // Endpoint is available if no existing connections exist
        return existingConnections.length === 0;
    }

    /**
     * Get available endpoints for a node
     * @param {string} nodeId - Node identifier
     * @returns {Array} List of available endpoints
     */
    getTopologyAvailableEndpoints(nodeId) {
        const node = this.topology.nodes[nodeId];
        
        if (!node || !node.endpoints) {
            Logger.warn('TopologyManager: Available Endpoints Check Failed', {
                message: 'Node not found or has no endpoints',
                nodeId
            });
            return [];
        }

        return node.endpoints.filter(endpoint => this.isEndpointAvailable(endpoint));
    }
}

// Export a singleton instance
export default new TopologyManager();
