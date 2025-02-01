import { useCallback } from 'react';
import JsPlumbWrapper from './JsPlumbWrapper';
import { JsPlumbCoreWrapper } from './JsPlumbWrapper';
import TopologyManager from '../../utils/TopologyManager';
import Logger from '../../utils/Logger';
import toast from '../../utils/toast';

/**
 * Custom hook for managing nodes in the network diagram
 * @param {Object} params - Hook parameters
 * @param {Object} params.jsPlumbInstance - Reference to jsPlumb instance
 * @param {Function} params.setNodes - State setter for nodes
 * @param {Object} params.nodesRef - Reference to nodes object
 * @returns {Object} Node management functions
 */
export const useNodeManager = ({ jsPlumbInstance, setNodes, nodesRef }) => {
    /**
     * Create node endpoints for a specific node
     * @param {string} nodeId - ID of the node
     * @param {Object} nodeConfig - Node configuration
     * @returns {Array} Created endpoints
     */
    const createNodeEndpoints = useCallback((nodeId, nodeConfig) => {
        const endpoints = [];

        try {
            const defaultEndpoint = JsPlumbWrapper.createNodeEndpoint(nodeId, {
                endpoint: JsPlumbCoreWrapper.createDotEndpoint({
                    cssClass: 'node-endpoint'
                }),
                ...nodeConfig?.endpointConfig,
                maxConnections: -1
            });

            if (defaultEndpoint) {
                endpoints.push(defaultEndpoint);
            }

            if (nodeConfig?.interfaces) {
                nodeConfig.interfaces.forEach(iface => {
                    const interfaceEndpoint = JsPlumbWrapper.createNodeEndpoint(nodeId, {
                        endpoint: JsPlumbCoreWrapper.createDotEndpoint({
                            cssClass: `interface-endpoint-${iface.type}`
                        }),
                        anchor: JsPlumbCoreWrapper.getAnchorLocations().Continuous,
                        interfaceType: iface.type
                    });

                    if (interfaceEndpoint) {
                        endpoints.push(interfaceEndpoint);
                    }
                });
            }

            return endpoints;
        } catch (error) {
            Logger.error('Endpoint Creation Failed', {
                nodeId,
                errorMessage: error.message
            });
            return [];
        }
    }, []);

    /**
     * Remove a connection from the diagram
     * @param {Object} connection - Connection to remove
     */
    const removeConnection = useCallback((connection) => {
        try {
            if (jsPlumbInstance.current) {
                const jsPlumbConnection = jsPlumbInstance.current.getConnections()
                    .find(conn => 
                        (conn.sourceId === connection.sourceNodeId && 
                         conn.targetId === connection.targetNodeId) ||
                        (conn.sourceId === connection.targetNodeId && 
                         conn.targetId === connection.sourceNodeId)
                    );
                
                if (jsPlumbConnection) {
                    jsPlumbInstance.current.deleteConnection(jsPlumbConnection);
                }
            }

            TopologyManager.removeConnectionTopology(
                TopologyManager.generateConnectionKey(
                    { nodeId: connection.sourceNodeId },
                    { nodeId: connection.targetNodeId }
                )
            );
        } catch (error) {
            Logger.error('Error removing connection', {
                connectionId: connection.id,
                error: error.message
            });
        }
    }, [jsPlumbInstance]);

    /**
     * Delete a node and its related connections
     * @param {string} nodeId - ID of the node to delete
     */
    const deleteNode = useCallback((nodeId) => {
        try {
            const nodeRef = nodesRef.current[nodeId];
            const nodeToDelete = nodeRef?.node;
            
            if (!nodeToDelete) {
                Logger.warn('Attempted to delete non-existent node', { 
                    nodeId,
                    availableNodes: Object.keys(nodesRef.current)
                });
                return;
            }

            Logger.debug('NodeManager: Starting node deletion', {
                nodeId,
                nodeType: nodeToDelete.type,
                nodeName: nodeToDelete.name
            });

            // Remove all connections related to this node
            const relatedConnections = Object.values(TopologyManager.topology.connections)
                .filter(conn => 
                    conn.sourceNode.id === nodeId || 
                    conn.targetNode.id === nodeId
                );

            Logger.debug('NodeManager: Removing related connections', {
                nodeId,
                connectionCount: relatedConnections.length,
                connections: relatedConnections.map(c => c.id)
            });

            // Remove all related connections
            relatedConnections.forEach(removeConnection);

            // Remove node from jsPlumb
            if (jsPlumbInstance.current) {
                const nodeElement = document.getElementById(nodeId);
                if (nodeElement) {
                    jsPlumbInstance.current.removeAllEndpoints(nodeElement);
                    Logger.debug('NodeManager: Removed jsPlumb endpoints', { nodeId });
                } else {
                    Logger.warn('NodeManager: Node element not found in DOM', { nodeId });
                }
            }

            // Remove node from TopologyManager
            const removedNode = TopologyManager.removeTopologyNode(nodeId);
            if (!removedNode) {
                Logger.warn('NodeManager: Node not found in TopologyManager', { nodeId });
            }

            // Remove node from local state
            setNodes(prevNodes => prevNodes.filter(node => node.id !== nodeId));

            // Remove node reference
            delete nodesRef.current[nodeId];

            // Log successful deletion
            Logger.info('NodeManager: Node deleted successfully', {
                nodeId,
                nodeType: nodeToDelete.type,
                nodeName: nodeToDelete.name,
                relatedConnectionsCount: relatedConnections.length
            });

            toast.info(`Node ${nodeToDelete.name} deleted`);

        } catch (error) {
            Logger.error('NodeManager: Failed to delete node', {
                nodeId,
                error: error.message,
                stack: error.stack
            });
            toast.error('Failed to delete node');
        }
    }, [jsPlumbInstance, nodesRef, removeConnection, setNodes]);

    return {
        createNodeEndpoints,
        deleteNode,
        removeConnection
    };
};

export default useNodeManager;
