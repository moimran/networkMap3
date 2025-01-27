import { useState, useCallback } from 'react';
import { Logger } from '../../utils/NetworkDiagramConfig';

/**
 * Custom hook for managing connections in a network diagram
 * @returns {Object} Connection management utilities
 */
const useConnectionManagement = () => {
    const [connections, setConnections] = useState([]);
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        stage: 'IDLE' // IDLE, SOURCE_SELECTED
    });

    /**
     * Start a new connection from a source node
     * @param {Object} sourceNode - Source node for connection
     * @param {Object} sourceEndpoint - Source endpoint
     */
    const startConnection = useCallback((sourceNode, sourceEndpoint) => {
        setConnectionState({
            sourceNode,
            sourceEndpoint,
            stage: 'SOURCE_SELECTED'
        });
    }, []);

    /**
     * Complete a connection between two nodes
     * @param {Object} targetNode - Target node for connection
     * @param {Object} targetEndpoint - Target endpoint
     */
    const completeConnection = useCallback((targetNode, targetEndpoint) => {
        if (connectionState.stage === 'SOURCE_SELECTED') {
            const newConnection = {
                id: `conn-${Date.now()}`,
                sourceNode: connectionState.sourceNode,
                sourceInterface: connectionState.sourceEndpoint,
                targetNode,
                targetInterface: targetEndpoint
            };

            setConnections(prevConnections => [...prevConnections, newConnection]);

            Logger.info('Connection Created', {
                sourceNode: newConnection.sourceNode.name,
                targetNode: newConnection.targetNode.name
            });

            // Reset connection state
            setConnectionState({
                sourceNode: null,
                sourceEndpoint: null,
                stage: 'IDLE'
            });
        }
    }, [connectionState]);

    /**
     * Cancel an in-progress connection
     */
    const cancelConnection = useCallback(() => {
        setConnectionState({
            sourceNode: null,
            sourceEndpoint: null,
            stage: 'IDLE'
        });
    }, []);

    /**
     * Remove a specific connection
     * @param {string} connectionId - ID of the connection to remove
     */
    const removeConnection = useCallback((connectionId) => {
        setConnections(prevConnections => 
            prevConnections.filter(conn => conn.id !== connectionId)
        );
    }, []);

    return {
        connections,
        connectionState,
        startConnection,
        completeConnection,
        cancelConnection,
        removeConnection
    };
};

export default useConnectionManagement;
