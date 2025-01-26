import { NETWORK_DIAGRAM_CONFIG, makeId } from './NetworkDiagramConfig';
import Logger from './Logger';

/**
 * Abstract Connection Manager
 * Provides a flexible interface for managing network connections
 */
export class ConnectionManager {
    constructor(library = null) {
        this.library = library;
        
        // Comprehensive connection tracking
        this.connections = {
            byEndpoint: new Map(),  // Track connections per endpoint
            byNode: new Map(),      // Track connections per node
            total: 0                // Total connections across the network
        };
        
        this.nodeRegistry = {};
        this.usedEndpoints = new Map();
        
        // Configurable connection limits
        this.MAX_ENDPOINT_CONNECTIONS = 60;  // Maximum connections per endpoint
        this.MAX_NODE_CONNECTIONS = 120;     // Maximum total connections per node

        // Node connection usage tracking
        this.nodeConnectionUsage = new Map();
        this.deviceTypeCount = {};
    }

    /**
     * Check if a node is registered
     * @param {string} nodeId - ID of the node to check
     * @returns {boolean} Whether the node is registered
     * @throws {Error} If node registry information is incomplete
     */
    isNodeRegistered(nodeId) {
        const nodeRegistry = this.nodeRegistry[nodeId];
        if (!nodeRegistry) {
            throw new Error(`Node with ID ${nodeId} is not registered in the node registry`);
        }

        if (!nodeRegistry.data || !nodeRegistry.data.name) {
            throw new Error(`Node with ID ${nodeId} is missing required name information. 
                Ensure all nodes are properly initialized with a name during registration.`);
        }

        const isRegistered = true;
        
        Logger.info('Node Registration Check', {
            nodeId,
            nodeName: nodeRegistry.data.name,
            isRegistered,
            registeredNodes: Object.keys(this.nodeRegistry).map(id => {
                const reg = this.nodeRegistry[id];
                if (!reg.data || !reg.data.name) {
                    throw new Error(`Incomplete node registry for ID ${id}. 
                        All nodes must have a name during registration.`);
                }
                return `${id}: ${reg.data.name}`;
            })
        });

        return isRegistered;
    }

    /**
     * Register a new node in the connection manager with a unique name
     * @param {Object} nodeData - Raw node data
     * @param {Object} libraryNodeData - Library-specific node representation
     * @returns {string} Node registration ID
     * @throws {Error} If node data is incomplete
     */
    registerNode(nodeData, libraryNodeData) {
        // Validate node data
        if (!nodeData) {
            throw new Error('Cannot register undefined node');
        }

        if (!nodeData.type) {
            throw new Error('Node must have a type');
        }

        if (!nodeData.name) {
            // If no name is provided, check libraryNodeData
            if (libraryNodeData && libraryNodeData.name) {
                nodeData.name = libraryNodeData.name;
            } else {
                throw new Error('Node must have a name during registration');
            }
        }

        // Generate a unique node registration ID
        const registrationId = makeId();

        // Store node in registry with additional metadata
        this.nodeRegistry[nodeData.id] = {
            id: registrationId,
            data: nodeData,
            libraryNode: libraryNodeData,
            connections: []  // Track connections for this node
        };

        Logger.info('Node Registered', {
            nodeId: nodeData.id,
            nodeName: nodeData.name,
            type: nodeData.type,
            registrationId,
            endpoints: nodeData.endpoints?.length || 0
        });

        return registrationId;
    }

    /**
     * Generate a unique endpoint key that considers both node and endpoint
     * @param {Object} endpoint - Endpoint object
     * @returns {string} Unique endpoint key
     * @throws {Error} If endpoint or node information is incomplete
     */
    generateUniqueEndpointKey(endpoint) {
        if (!endpoint) {
            throw new Error('Cannot generate key for undefined endpoint');
        }

        if (!endpoint.nodeId) {
            throw new Error('Endpoint must have a valid nodeId');
        }

        // Retrieve node registry and validate
        const nodeRegistry = this.nodeRegistry[endpoint.nodeId];
        if (!nodeRegistry) {
            throw new Error(`No registry found for node ID: ${endpoint.nodeId}`);
        }

        if (!nodeRegistry.data || !nodeRegistry.data.name) {
            throw new Error(`Node with ID ${endpoint.nodeId} is missing required name information`);
        }

        // Combine node name, endpoint name, and any other unique identifiers
        return `${nodeRegistry.data.name}-${endpoint.name}-${endpoint.uuid || 'NO_UUID'}`;
    }

