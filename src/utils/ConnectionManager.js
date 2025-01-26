import { NETWORK_DIAGRAM_CONFIG, PerformanceLogger } from './NetworkDiagramConfig';

/**
 * Abstract Connection Manager
 * Provides a flexible interface for managing network connections
 */
export class ConnectionManager {
    constructor(library = null) {
        this.library = library;
        this.connections = [];
        this.nodeRegistry = {};
    }

    /**
     * Check if a node is registered
     * @param {string} nodeId - ID of the node to check
     * @returns {boolean} Whether the node is registered
     */
    isNodeRegistered(nodeId) {
        const isRegistered = !!this.nodeRegistry[nodeId];
        
        PerformanceLogger.log('Node Registration Check', {
            nodeId,
            isRegistered,
            registeredNodes: Object.keys(this.nodeRegistry)
        });

        return isRegistered;
    }

    /**
     * Register a node with the connection manager
     * @param {Object} node - Node to register
     * @param {Object} librarySpecificNode - Library-specific node representation
     * @returns {boolean} Registration success status
     */
    registerNode(node, librarySpecificNode = null) {
        // Comprehensive node validation
        if (!node || !node.id) {
            PerformanceLogger.error('Node Registration Failed', new Error('Invalid node: Missing ID'), {
                node: JSON.stringify(node),
                libraryNode: JSON.stringify(librarySpecificNode)
            });
            return false;
        }

        // Check if node is already registered
        if (this.isNodeRegistered(node.id)) {
            PerformanceLogger.log('Node Already Registered', { 
                nodeId: node.id,
                existingNode: JSON.stringify(this.nodeRegistry[node.id])
            });
            return true;
        }

        // Log detailed node information
        PerformanceLogger.log('Node Registration Attempt', {
            nodeId: node.id,
            nodeType: node.type,
            libraryNodePresent: !!librarySpecificNode
        });

        // Store node in registry
        this.nodeRegistry[node.id] = {
            node,
            libraryNode: librarySpecificNode || {},
            connections: []
        };

        PerformanceLogger.log('Node Registered Successfully', { 
            nodeId: node.id, 
            type: node.type,
            registeredNodes: Object.keys(this.nodeRegistry)
        });

        return true;
    }

    /**
     * Create a connection between two nodes
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @param {string} connectionType - Type of connection
     * @returns {Object|null} Created connection
     */
    createConnection(sourceNode, targetNode, connectionType = 'ETHERNET') {
        // Detailed validation logging
        PerformanceLogger.log('Connection Attempt', {
            sourceNodeId: sourceNode?.id, 
            targetNodeId: targetNode?.id,
            connectionType,
            registeredNodes: Object.keys(this.nodeRegistry)
        });

        // Validate source and target nodes
        const sourceRegistry = this.nodeRegistry[sourceNode?.id];
        const targetRegistry = this.nodeRegistry[targetNode?.id];

        // Detailed error logging for node registration issues
        if (!sourceRegistry || !targetRegistry) {
            PerformanceLogger.error('Connection Creation Failed', new Error(`Invalid nodes: 
                Source Node Registry: ${!!sourceRegistry}, 
                Target Node Registry: ${!!targetRegistry}
                Source Node ID: ${sourceNode?.id}, 
                Target Node ID: ${targetNode?.id}
                Registered Nodes: ${JSON.stringify(Object.keys(this.nodeRegistry))}`));
            return null;
        }

        // Check connection limits
        if (sourceRegistry.connections.length >= NETWORK_DIAGRAM_CONFIG.CONSTRAINTS.MAX_CONNECTIONS_PER_NODE) {
            PerformanceLogger.error('Connection Limit Exceeded', { 
                sourceNodeId: sourceNode.id,
                currentConnections: sourceRegistry.connections.length,
                maxConnections: NETWORK_DIAGRAM_CONFIG.CONSTRAINTS.MAX_CONNECTIONS_PER_NODE
            });
            return null;
        }

        // Prevent self-connections if configured
        if (!NETWORK_DIAGRAM_CONFIG.CONSTRAINTS.ALLOW_SELF_CONNECTIONS && 
            sourceNode.id === targetNode.id) {
            PerformanceLogger.error('Self Connection Not Allowed', {
                nodeId: sourceNode.id
            });
            return null;
        }

        const connectionConfig = NETWORK_DIAGRAM_CONFIG.CONNECTION_TYPES[connectionType];

        const connection = {
            id: `connection-${Date.now()}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: connectionType,
            config: connectionConfig
        };

        // Track connections
        this.connections.push(connection);
        sourceRegistry.connections.push(connection);

        // Library-specific connection logic can be extended here
        if (this.library && this.library.connect) {
            try {
                connection.libraryConnection = this.library.connect(
                    sourceRegistry.libraryNode, 
                    targetRegistry.libraryNode, 
                    connectionConfig
                );
            } catch (error) {
                PerformanceLogger.error('Library Connection Failed', error);
                // Rollback connection tracking
                this.connections = this.connections.filter(c => c.id !== connection.id);
                sourceRegistry.connections = sourceRegistry.connections.filter(c => c.id !== connection.id);
                return null;
            }
        }

        PerformanceLogger.log('Connection Created', { 
            connectionType, 
            sourceNode: sourceNode.id, 
            targetNode: targetNode.id,
            totalConnections: this.connections.length
        });

        return connection;
    }

    /**
     * Remove a connection
     * @param {string} connectionId - ID of connection to remove
     */
    removeConnection(connectionId) {
        const connectionIndex = this.connections.findIndex(conn => conn.id === connectionId);
        
        if (connectionIndex !== -1) {
            const connection = this.connections[connectionIndex];
            
            // Remove from source node's connections
            const sourceRegistry = this.nodeRegistry[connection.source];
            if (sourceRegistry) {
                sourceRegistry.connections = sourceRegistry.connections
                    .filter(conn => conn.id !== connectionId);
            }

            // Remove library-specific connection if exists
            if (this.library && this.library.disconnect) {
                this.library.disconnect(connection.libraryConnection);
            }

            // Remove from global connections
            this.connections.splice(connectionIndex, 1);

            PerformanceLogger.log('Connection Removed', { connectionId });
        }
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
}

// Export a default instance that can be imported and used globally
export default new ConnectionManager();
