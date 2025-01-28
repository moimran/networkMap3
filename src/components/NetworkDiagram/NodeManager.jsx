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
        const nodeToDelete = nodesRef.current[nodeId]?.node;
        
        if (!nodeToDelete) {
            Logger.warn('Attempted to delete non-existent node', { nodeId });
            return;
        }

        // Remove all connections related to this node
        const relatedConnections = Object.values(TopologyManager.topology.connections)
            .filter(conn => 
                conn.sourceNodeId === nodeId || 
                conn.targetNodeId === nodeId
            );

        // Remove all related connections
        relatedConnections.forEach(removeConnection);

        // Remove node from jsPlumb
        if (jsPlumbInstance.current) {
            const nodeElement = document.getElementById(nodeId);
            if (nodeElement) {
                jsPlumbInstance.current.removeAllEndpoints(nodeElement);
            }
        }

        // Remove node from TopologyManager
        TopologyManager.removeTopologyNode(nodeId);

        // Remove node from local state
        setNodes(prevNodes => prevNodes.filter(node => node.id !== nodeId));

        // Remove node reference
        delete nodesRef.current[nodeId];

        // Log deletion
        Logger.info('Node Deleted', {
            nodeId,
            nodeType: nodeToDelete.type,
            relatedConnectionsCount: relatedConnections.length
        });

        toast.info(`Node ${nodeToDelete.name} deleted`);
    }, [jsPlumbInstance, nodesRef, removeConnection, setNodes]);

    return {
        createNodeEndpoints,
        deleteNode,
        removeConnection
    };
};

export default useNodeManager;