    /**
     * Get current connections for a specific endpoint
     * @param {string} endpointKey - Unique endpoint identifier
     * @returns {Array} Current connections for the endpoint
     */
    getEndpointConnections(endpointKey) {
        return this.connections.byEndpoint.get(endpointKey) || [];
    }

    /**
     * Check if an endpoint is available for connection
     * @param {Object} endpoint - Endpoint to check
     * @returns {boolean} Whether the endpoint is available
     * @throws {Error} If endpoint or node information is incomplete
     */
    isEndpointAvailable(endpoint) {
        if (!endpoint) {
            throw new Error('Cannot check availability for undefined endpoint');
        }

        if (!endpoint.nodeId) {
            throw new Error('Endpoint must have a valid nodeId');
        }

        const endpointKey = this.generateUniqueEndpointKey(endpoint);
        const currentConnections = this.getEndpointConnections(endpointKey);
        
        // Retrieve node registry (already validated in generateUniqueEndpointKey)
        const nodeRegistry = this.nodeRegistry[endpoint.nodeId];

        // Determine max connections based on endpoint type
        const maxConnectionsByType = {
            'ethernet': 10000,     // Most standard Ethernet ports support 2 connections
            'gigabitethernet': 40000,  // Some GigabitEthernet ports support more
            'fastethernet': 20000,  // FastEthernet typically supports 2 connections
            'serial': 20000,           // Serial interfaces typically support fewer connections
            'default': 1           // Default to 1 connection if type is unknown
        };

        // Get max connections for this endpoint type, default to 1 if not specified
        const maxConnections = maxConnectionsByType[endpoint.type?.toLowerCase()] || maxConnectionsByType['default'];

        // Additional tracking mechanism to ensure accurate connection counting
        const uniqueConnectionsCount = new Set(currentConnections.map(conn => 
            `${conn.targetNode}-${conn.targetEndpoint}`
        )).size;

        const isAvailable = uniqueConnectionsCount < maxConnections;
        
        Logger.info('Endpoint Availability Detailed Check', {
            nodeName: nodeRegistry.data.name,
            nodeId: endpoint.nodeId,
            endpointName: endpoint.name,
            endpointType: endpoint.type,
            currentConnectionEntries: currentConnections.length,
            uniqueConnectionsCount,
            maxConnections,
            isAvailable,
            connectionDetails: currentConnections.map(conn => ({
                targetNode: conn.targetNode,
                targetEndpoint: conn.targetEndpoint
            }))
        });

        return isAvailable;
    }

    /**
     * Validate connection parameters
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @param {Object} sourceEndpoint - Source endpoint
     * @param {Object} targetEndpoint - Target endpoint
     * @throws {Error} If connection parameters are invalid
     */
    validateConnectionParameters(sourceNode, targetNode, sourceEndpoint, targetEndpoint) {
        // Validate nodes
        if (!sourceNode || !targetNode) {
            throw new Error('Invalid source or target node: Both nodes must be defined');
        }

        // Validate node names
        if (!sourceNode.name || !targetNode.name) {
            throw new Error('Invalid node names: Both source and target nodes must have names');
        }

        // Validate endpoints
        if (!sourceEndpoint || !targetEndpoint) {
            throw new Error('Source and target endpoints must be specified');
        }

        // Prevent connections between the same node
        if (sourceNode.id === targetNode.id) {
            Logger.error('Connection Creation Failed', {
                reason: 'Same Node Connection',
                sourceNodeId: sourceNode.id,
                sourceNodeName: sourceNode.name,
                targetNodeId: targetNode.id,
                targetNodeName: targetNode.name
            });

            throw new Error(`Cannot create connection between endpoints of the same node: ${sourceNode.name}`);
        }
    }

