import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import JsPlumbWrapper from './JsPlumbWrapper';
import TopologyManager from '../../utils/TopologyManager';
import Logger from '../../utils/Logger';

/**
 * ConnectionManager component handles all connection-related operations
 * including rendering connections and managing connection state
 */
const ConnectionManager = ({ jsPlumbInstance }) => {
    return null; // This is a logic-only component
};

ConnectionManager.propTypes = {
    jsPlumbInstance: PropTypes.shape({
        current: PropTypes.object
    }).isRequired
};

/**
 * Custom hook for managing connections in the network diagram
 * @param {Object} jsPlumbInstance - Reference to jsPlumb instance
 * @returns {Object} Connection management functions
 */
export const useConnectionManager = (jsPlumbInstance) => {
    /**
     * Create safe overlay configuration for connection
     * @param {Object} connection - Connection details
     * @returns {Array} Overlay configuration array
     */
    const createConnectionOverlay = useCallback((connection) => {
        Logger.info('Overlay Creation Skipped', {
            connectionId: connection?.id,
            sourceInterface: connection?.sourceInterface?.name,
            targetInterface: connection?.targetInterface?.name
        });
        return [];
    }, []);

    /**
     * Render connections using jsPlumb with robust error handling
     * @param {Object} connection - Connection details
     * @returns {Object|null} Created jsPlumb connection or null
     */
    const renderConnection = useCallback((connection) => {
        try {
            if (!jsPlumbInstance.current) {
                Logger.warn('Connection Rendering Failed', {
                    message: 'jsPlumb instance not initialized'
                });
                return null;
            }

            if (!connection || typeof connection !== 'object') {
                Logger.warn('Connection Rendering Aborted', {
                    reason: 'Invalid connection object',
                    connectionType: typeof connection
                });
                return null;
            }

            const sourceNodeElement = document.getElementById(connection.sourceNode?.id);
            const targetNodeElement = document.getElementById(connection.targetNode?.id);

            if (!sourceNodeElement || !targetNodeElement) {
                Logger.warn('Connection Rendering Failed', {
                    message: 'Source or target node element not found',
                    sourceNodeId: connection.sourceNode?.id,
                    targetNodeId: connection.targetNode?.id
                });
                return null;
            }

            const jsPlumbConnection = JsPlumbWrapper.connectNodes(
                sourceNodeElement, 
                targetNodeElement, 
                {
                    interfaceType: connection.sourceInterface?.type,
                    label: connection.label || '',
                }
            );

            if (jsPlumbConnection) {
                Logger.debug('Connection Rendered Successfully', {
                    sourceNodeId: connection.sourceNode.id,
                    targetNodeId: connection.targetNode.id
                });
            }

            return jsPlumbConnection;
        } catch (error) {
            Logger.error('Connection Rendering Failed', {
                errorMessage: error.message,
                connectionDetails: JSON.stringify(connection)
            });
            return null;
        }
    }, [jsPlumbInstance]);

    /**
     * Render existing connections from topology
     */
    const renderExistingConnections = useCallback(() => {
        const topology = TopologyManager.topology;
        
        if (!topology) {
            Logger.warn('Topology is undefined or null');
            return;
        }

        let connections = [];
        if (Array.isArray(topology.connections)) {
            connections = topology.connections;
        } else if (topology.connections && typeof topology.connections === 'object') {
            connections = Object.values(topology.connections);
        }

        Logger.debug('Rendering Existing Connections', {
            connectionCount: connections.length
        });

        connections.forEach(connection => {
            try {
                renderConnection(connection);
            } catch (error) {
                Logger.error('Failed to render individual connection', {
                    connectionId: connection.id,
                    errorMessage: error.message
                });
            }
        });
    }, [renderConnection]);

    return {
        renderConnection,
        renderExistingConnections,
        createConnectionOverlay
    };
};

export default ConnectionManager;
