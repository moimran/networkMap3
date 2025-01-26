import { NETWORK_DIAGRAM_CONFIG, makeId } from './NetworkDiagramConfig';
import Logger from './Logger';

// Global topology object, similar to reference project
const GlobalTopology = {
    nodes: {},
    connections: {},
    lines: {},
    networks: {},
    labinfo: {}
};

class ConnectionManager {
    constructor() {
        // Singleton global topology
        this.topology = GlobalTopology;

        // Connection rules based on interface types
        this.connectionRules = {
            interfaceTypeConnections: {
                'Serial': ['Serial'],
                'Ethernet': ['Ethernet']
            }
        };
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
            Logger.warn('Connection Validation Failed', {
                message: 'Source or target interface is undefined',
                sourceInterface,
                targetInterface
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
        Logger.info('Connection Type Identification', {
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
            Logger.warn('Connection Type Incompatibility', {
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
            Logger.warn('Connection Type Incompatibility', {
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
            Logger.warn('Duplicate Connection Attempt', {
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
        Logger.info('Connection Creation Attempt', {
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
        Logger.info('Connection Created Successfully', {
            connectionId,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceInterface: sourceInterface.name,
            targetInterface: targetInterface.name
        });

        return connection;
    }

    /**
     * Get all connections for a specific node
     * @param {string} nodeId - Node identifier
     * @returns {Array} List of connections involving the node
     */
    getNodeConnections(nodeId) {
        return Object.values(this.topology.connections)
            .filter(conn => 
                conn.sourceNode.id === nodeId || 
                conn.targetNode.id === nodeId
            );
    }

    /**
     * Remove a connection
     * @param {string} connectionKey - Connection key
     */
    removeConnection(connectionKey) {
        const connection = this.topology.connections[connectionKey];
        
        if (connection) {
            // Remove from connections and lines
            delete this.topology.connections[connectionKey];
            delete this.topology.lines[connection.id];

            Logger.info('Connection Removed', { connectionKey });
        }
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
        
        Logger.info('Topology Reset');
    }

    /**
     * Get global topology
     * @returns {Object} Current global topology state
     */
    getTopology() {
        return this.topology;
    }

    /**
     * Register a new node in the connection manager
     * @param {Object} nodeData - Raw node data
     * @param {Object} libraryNodeData - Library-specific node representation
     * @returns {string} Node registration ID
     */
    registerNode(nodeData, libraryNodeData = {}) {
        // Validate node data
        if (!nodeData) {
            throw new Error('Cannot register undefined node');
        }

        if (!nodeData.id) {
            throw new Error('Node must have an ID');
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
        Logger.info('Node Registered', {
            nodeId: nodeData.id,
            nodeName: nodeData.name,
            type: nodeData.type,
            libraryDataAvailable: !!libraryNodeData
        });

        return nodeData.id;  // Return node ID as registration result
    }

    /**
     * Get a registered node by its ID
     * @param {string} nodeId - Node identifier
     * @returns {Object|null} Node details or null if not found
     */
    getNode(nodeId) {
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
            Logger.warn('Endpoint Availability Check Failed', {
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
        Logger.info('Endpoint Availability Check', {
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
    getAvailableEndpoints(nodeId) {
        const node = this.topology.nodes[nodeId];
        
        if (!node || !node.endpoints) {
            Logger.warn('Available Endpoints Check Failed', {
                message: 'Node not found or has no endpoints',
                nodeId
            });
            return [];
        }

        return node.endpoints.filter(endpoint => this.isEndpointAvailable(endpoint));
    }
}

// Export a singleton instance
export default new ConnectionManager();