    /**
     * Track connection usage for a specific node
     * @param {string} nodeId - ID of the node
     * @param {boolean} increment - Whether to increment or decrement connections
     * @param {Object} nodeInfo - Additional node information
     * @throws {Error} If node information is incomplete
     */
    updateNodeConnectionUsage(nodeId, increment = true, nodeInfo = {}) {
        // Validate node registry
        const nodeRegistry = this.nodeRegistry[nodeId];
        if (!nodeRegistry) {
            throw new Error(`No registry found for node ID: ${nodeId}`);
        }

        if (!nodeRegistry.data || !nodeRegistry.data.name) {
            throw new Error(`Node with ID ${nodeId} is missing required name information`);
        }

        // Initialize or update node connection tracking
        if (!this.nodeConnectionUsage.has(nodeId)) {
            this.nodeConnectionUsage.set(nodeId, {
                id: nodeId,
                name: nodeRegistry.data.name,
                totalEndpoints: 6,  // Default total endpoints
                usedConnections: 0,
                availableConnections: 6
            });
        }

        const nodeConnections = this.nodeConnectionUsage.get(nodeId);
        
        Logger.info('Node Connection Usage Update', {
            nodeId,
            nodeName: nodeConnections.name,
            increment,
            currentUsedConnections: nodeConnections.usedConnections,
            totalEndpoints: nodeConnections.totalEndpoints
        });

        // Update connection counts
        nodeConnections.usedConnections += increment ? 1 : -1;
        nodeConnections.availableConnections = nodeConnections.totalEndpoints - nodeConnections.usedConnections;
    }

    /**
     * Get connection usage for a specific node
     * @param {string} nodeId - ID of the node
     * @returns {Object} Node connection usage details
     */
    getNodeConnectionUsage(nodeId) {
        return this.nodeConnectionUsage.get(nodeId) || {
            totalEndpoints: 6,
            usedConnections: 0,
            availableConnections: 6
        };
    }

    /**
     * Create a connection between two nodes
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @param {string} connectionType - Type of connection
     * @param {Object} sourceEndpoint - Source endpoint
     * @param {Object} targetEndpoint - Target endpoint
     * @returns {Object} Created connection details
     */
    createConnection(sourceNode, targetNode, connectionType = 'ETHERNET', sourceEndpoint = null, targetEndpoint = null) {
        // Validate connection parameters first
        this.validateConnectionParameters(sourceNode, targetNode, sourceEndpoint, targetEndpoint);

        // Attach node IDs to endpoints for precise tracking
        sourceEndpoint.nodeId = sourceNode.id;
        targetEndpoint.nodeId = targetNode.id;

        // Generate unique keys for endpoints
        const sourceEndpointKey = this.generateUniqueEndpointKey(sourceEndpoint);
        const targetEndpointKey = this.generateUniqueEndpointKey(targetEndpoint);

        // Get current connections
        const sourceConnections = this.getEndpointConnections(sourceEndpointKey);
        const targetConnections = this.getEndpointConnections(targetEndpointKey);

        // Check for unique connection
        if (!this.isConnectionUnique(sourceEndpoint, targetEndpoint)) {
            Logger.error('Connection Creation Failed', {
                reason: 'Duplicate Connection',
                sourceNode: {
                    id: sourceNode.id,
                    name: sourceNode.name
                },
                sourceEndpoint: `${sourceEndpoint.name} (Node: ${sourceEndpoint.nodeId})`,
                targetNode: {
                    id: targetNode.id,
                    name: targetNode.name
                },
                targetEndpoint: `${targetEndpoint.name} (Node: ${targetEndpoint.nodeId})`,
                totalConnections: this.connections.total
            });

            throw new Error(`Connection between ${sourceEndpoint.name} (Node: ${sourceEndpoint.nodeId}) and ${targetEndpoint.name} (Node: ${targetEndpoint.nodeId}) already exists`);
        }

        // Detailed connection limit checks
        if (sourceConnections.length >= this.MAX_ENDPOINT_CONNECTIONS) {
            Logger.error('Connection Creation Failed', {
                reason: 'Source Endpoint Connection Limit Reached',
                sourceNode: {
                    id: sourceNode.id,
                    name: sourceNode.name
                },
                sourceEndpoint: `${sourceEndpoint.name} (Node: ${sourceEndpoint.nodeId})`,
                sourceConnections: sourceConnections.length,
                maxEndpointConnections: this.MAX_ENDPOINT_CONNECTIONS
            });

            throw new Error(`Cannot establish connection: 
                Source endpoint ${sourceEndpoint.name} (Node: ${sourceEndpoint.nodeId}) has ${sourceConnections.length} connections. 
                Maximum allowed per endpoint: ${this.MAX_ENDPOINT_CONNECTIONS}`);
        }

        if (targetConnections.length >= this.MAX_ENDPOINT_CONNECTIONS) {
            Logger.error('Connection Creation Failed', {
                reason: 'Target Endpoint Connection Limit Reached',
                targetNode: {
                    id: targetNode.id,
                    name: targetNode.name
                },
                targetEndpoint: `${targetEndpoint.name} (Node: ${targetEndpoint.nodeId})`,
                targetConnections: targetConnections.length,
                maxEndpointConnections: this.MAX_ENDPOINT_CONNECTIONS
            });

            throw new Error(`Cannot establish connection: 
                Target endpoint ${targetEndpoint.name} (Node: ${targetEndpoint.nodeId}) has ${targetConnections.length} connections. 
                Maximum allowed per endpoint: ${this.MAX_ENDPOINT_CONNECTIONS}`);
        }

        // Create connection object
        const connectionId = this.generateConnectionId(sourceNode, targetNode);
        const connection = {
            id: connectionId,
            sourceNode: sourceNode.id,
            targetNode: targetNode.id,
            sourceEndpoint: sourceEndpoint.name,
            targetEndpoint: targetEndpoint.name,
            type: connectionType,
            timestamp: new Date().toISOString()
        };

        // Update connection tracking
        this.trackConnection(connection, sourceEndpointKey, targetEndpointKey);

        // Update node connection usage
        this.updateNodeConnectionUsage(sourceNode.id, true, { name: sourceNode.name });
        this.updateNodeConnectionUsage(targetNode.id, true, { name: targetNode.name });

        // Logging for connection establishment
        Logger.info('Connection Established', {
            connectionType,
            sourceNode: {
                id: sourceNode.id,
                name: sourceNode.name
            },
            sourceEndpoint: `${sourceEndpoint.name} (Node: ${sourceEndpoint.nodeId})`,
            targetNode: {
                id: targetNode.id,
                name: targetNode.name
            },
            targetEndpoint: `${targetEndpoint.name} (Node: ${targetEndpoint.nodeId})`,
            totalConnections: this.connections.total
        });

        return connection;
    }

