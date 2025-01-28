import React, { useEffect, useRef, useState, useCallback } from 'react';
import { JsPlumbCoreWrapper } from './NetworkDiagram/JsPlumbWrapper';
import '../styles/NetworkDiagram.css';
import { 
    NETWORK_DIAGRAM_CONFIG,
    EndpointConfigLoader,
    generateUUID
} from '../utils/NetworkDiagramConfig';
import TopologyManager from '../utils/TopologyManager';
import toast from '../utils/toast'; 
import NodeConfigModal from './NodeConfigModal';
import NodeContextMenu from './NetworkDiagram/NodeContextMenu';
import NetworkNode from './NetworkDiagram/NetworkNode';
import ConnectionManager, { useConnectionManager } from './NetworkDiagram/ConnectionManager';
import { useNodeManager } from './NetworkDiagram/NodeManager';
import NodeCreator from './NetworkDiagram/NodeCreator';
import JsPlumbWrapper from './NetworkDiagram/JsPlumbWrapper';
import Logger from '../utils/Logger';
import useDragAndDrop from '../hooks/useDragAndDrop';
import useThemeManager from '../hooks/useThemeManager';
import HistoryManager from '../utils/HistoryManager';

// Refs and basic state
const NetworkDiagram = ({ currentTheme }) => {
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);
    const nodesRef = useRef({});
    const [nodes, setNodes] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [nodeConfigModal, setNodeConfigModal] = useState(null);
    const [deviceTypeCount, setDeviceTypeCount] = useState({});
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        stage: 'IDLE' // IDLE, SOURCE_SELECTED
    });

    // Get managers and hooks
    const connectionManager = useConnectionManager(jsPlumbInstance);
    const nodeManager = useNodeManager({ jsPlumbInstance, setNodes, nodesRef });
    const { activeTheme, backgroundStyles } = useThemeManager(currentTheme);

    // Create a memoized function to generate unique node names
    const generateNodeName = useCallback((deviceType, index = undefined) => {
        if (index !== undefined) {
            // For batch creation, use the provided index
            return `${deviceType}-${(deviceTypeCount[deviceType] || 0) + index + 1}`;
        } else {
            // For single node creation, increment the counter
            const nextCount = (deviceTypeCount[deviceType] || 0) + 1;
            setDeviceTypeCount(prevCount => ({
                ...prevCount,
                [deviceType]: nextCount
            }));
            return `${deviceType}-${nextCount}`;
        }
    }, [deviceTypeCount]);

    /**
     * Create a new node with grid-aligned positioning
     * @param {string} nodeType - Type of node to create
     * @param {string} iconPath - Path to node icon
     * @param {Object} position - Position of node
     */
    const createNode = useCallback(async (nodeType, iconPath, position) => {
        try {
            // Load device-specific endpoint configuration
            const endpointConfig = await EndpointConfigLoader.loadDeviceEndpoints(iconPath);

            // Create node configuration
            const nodeConfig = {
                type: nodeType,
                iconPath,
                x: position.clientX,
                y: position.clientY,
                endpoints: endpointConfig?.interfaces || []
            };

            setNodeConfigModal(nodeConfig);
        } catch (error) {
            Logger.error('Error creating node', {
                error: error.message,
                nodeType,
                iconPath
            });
            toast.error('Failed to create node');
        }
    }, []);

    // Initialize drag and drop handlers after createNode is defined
    const { handleDragOver, handleDrop } = useDragAndDrop({
        containerRef,
        onNodeCreate: createNode
    });

    /**
     * Handle context menu for node endpoints
     * @param {Event} e - Context menu event
     * @param {Object} node - Node being right-clicked
     */
    const handleContextMenu = useCallback((event, node) => {
        event.preventDefault();
        
        // Ensure we have valid mouse coordinates
        const mouseX = event.clientX > 0 ? event.clientX : 0;
        const mouseY = event.clientY > 0 ? event.clientY : 0;

        setContextMenu({
            mouseX,
            mouseY,
            node: node,
            endpoints: node.endpoints || []
        });
    }, []);

    /**
     * Create safe overlay configuration for connection
     * @param {Object} connection - Connection details
     * @returns {Array} Overlay configuration array
     */
    const createConnectionOverlay = (connection) => {
        // Temporarily return empty array to bypass overlay creation
        Logger.info('Overlay Creation Skipped', {
            connectionId: connection?.id,
            sourceInterface: connection?.sourceInterface?.name,
            targetInterface: connection?.targetInterface?.name
        });

        return [];
    };

    /**
     * Handle endpoint selection for connection creation
     */
    const handleEndpointSelection = useCallback((node, endpoint) => {
        try {
            Logger.debug('Detailed Endpoint Selection', {
                nodeId: node.id,
                nodeName: node.name,
                endpoint: {
                    name: endpoint.name,
                    type: endpoint.type,
                    fullEndpointObject: endpoint,
                    nodeInterfaces: node.interfaces || 'Not Available'
                },
                connectionState: {
                    currentStage: connectionState.stage,
                    sourceNode: connectionState.sourceNode?.id,
                    sourceEndpoint: connectionState.sourceEndpoint
                }
            });

            switch (connectionState.stage) {
                case 'IDLE':
                    setConnectionState({
                        sourceNode: node,
                        sourceEndpoint: {
                            ...endpoint,
                            nodeId: node.id,
                            interfaceType: endpoint.type
                        },
                        stage: 'SOURCE_SELECTED'
                    });
                    break;

                case 'SOURCE_SELECTED':
                    const sourceNode = connectionState.sourceNode;
                    const sourceEndpoint = connectionState.sourceEndpoint;
                    
                    Logger.info('Connection Attempt Details', {
                        sourceNode: {
                            id: sourceNode.id,
                            name: sourceNode.name
                        },
                        sourceEndpoint: {
                            ...sourceEndpoint,
                            fullObject: sourceEndpoint
                        },
                        destinationNode: {
                            id: node.id,
                            name: node.name
                        },
                        destinationEndpoint: {
                            ...endpoint,
                            nodeId: node.id,
                            interfaceType: endpoint.type
                        }
                    });

                    const connectionResult = TopologyManager.createConnection(
                        sourceNode, 
                        node, 
                        {
                            ...sourceEndpoint,
                            nodeId: sourceNode.id,
                            type: sourceEndpoint.type || sourceEndpoint.interfaceType
                        }, 
                        {
                            ...endpoint,
                            nodeId: node.id,
                            type: endpoint.type
                        }
                    );

                    if (connectionResult) {
                        connectionManager.renderConnection(connectionResult);
                        toast.success(`Connected ${sourceEndpoint.name} to ${endpoint.name}`);
                    }

                    setConnectionState({
                        sourceNode: null,
                        sourceEndpoint: null,
                        stage: 'IDLE'
                    });
                    break;

                default:
                    break;
            }

            setContextMenu(null);
        } catch (error) {
            Logger.error('Endpoint Selection Error', {
                error: error.message,
                stack: error.stack,
                connectionState
            });
            
            setConnectionState({
                sourceNode: null,
                sourceEndpoint: null,
                stage: 'IDLE'
            });
            setContextMenu(null);
            
            toast.error('An unexpected error occurred');
        }
    }, [connectionState, connectionManager]);

    /**
     * Drag and drop event handlers
     */
    const handleCanvasClick = useCallback((e) => {
        // Check if the click is outside any node or context menu
        const isClickOnNode = e.target.closest('.network-node');
        const isClickOnContextMenu = e.target.closest('.context-menu');

        // Close context menu if not clicking on a node or context menu
        if (!isClickOnNode && !isClickOnContextMenu) {
            setContextMenu(null);
            
            // Reset connection state if in SOURCE_SELECTED stage
            if (connectionState.stage === 'SOURCE_SELECTED') {
                setConnectionState({
                    sourceNode: null,
                    sourceEndpoint: null,
                    stage: 'IDLE'
                });
            }
        }
    }, [connectionState.stage]);

    // Add event listener for canvas click
    useEffect(() => {
        const containerElement = containerRef.current;
        
        if (containerElement) {
            containerElement.addEventListener('click', handleCanvasClick);

            // Cleanup event listener
            return () => {
                containerElement.removeEventListener('click', handleCanvasClick);
            };
        }
    }, [handleCanvasClick]);

    /**
     * Initialize diagram and render existing connections
     */
    useEffect(() => {
        JsPlumbCoreWrapper.ready(() => {
            if (containerRef.current) {
                jsPlumbInstance.current = JsPlumbWrapper.initialize(containerRef.current);

                const renderTimer = setTimeout(() => {
                    connectionManager.renderExistingConnections();
                }, 100);

                return () => {
                    clearTimeout(renderTimer);
                    JsPlumbWrapper.destroy();
                };
            }
        });
    }, [connectionManager]);

    const createMultipleNodes = useCallback(async (nodeConfig, count) => {
        const { type, iconPath, x, y } = nodeConfig;
        const nodes = [];

        // Load device-specific endpoint configuration
        const endpointConfig = await EndpointConfigLoader.loadDeviceEndpoints(iconPath);

        // Extract device type from icon path
        const deviceType = iconPath
            .split('/')
            .pop()
            .replace(/\.(svg|png)$/, '');

        // Update the device type count for all nodes at once
        const currentCount = deviceTypeCount[deviceType] || 0;
        setDeviceTypeCount(prevCount => ({
            ...prevCount,
            [deviceType]: currentCount + count
        }));

        // Create multiple nodes in a grid-like sequence
        for (let i = 0; i < count; i++) {
            const nodeX = x + (i % 5) * 100;
            const nodeY = y + Math.floor(i / 5) * 100;

            const node = NodeCreator.createNode({
                deviceType,
                name: generateNodeName(deviceType, i),
                iconPath,
                x: nodeX,
                y: nodeY,
                interfaces: endpointConfig?.interfaces || []
            });

            nodes.push(node);
        }

        setNodes(prev => [...prev, ...nodes]);

        // Setup jsPlumb for each node after a short delay to ensure DOM is ready
        setTimeout(() => {
            nodes.forEach(node => {
                NodeCreator.setupNodeJsPlumb({
                    node,
                    jsPlumbInstance: jsPlumbInstance.current,
                    nodesRef: nodesRef.current
                });
            });
        }, 0);

        Logger.info('Multiple Nodes Created', { 
            deviceType, 
            nodeCount: nodes.length,
            iconPath,
            topology: TopologyManager.topology
        });
    }, [generateNodeName, jsPlumbInstance]);

    const handleNodeConfigSubmit = useCallback((nodeCount) => {
        if (nodeConfigModal) {
            createMultipleNodes(nodeConfigModal, nodeCount);
            setNodeConfigModal(null);
        }
    }, [createMultipleNodes, nodeConfigModal]);

    const handleSave = useCallback(() => {
        // TODO: Implement save functionality
        toast.info('Save functionality coming soon');
    }, []);

    const handleUndo = useCallback(() => {
        if (HistoryManager.undo()) {
            toast.success('Action undone');
        } else {
            toast.info('Nothing to undo');
        }
    }, []);

    const handleRedo = useCallback(() => {
        if (HistoryManager.redo()) {
            toast.success('Action redone');
        } else {
            toast.info('Nothing to redo');
        }
    }, []);

    // Add keyboard event listener for node deletion
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.key === 'Delete' || event.key === 'Backspace') && contextMenu) {
                nodeManager.deleteNode(contextMenu.node.id);
                setContextMenu(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu, nodeManager]);

    /**
     * Delete a node and its related connections
     * @param {string} nodeId - ID of the node to delete
     */
    const deleteNode = useCallback((nodeId) => {
        // Find the node to be deleted
        const nodeToDelete = nodes.find(node => node.id === nodeId);
        
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

        // Remove connections from jsPlumb
        relatedConnections.forEach(connection => {
            try {
                // Remove connection from jsPlumb if instance exists
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

                // Remove connection from ConnectionManager
                TopologyManager.removeConnectionTopology(
                    TopologyManager.generateConnectionKey(
                        { nodeId: connection.sourceNodeId },
                        { nodeId: connection.targetNodeId }
                    )
                );
            } catch (error) {
                Logger.error('Error removing connection during node deletion', {
                    nodeId,
                    connectionId: connection.id,
                    error: error.message
                });
            }
        });

        // Remove node from jsPlumb
        if (jsPlumbInstance.current) {
            const nodeElement = document.getElementById(nodeId);
            if (nodeElement) {
                // Remove all endpoints associated with the node
                jsPlumbInstance.current.removeAllEndpoints(nodeElement);
            }
        }

        // Remove node from ConnectionManager
        TopologyManager.removeTopologyNode(nodeId);

        // Remove node from local state
        setNodes(prevNodes => prevNodes.filter(node => node.id !== nodeId));

        // Remove node reference from nodesRef
        delete nodesRef.current[nodeId];

        // Log deletion
        Logger.info('Node Deleted', {
            nodeId,
            nodeType: nodeToDelete.type,
            relatedConnectionsCount: relatedConnections.length
        });

        // Optional: Show a toast notification
        toast.info(`Node ${nodeToDelete.name} deleted`);
    }, [nodes]);

    /**
     * Create node endpoints for a specific node
     * @param {string} nodeId - ID of the node
     * @param {Object} nodeConfig - Node configuration
     * @returns {Array} Created endpoints
     */
    const createNodeEndpoints = useCallback((nodeId, nodeConfig) => {
        const endpoints = [];

        try {
            // Create default endpoint using JsPlumbCoreWrapper
            const defaultEndpoint = JsPlumbWrapper.createNodeEndpoint(nodeId, {
                endpoint: JsPlumbCoreWrapper.createDotEndpoint({
                    cssClass: 'node-endpoint'
                }),
                // Use node-specific configuration if available
                ...nodeConfig?.endpointConfig,
                // Additional default configurations
                maxConnections: -1  // Allow multiple connections
            });

            if (defaultEndpoint) {
                endpoints.push(defaultEndpoint);
            }

            // Optional: Create additional specialized endpoints
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
     * Render existing connections from topology
     * @param {Object} topology - Network topology
     */
    const renderExistingConnections = useCallback((topology) => {
        // Early return if topology or connections are invalid
        if (!topology) {
            Logger.warn('Topology is undefined or null');
            return;
        }

        // Normalize connections to an array
        let connections = [];
        if (Array.isArray(topology.connections)) {
            connections = topology.connections;
        } else if (topology.connections && typeof topology.connections === 'object') {
            // Convert object to array if it's an object with numeric/string keys
            connections = Object.values(topology.connections);
        }

        // Log connection rendering details
        Logger.debug('Rendering Existing Connections', {
            connectionCount: connections.length
        });

        // Render each connection
        connections.forEach(connection => {
            try {
                connectionManager.renderConnection(connection);
            } catch (error) {
                Logger.error('Failed to render individual connection', {
                    connectionId: connection.id,
                    errorMessage: error.message
                });
            }
        });
    }, [connectionManager]);

    return (
        <div className="network-diagram">
            <div
                ref={containerRef}
                className="diagram-container"
                style={{
                    flex: 1,
                    minHeight: 'calc(100vh - 48px)',
                    ...backgroundStyles
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleCanvasClick}  
            >
                {nodes.map(node => (
                    <NetworkNode
                        key={node.id}
                        id={node.id}
                        node={node}
                        isConnectionTarget={connectionState.stage === 'SOURCE_SELECTED'}
                        onContextMenu={handleContextMenu}
                    />
                ))}

                <NodeContextMenu 
                    contextMenu={contextMenu}
                    connectionState={connectionState}
                    onEndpointSelect={handleEndpointSelection}
                    onDeleteNode={nodeManager.deleteNode}
                    onClose={() => setContextMenu(null)}
                />

                {nodeConfigModal && (
                    <NodeConfigModal 
                        open={!!nodeConfigModal}
                        onClose={() => setNodeConfigModal(null)}
                        nodeConfig={{
                            type: nodeConfigModal.type,
                            iconPath: nodeConfigModal.iconPath,
                            endpoints: nodeConfigModal.endpoints || []
                        }}
                        onSubmit={handleNodeConfigSubmit}
                    />
                )}

                <ConnectionManager jsPlumbInstance={jsPlumbInstance} />
            </div>
        </div>
    );
};

export default NetworkDiagram;
