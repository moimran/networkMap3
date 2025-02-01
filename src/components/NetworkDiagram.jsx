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
const NetworkDiagram = ({ currentTheme, onCanvasActivityChange }) => {
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);
    const nodesRef = useRef({});
    const [nodes, setNodes] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [nodeConfigModal, setNodeConfigModal] = useState(null);
    const [deviceTypeCount, setDeviceTypeCount] = useState({});
    const [hasCanvasActivity, setHasCanvasActivity] = useState(false);
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        stage: 'IDLE' // IDLE, SOURCE_SELECTED
    });

    // Get managers and hooks
    const connectionManager = useConnectionManager(jsPlumbInstance);
    const nodeManager = useNodeManager({ jsPlumbInstance, setNodes, nodesRef });
    const { activeTheme, backgroundStyles } = useThemeManager(currentTheme);

    // Update parent component when canvas activity changes
    useEffect(() => {
        onCanvasActivityChange?.(hasCanvasActivity);
    }, [hasCanvasActivity, onCanvasActivityChange]);

    // Create a function to track canvas activity
    const trackCanvasActivity = useCallback(() => {
        setHasCanvasActivity(true);
    }, []);

    // Add canvas activity tracking to relevant operations
    useEffect(() => {
        if (jsPlumbInstance.current) {
            // Track connection changes
            jsPlumbInstance.current.bind('connection', trackCanvasActivity);
            jsPlumbInstance.current.bind('connectionDetached', trackCanvasActivity);
            jsPlumbInstance.current.bind('connectionMoved', trackCanvasActivity);
            
            // Track node movement
            jsPlumbInstance.current.bind('elementDragged', trackCanvasActivity);
        }

        return () => {
            if (jsPlumbInstance.current) {
                jsPlumbInstance.current.unbind('connection');
                jsPlumbInstance.current.unbind('connectionDetached');
                jsPlumbInstance.current.unbind('connectionMoved');
                jsPlumbInstance.current.unbind('elementDragged');
            }
        };
    }, [trackCanvasActivity, jsPlumbInstance]);

    // Track node changes
    useEffect(() => {
        if (nodes.length > 0) {  // Only track when nodes are added, not on initial load
            trackCanvasActivity();
        }
    }, [nodes.length, trackCanvasActivity]);

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

    const handleSave = useCallback(async () => {
        if (!hasCanvasActivity) {
            toast.info('No changes to save');
            return;
        }

        try {
            // Get the current topology state
            const topology = TopologyManager.getTopology();

            Logger.info('Topology Structure:', topology);
            
            // Create a clean configuration object
            const config = {
                nodes: {},
                connections: {},
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            // Sanitize nodes data
            Object.entries(topology.nodes || {}).forEach(([nodeId, node]) => {
                config.nodes[nodeId] = {
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    interfaces: node.interfaces,
                    position: node.position,
                    properties: node.properties
                };
            });

            // Sanitize connections data
            Object.entries(topology.connections || {}).forEach(([connId, conn]) => {
                config.connections[connId] = {
                    id: conn.id,
                    sourceNode: {
                        id: conn.sourceNode.id,
                        interface: conn.sourceNode.interface
                    },
                    targetNode: {
                        id: conn.targetNode.id,
                        interface: conn.targetNode.interface
                    }
                };
            });

            // Generate a unique filename based on timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `network-diagram-${timestamp}.json`;

            // Create a Blob from the JSON data
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            
            // Create a download link and trigger it
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success(`Diagram saved as ${filename}`);
            setHasCanvasActivity(false);
            
            Logger.info('Diagram Configuration Saved', {
                filename,
                nodeCount: Object.keys(config.nodes).length,
                connectionCount: Object.keys(config.connections).length,
                configSize: blob.size
            });
        } catch (error) {
            Logger.error('Failed to save diagram configuration', {
                error: error.message,
                stack: error.stack
            });
            toast.error('Failed to save diagram configuration');
        }
    }, [hasCanvasActivity]);

    useEffect(() => {
        const handleNodeMovement = () => {
            trackCanvasActivity();
        };

        if (jsPlumbInstance.current) {
            jsPlumbInstance.current.bind('connection', trackCanvasActivity);
            jsPlumbInstance.current.bind('connectionDetached', trackCanvasActivity);
            jsPlumbInstance.current.bind('connectionMoved', trackCanvasActivity);
            jsPlumbInstance.current.bind('elementDragged', trackCanvasActivity);
        }

        return () => {
            if (jsPlumbInstance.current) {
                jsPlumbInstance.current.unbind('connection');
                jsPlumbInstance.current.unbind('connectionDetached');
                jsPlumbInstance.current.unbind('connectionMoved');
                jsPlumbInstance.current.unbind('elementDragged');
            }
        };
    }, [trackCanvasActivity, jsPlumbInstance]);

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

    // Handle topology loaded event
    useEffect(() => {
        const handleTopologyLoaded = (event) => {
            try {
                Logger.debug('NetworkDiagram: Handling topology loaded event');
                
                // Clear existing nodes and connections
                if (jsPlumbInstance.current) {
                    jsPlumbInstance.current.reset();
                }
                setNodes([]);
                nodesRef.current = {};

                // Create nodes from loaded topology
                const loadedNodes = Object.values(TopologyManager.topology.nodes);
                loadedNodes.forEach(nodeData => {
                    const node = {
                        id: nodeData.id,
                        type: nodeData.type,
                        name: nodeData.name,
                        position: nodeData.position,
                        interfaces: nodeData.interfaces,
                        properties: nodeData.properties,
                        iconPath: nodeData.iconPath
                    };
                    nodesRef.current[node.id] = node;
                });
                setNodes(loadedNodes);

                // Recreate connections after a short delay to ensure nodes are rendered
                setTimeout(() => {
                    if (jsPlumbInstance.current) {
                        Object.values(TopologyManager.topology.connections).forEach(conn => {
                            // Create connection object for rendering
                            const connection = {
                                sourceNode: {
                                    id: conn.sourceNode.id
                                },
                                targetNode: {
                                    id: conn.targetNode.id
                                },
                                sourceInterface: {
                                    name: conn.sourceNode.interface,
                                    type: conn.sourceNode.interfaceType
                                },
                                targetInterface: {
                                    name: conn.targetNode.interface,
                                    type: conn.targetNode.interfaceType
                                }
                            };

                            // Render the connection
                            const jsPlumbConn = connectionManager.renderConnection(connection);
                            if (!jsPlumbConn) {
                                Logger.warn('NetworkDiagram: Failed to render connection', {
                                    connection,
                                    error: 'No jsPlumb connection created'
                                });
                            }
                        });
                    }
                }, 100);

                Logger.info('NetworkDiagram: Successfully rendered loaded topology');
            } catch (error) {
                Logger.error('NetworkDiagram: Error handling topology loaded event', {
                    error: error.message,
                    stack: error.stack
                });
                toast.error('Failed to render loaded topology');
            }
        };

        // Subscribe to topology loaded event
        TopologyManager.on('topologyLoaded', handleTopologyLoaded);

        return () => {
            TopologyManager.off('topologyLoaded', handleTopologyLoaded);
        };
    }, [connectionManager]);

    const loadTopology = useCallback((config) => {
        try {
            Logger.info('Loading topology', config);

            // Clear existing nodes and connections
            setNodes([]);
            if (jsPlumbInstance.current) {
                // Get all existing connections
                const connections = jsPlumbInstance.current.getConnections();
                connections.forEach(conn => {
                    jsPlumbInstance.current.deleteConnection(conn);
                });

                // Remove all endpoints for each node
                nodes.forEach(node => {
                    const nodeElement = document.getElementById(node.id);
                    if (nodeElement) {
                        jsPlumbInstance.current.removeAllEndpoints(nodeElement);
                    }
                });
            }

            // Load topology into TopologyManager
            const success = TopologyManager.loadTopology(config);
            if (!success) {
                toast.error('Failed to load topology configuration');
                return;
            }

            // Create nodes from topology
            const nodeConfigs = Object.values(config.nodes).map(nodeData => {
                // Get icon path from node type
                const iconPath = nodeData.iconPath || `/net_icons/${nodeData.type}.svg`;

                // Ensure position is properly set
                const position = {
                    x: nodeData.position?.x || 0,
                    y: nodeData.position?.y || 0
                };

                Logger.debug('Creating node with position and icon', {
                    nodeId: nodeData.id,
                    position,
                    iconPath
                });

                return {
                    id: nodeData.id,
                    type: nodeData.type,
                    name: nodeData.name,
                    position,
                    size: nodeData.size || { width: 100, height: 100 },
                    iconPath,
                    interfaces: nodeData.interfaces || [],
                    properties: nodeData.properties || {},
                    endpoints: nodeData.endpoints || []
                };
            });

            // Update nodes state
            setNodes(nodeConfigs);

            // Setup jsPlumb for each node after nodes are rendered
            setTimeout(() => {
                nodeConfigs.forEach(node => {
                    const nodeElement = document.getElementById(node.id);
                    if (!nodeElement) {
                        Logger.warn('Node element not found during endpoint setup', {
                            nodeId: node.id,
                            nodeName: node.name
                        });
                        return;
                    }

                    // Wait for the node element to be fully rendered
                    requestAnimationFrame(() => {
                        // Setup endpoints for each interface
                        node.endpoints?.forEach(endpoint => {
                            const endpointConfig = {
                                cssClass: `interface-endpoint-${endpoint.type}`,
                                anchor: JsPlumbCoreWrapper.getAnchorLocations().Continuous,
                                interfaceType: endpoint.type,
                                paintStyle: { 
                                    fill: "transparent",
                                    stroke: "transparent"
                                },
                                hoverPaintStyle: { 
                                    fill: "transparent",
                                    stroke: "transparent"
                                }
                            };

                            JsPlumbWrapper.createNodeEndpoint(nodeElement, endpointConfig);
                        });
                    });
                });

                // Render connections after nodes and endpoints are set up
                setTimeout(() => {
                    connectionManager.renderExistingConnections();
                }, 100);
            }, 100);

            toast.success('Topology loaded successfully');
        } catch (error) {
            Logger.error('Failed to load topology', {
                error: error.message,
                stack: error.stack
            });
            toast.error('Failed to load topology');
        }
    }, [connectionManager, setNodes, nodes]);

    // Listen for topology loaded event
    useEffect(() => {
        const handleTopologyLoaded = (event) => {
            if (event?.detail?.config) {
                loadTopology(event.detail.config);
            }
        };

        window.addEventListener('topologyLoaded', handleTopologyLoaded);
        return () => window.removeEventListener('topologyLoaded', handleTopologyLoaded);
    }, [loadTopology]);

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