    /**
     * Track a new connection
     * @param {Object} connection - Connection details
     * @param {string} sourceEndpointKey - Source endpoint key
     * @param {string} targetEndpointKey - Target endpoint key
     */
    trackConnection(connection, sourceEndpointKey, targetEndpointKey) {
        // Track by endpoint
        const updateEndpointConnections = (endpointKey) => {
            const currentConnections = this.connections.byEndpoint.get(endpointKey) || [];
            this.connections.byEndpoint.set(endpointKey, [...currentConnections, connection]);
        };

        updateEndpointConnections(sourceEndpointKey);
        updateEndpointConnections(targetEndpointKey);

        // Track by node
        const updateNodeConnections = (nodeId) => {
            const currentNodeConnections = this.connections.byNode.get(nodeId) || [];
            this.connections.byNode.set(nodeId, [...currentNodeConnections, connection]);
        };

        updateNodeConnections(connection.sourceNode);
        updateNodeConnections(connection.targetNode);

        // Increment total connections
        this.connections.total++;

        // Detailed logging for connection tracking
        Logger.info('Connection Tracking Details', {
            connectionId: connection.id,
            sourceEndpointKey,
            targetEndpointKey,
            sourceNode: connection.sourceNode,
            targetNode: connection.targetNode,
            sourceEndpoint: connection.sourceEndpoint,
            targetEndpoint: connection.targetEndpoint,
            totalConnections: this.connections.total,
            byEndpointConnections: {
                [sourceEndpointKey]: this.connections.byEndpoint.get(sourceEndpointKey)?.length || 0,
                [targetEndpointKey]: this.connections.byEndpoint.get(targetEndpointKey)?.length || 0
            },
            byNodeConnections: {
                [connection.sourceNode]: this.connections.byNode.get(connection.sourceNode)?.length || 0,
                [connection.targetNode]: this.connections.byNode.get(connection.targetNode)?.length || 0
            }
        });
    }

    /**
     * Generate a unique connection ID
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @returns {string} Unique connection identifier
     */
    generateConnectionId(sourceNode, targetNode) {
        return `connection-${sourceNode.id}-${targetNode.id}-${Date.now()}`;
    }

