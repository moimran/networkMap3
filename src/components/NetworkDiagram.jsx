import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { JsPlumbCoreWrapper } from './NetworkDiagram/JsPlumbWrapper';
import '../styles/NetworkDiagram.css';
import { CANVAS_THEMES } from '../constants/themes';
import { 
    NETWORK_DIAGRAM_CONFIG,
    EndpointConfigLoader,
    generateUUID  
} from '../utils/NetworkDiagramConfig';
import TopologyManager from '../utils/TopologyManager';
import toast from '../utils/toast'; 
import NodeConfigModal from './NodeConfigModal';
import { 
    Menu, 
    MenuItem, 
    ListItemIcon, 
    ListItemText, 
    Typography, 
    Divider 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import JsPlumbWrapper from './NetworkDiagram/JsPlumbWrapper';
import Logger from '../utils/Logger';

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

    // Get active theme settings
    const activeTheme = useMemo(() => 
        Object.values(CANVAS_THEMES).find(theme => theme.id === currentTheme) || CANVAS_THEMES.GRID_LIGHT,
        [currentTheme]
    );

    // Memoize background styles to prevent unnecessary re-renders
    const backgroundStyles = useMemo(() => ({
        backgroundColor: activeTheme.background,
        backgroundImage: activeTheme.backgroundImage,
        backgroundSize: activeTheme.backgroundSize,
        backgroundRepeat: 'repeat'
    }), [activeTheme]);

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
     * @param {Event} event - Drop event
     * @returns {Object} Created node
     */
    const createNode = useCallback(async (nodeType, iconPath, event) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.round((event.clientX - rect.left) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;
        const y = Math.round((event.clientY - rect.top) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;

        // Open node configuration modal
        setNodeConfigModal({
            type: nodeType,
            iconPath: iconPath,
            x,
            y
        });
    }, []);

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
     * Render connections using jsPlumb with robust error handling
     * @param {Object} connection - Connection details
     * @returns {Object|null} Created jsPlumb connection or null
     */
    const renderConnection = useCallback((connection) => {
        try {
            // Validate jsPlumb instance
            if (!jsPlumbInstance.current) {
                Logger.warn('Connection Rendering Failed', {
                    message: 'jsPlumb instance not initialized'
                });
                return null;
            }

            // Validate connection object
            if (!connection || typeof connection !== 'object') {
                Logger.warn('Connection Rendering Aborted', {
                    reason: 'Invalid connection object',
                    connectionType: typeof connection
                });
                return null;
            }

            // Find source and target node elements
            const sourceNodeElement = document.getElementById(connection.sourceNode?.id);
            const targetNodeElement = document.getElementById(connection.targetNode?.id);

            // Validate node elements
            if (!sourceNodeElement || !targetNodeElement) {
                Logger.warn('Connection Rendering Failed', {
                    message: 'Source or target node element not found',
                    sourceNodeId: connection.sourceNode?.id,
                    targetNodeId: connection.targetNode?.id
                });
                return null;
            }

            // Use JsPlumbWrapper to connect nodes
            const jsPlumbConnection = JsPlumbWrapper.connectNodes(
                sourceNodeElement, 
                targetNodeElement, 
                {
                    interfaceType: connection.sourceInterface?.type,
                    label: connection.label || '',
                    // Additional connection details can be passed here
                }
            );

            // Optional: Additional connection configuration or logging
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
    }, []);

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
                renderConnection(connection);
            } catch (error) {
                Logger.error('Failed to render individual connection', {
                    connectionId: connection.id,
                    errorMessage: error.message
                });
            }
        });
    }, [renderConnection]);

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

    // Add keyboard event listener for node deletion
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Delete or Backspace key to remove selected node
            if ((event.key === 'Delete' || event.key === 'Backspace') && contextMenu) {
                deleteNode(contextMenu.node.id);
                setContextMenu(null);
            }
        };

        // Add event listener
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [deleteNode, contextMenu]);

    /**
     * Handle endpoint selection for connection creation
     * @param {Object} node - Selected node
     * @param {Object} endpoint - Selected endpoint
     */
    const handleEndpointSelection = useCallback((node, endpoint) => {
        try {
            // Comprehensive logging for endpoint selection
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
                    // First endpoint selection (source)
                    setConnectionState({
                        sourceNode: node,
                        sourceEndpoint: {
                            ...endpoint,
                            nodeId: node.id,
                            interfaceType: endpoint.type  // Explicitly set interface type
                        },
                        stage: 'SOURCE_SELECTED'
                    });
                    break;

                case 'SOURCE_SELECTED':
                    // Second endpoint selection (destination)
                    const sourceNode = connectionState.sourceNode;
                    const sourceEndpoint = connectionState.sourceEndpoint;
                    
                    // Comprehensive logging for connection attempt
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
                            interfaceType: endpoint.type  // Explicitly set interface type
                        }
                    });

                    // Attempt to create connection
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

                    // Render connection if successful
                    if (connectionResult) {
                        renderConnection(connectionResult);
                        
                        // Show success toast
                        toast.success(`Connected ${sourceEndpoint.name} to ${endpoint.name}`);
                    }

                    // Reset connection state
                    setConnectionState({
                        sourceNode: null,
                        sourceEndpoint: null,
                        stage: 'IDLE'
                    });
                    break;

                default:
                    break;
            }

            // Close context menu
            setContextMenu(null);
        } catch (error) {
            // Catch-all error handler
            Logger.error('Endpoint Selection Error', {
                error: error.message,
                stack: error.stack,
                connectionState
            });
            
            // Reset connection state and close context menu
            setConnectionState({
                sourceNode: null,
                sourceEndpoint: null,
                stage: 'IDLE'
            });
            setContextMenu(null);
            
            // Show generic error toast
            toast.error('An unexpected error occurred');
        }
    }, [connectionState, renderConnection]);

    /**
     * Drag and drop event handlers
     */
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        const iconPath = e.dataTransfer.getData('iconPath');
        
        if (!nodeType || !iconPath) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;
        const y = Math.round((e.clientY - rect.top) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;

        createNode(nodeType, iconPath, { clientX: x, clientY: y });
    }, [createNode]);

    /**
     * Handle canvas click to close context menu
     * @param {Event} e - Click event
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
        // Use JsPlumbCoreWrapper to ensure DOM readiness
        JsPlumbCoreWrapper.ready(() => {
            if (containerRef.current) {
                // Initialize jsPlumb with the container
                jsPlumbInstance.current = JsPlumbWrapper.initialize(containerRef.current);

                // Render existing connections after a short delay to ensure DOM is ready
                const renderTimer = setTimeout(() => {
                    renderExistingConnections(TopologyManager.topology);
                }, 100);

                // Cleanup function
                return () => {
                    clearTimeout(renderTimer);
                    JsPlumbWrapper.destroy();
                };
            }
        });
    }, [renderExistingConnections]);

    const createMultipleNodes = useCallback(async (nodeConfig, count) => {
        const { type, iconPath, x, y } = nodeConfig;
        const nodes = [];

        // Load device-specific endpoint configuration
        const endpointConfig = await EndpointConfigLoader.loadDeviceEndpoints(iconPath);

        // Extract device type from icon path
        const deviceType = iconPath
            .split('/')           // Split by path separator
            .pop()                // Get the filename
            .replace(/\.(svg|png)$/, '');  // Remove .svg or .png extension

        // Update the device type count for all nodes at once
        const currentCount = deviceTypeCount[deviceType] || 0;
        setDeviceTypeCount(prevCount => ({
            ...prevCount,
            [deviceType]: currentCount + count
        }));

        // Create multiple nodes in a grid-like sequence
        for (let i = 0; i < count; i++) {
            const nodeId = generateUUID();  // Generate unique node ID
            const nodeX = x + (i % 5) * 100;  // Spread nodes horizontally
            const nodeY = y + Math.floor(i / 5) * 100;  // Move to next row after 5 nodes

            const newNode = {
                id: nodeId,
                type: deviceType,
                name: generateNodeName(deviceType, i),  // Pass index for sequential naming
                iconPath: iconPath,
                position: { x: nodeX, y: nodeY },
                endpoints: (endpointConfig?.interfaces || []).map(endpoint => ({
                    ...endpoint,
                    id: generateUUID(),
                    nodeId: nodeId,
                    originalName: endpoint.name
                }))
            };

            // Add node to ConnectionManager topology first
            TopologyManager.addTopologyNode(newNode);
            nodes.push(newNode);
        }

        // Add nodes to state
        setNodes(prev => [...prev, ...nodes]);

        // Setup jsPlumb endpoints after rendering
        setTimeout(() => {
            nodes.forEach(newNode => {
                const nodeElement = document.getElementById(newNode.id);
                if (nodeElement && jsPlumbInstance.current) {
                    // Create jsPlumb endpoints for the node
                    const jsPlumbEndpoints = newNode.endpoints.map((endpoint, index) => {
                        const endpointOptions = {
                            anchor: ['Left', 'Right', 'Top', 'Bottom'][index % 4],
                            source: true,
                            target: true
                        };

                        return jsPlumbInstance.current.addEndpoint(
                            nodeElement, 
                            endpointOptions,
                            {
                                endpoint: endpoint.type === 'ethernet' 
                                    ? JsPlumbCoreWrapper.createDotEndpoint({
                                        paintStyle: { 
                                            fill: '#0066aa',
                                            radius: 5 
                                        }
                                    }) 
                                    : JsPlumbCoreWrapper.createBlankEndpoint({
                                        paintStyle: { 
                                            fill: '#ff6347',
                                            radius: 5 
                                        }
                                    }),
                                paintStyle: { 
                                    fill: endpoint.type === 'ethernet' ? '#0066aa' : '#ff6347',
                                    radius: 5 
                                }
                            }
                        );
                    });

                    // Prepare library-specific node data for ConnectionManager
                    const libraryNodeData = {
                        element: nodeElement,
                        jsPlumbEndpoints: jsPlumbEndpoints,
                        id: newNode.id,
                        type: newNode.type
                    };

                    // Register node with ConnectionManager
                    TopologyManager.registerTopologyNode(
                        newNode,  // Actual node data
                        libraryNodeData  // Library-specific node representation
                    );

                    // Store node reference
                    nodesRef.current[newNode.id] = {
                        node: newNode,
                        jsPlumbEndpoints: jsPlumbEndpoints
                    };
                }
            });
        }, 0);

        Logger.info('Multiple Nodes Created', { 
            deviceType, 
            nodeCount: nodes.length,
            iconPath,
            topology: TopologyManager.topology
        });
    }, [generateNodeName]);

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
        // TODO: Implement undo functionality
        toast.info('Undo functionality coming soon');
    }, []);

    const handleRedo = useCallback(() => {
        // TODO: Implement redo functionality
        toast.info('Redo functionality coming soon');
    }, []);

    const renderContextMenu = useMemo(() => {
        if (!contextMenu) return null;

        return (
            <Menu
                open={!!contextMenu}
                onClose={() => setContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu 
                        ? { 
                            top: contextMenu.mouseY, 
                            left: contextMenu.mouseX 
                        }
                        : undefined
                }
                PaperProps={{
                    style: {
                        maxHeight: 300,
                        width: '250px',
                    }
                }}
            >
                {/* Endpoint Selection Section */}
                <MenuItem disabled>
                    <Typography variant="subtitle2">
                        {connectionState.stage === 'SOURCE_SELECTED' 
                            ? 'Select Destination Endpoint' 
                            : 'Select Source Endpoint'}
                    </Typography>
                </MenuItem>
                {contextMenu.endpoints.map((endpoint, index) => (
                    <MenuItem 
                        key={`${endpoint.name}-${index}`}
                        onClick={() => handleEndpointSelection(contextMenu.node, endpoint)}
                    >
                        {endpoint.name} ({endpoint.type})
                    </MenuItem>
                ))}

                {/* Delete Node Option */}
                <Divider />
                <MenuItem 
                    onClick={() => {
                        deleteNode(contextMenu.node.id);
                        setContextMenu(null);
                    }}
                    sx={{
                        color: 'error.main',
                        '&:hover': {
                            backgroundColor: 'error.light',
                            color: 'error.contrastText'
                        }
                    }}
                >
                    <ListItemIcon>
                        <DeleteIcon color="error" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Delete Node" 
                        primaryTypographyProps={{color: 'error'}} 
                    />
                </MenuItem>
            </Menu>
        );
    }, [contextMenu, connectionState, deleteNode, handleEndpointSelection]);

    // Render network diagram
    return (
        <div className="network-diagram">
            <div
                ref={containerRef}
                className="diagram-container"
                style={{
                    flex: 1,
                    minHeight: 'calc(100vh - 48px)', // Adjust for dense toolbar
                    ...backgroundStyles
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleCanvasClick}  
            >
                {/* Render Nodes */}
                {nodes.map(node => (
                    <div 
                        id={node.id}
                        key={node.id}
                        className={`network-node ${
                            connectionState.stage === 'SOURCE_SELECTED' 
                                ? 'connection-target-highlight' 
                                : ''
                        }`}
                        style={{
                            position: 'absolute',
                            left: node.position.x,
                            top: node.position.y
                        }}
                        onContextMenu={(e) => handleContextMenu(e, node)}
                    >
                        <img 
                            src={node.iconPath}
                            alt={node.type}
                        />
                    </div>
                ))}

                {/* Context Menu for Endpoint Selection */}
                {renderContextMenu}

                {/* Node Configuration Modal */}
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
            </div>
        </div>
    );
}