    /**
     * Remove a connection
     * @param {string} connectionId - ID of connection to remove
     */
    removeConnection(connectionId) {
        // Find the connection details
        const connection = this.findConnectionById(connectionId);
        
        if (connection) {
            // Update node connection usage (decrement)
            this.updateNodeConnectionUsage(connection.sourceNode, false);
            this.updateNodeConnectionUsage(connection.targetNode, false);

            // Remove connection from tracking
            this.untrackConnection(connection);

            // Logging for connection removal
            Logger.info('Connection Removed', { 
                connectionId,
                sourceNode: connection.sourceNode,
                targetNode: connection.targetNode,
                remainingConnections: this.connections.total
            });
        }
    }

    /**
     * Find a connection by its ID
     * @param {string} connectionId - ID of the connection to find
     * @returns {Object|null} Connection details or null if not found
     */
    findConnectionById(connectionId) {
        // Implement logic to find connection across all tracked connections
        for (let [endpointKey, connections] of this.connections.byEndpoint) {
            const foundConnection = connections.find(conn => conn.id === connectionId);
            if (foundConnection) return foundConnection;
        }
        return null;
    }

    /**
     * Untrack a connection
     * @param {Object} connection - Connection to untrack
     */
    untrackConnection(connection) {
        // Remove from endpoint-based tracking
        const updateEndpointConnections = (endpointKey) => {
            const currentConnections = this.connections.byEndpoint.get(endpointKey) || [];
            this.connections.byEndpoint.set(
                endpointKey, 
                currentConnections.filter(conn => conn.id !== connection.id)
            );
        };

        // Generate endpoint keys
        const sourceEndpointKey = this.generateUniqueEndpointKey({
            nodeId: connection.sourceNode,
            name: connection.sourceEndpoint
        });
        const targetEndpointKey = this.generateUniqueEndpointKey({
            nodeId: connection.targetNode,
            name: connection.targetEndpoint
        });

        // Update tracking
        updateEndpointConnections(sourceEndpointKey);
        updateEndpointConnections(targetEndpointKey);

        // Decrement total connections
        this.connections.total = Math.max(0, this.connections.total - 1);
    }

    /**
     * Get all connections for a specific node
     * @param {string} nodeId - ID of the node
     * @returns {Array} List of connections
     */
    getNodeConnections(nodeId) {
        const nodeRegistry = this.nodeRegistry[nodeId];
        return nodeRegistry ? nodeRegistry.connections : [];
    }

    /**
     * Check if a connection already exists between two specific endpoints
     * @param {Object} sourceEndpoint - Source endpoint
     * @param {Object} targetEndpoint - Target endpoint
     * @returns {boolean} Whether the connection already exists
     */
    isConnectionUnique(sourceEndpoint, targetEndpoint) {
        if (!sourceEndpoint || !targetEndpoint) {
            Logger.warn('Connection Uniqueness Check', {
                message: 'Invalid source or target endpoint',
                sourceEndpoint,
                targetEndpoint
            });
            return false;
        }

        // Ensure both endpoints have nodeId
        if (!sourceEndpoint.nodeId || !targetEndpoint.nodeId) {
            Logger.warn('Connection Uniqueness Check', {
                message: 'Endpoint missing nodeId',
                sourceNodeId: sourceEndpoint.nodeId,
                targetNodeId: targetEndpoint.nodeId
            });
            return false;
        }

        // Generate unique endpoint keys
        const sourceEndpointKey = this.generateUniqueEndpointKey(sourceEndpoint);
        const targetEndpointKey = this.generateUniqueEndpointKey(targetEndpoint);

        // Get current connections for the source endpoint
        const sourceConnections = this.getEndpointConnections(sourceEndpointKey);

        // Check if a connection to the target endpoint already exists
        const existingConnection = sourceConnections.find(conn => {
            // Check if the connection involves the same target node and endpoint
            return conn.targetNode === targetEndpoint.nodeId && 
                   conn.targetEndpoint === targetEndpoint.name;
        });

        Logger.info('Connection Uniqueness Check', {
            sourceEndpointKey,
            targetEndpointKey,
            sourceNodeId: sourceEndpoint.nodeId,
            targetNodeId: targetEndpoint.nodeId,
            sourceEndpointName: sourceEndpoint.name,
            targetEndpointName: targetEndpoint.name,
            existingConnectionFound: !!existingConnection,
            sourceConnectionCount: sourceConnections.length
        });

        return !existingConnection;
    }
}

// Export a default instance that can be imported and used globally
export default new ConnectionManager();
