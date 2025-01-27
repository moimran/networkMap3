import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
    ready, 
    newInstance, 
    BlankEndpoint, 
    DotEndpoint 
} from "@jsplumb/browser-ui";
import '../styles/NetworkDiagram.css';
import { CANVAS_THEMES } from '../constants/themes';
import { 
    NETWORK_DIAGRAM_CONFIG, 
    Logger, 
    EndpointConfigLoader,
    generateUUID  
} from '../utils/NetworkDiagramConfig';
import ConnectionManager from '../utils/ConnectionManager';
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

// Singleton jsPlumb instance management
const JsPlumbSingleton = (() => {
    let instance = null;
    
    return {
        /**
         * Get or create a jsPlumb instance
         * @param {HTMLElement} container - Container element for jsPlumb
         * @returns {Object} jsPlumb instance
         */
        getInstance: (container) => {
            if (!instance) {
                instance = newInstance({
                    container: container,
                    dragOptions: { 
                        cursor: 'move', 
                        grid: [
                            NETWORK_DIAGRAM_CONFIG.GRID.SIZE, 
                            NETWORK_DIAGRAM_CONFIG.GRID.SIZE
                        ]
                    },
                    connectionType: 'basic'
                });

                // Bind connection events for logging
                instance.bind('connection', (info) => {
                    Logger.info('jsPlumb Connection Event', {
                        sourceId: info.sourceId,
                        targetId: info.targetId,
                        sourceNode: info.source?.dataset?.nodeName,
                        targetNode: info.target?.dataset?.nodeName
                    });
                });

                Logger.info('JSPlumb Initialized', {
                    gridSize: NETWORK_DIAGRAM_CONFIG.GRID.SIZE
                });
            }
            return instance;
        },

        /**
         * Destroy the jsPlumb instance
         */
        destroy: () => {
            if (instance) {
                instance.destroy();
                instance = null;
            }
        }
    };
})();

/**
 * NetworkDiagram Component
 * Renders an interactive network diagram with draggable nodes and connections
 * 
 * @param {Object} props
 * @param {string} props.currentTheme - Current theme ID for the canvas
 */
const NetworkDiagram = ({ currentTheme }) => {
    // Refs and basic state
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
    const generateNodeName = useCallback((deviceType) => {
        // Use functional state update to ensure correct incrementation
        setDeviceTypeCount(prevCount => {
            const updatedDeviceTypeCount = {...prevCount};
            updatedDeviceTypeCount[deviceType] = (updatedDeviceTypeCount[deviceType] || 0) + 1;
            return updatedDeviceTypeCount;
        });

        // Get the current count after update
        const currentCount = (deviceTypeCount[deviceType] || 0) + 1;

        // Generate the name: {device_type}-{n}
        return `${deviceType}-${currentCount}`;
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

            // Safely extract connection type
            const connectionType = connection.sourceInterface?.type?.toLowerCase() === 'serial' 
                ? 'SERIAL' 
                : 'ETHERNET';

            // Prepare connection configuration
            const connectionConfig = {
                source: sourceNodeElement,
                target: targetNodeElement,
                ...NETWORK_DIAGRAM_CONFIG.CONNECTION_TYPES[connectionType]
            };

            // Temporarily remove overlay configuration
            // const overlays = createConnectionOverlay(connection);
            // if (overlays) {
            //     connectionConfig.overlays = overlays;
            // }

            // Create connection with comprehensive error handling
            let jsPlumbConnection;
            try {
                jsPlumbConnection = jsPlumbInstance.current.connect(connectionConfig);
            } catch (connectError) {
                Logger.error('jsPlumb Connection Creation Failed', {
                    errorMessage: connectError.message,
                    errorStack: connectError.stack,
                    connectionConfig: JSON.stringify(connectionConfig)
                });
                return null;
            }

            // Log successful connection rendering
            Logger.info('Connection Rendered Successfully', {
                connectionId: connection.id,
                sourceNodeId: connection.sourceNode?.id,
                targetNodeId: connection.targetNode?.id,
                connectionType
            });

            return jsPlumbConnection;
        } catch (error) {
            // Comprehensive error logging
            Logger.error('Comprehensive Connection Rendering Error', {
                errorMessage: error.message,
                errorStack: error.stack,
                connectionDetails: connection
            });

            return null;
        }
    }, []);

    const renderExistingConnections = useCallback(async (loadedDiagram) => {
        // Get existing connections from ConnectionManager
        const existingConnections = Object.values(ConnectionManager.topology.connections || {});
        
        // Early return if no connections exist
        if (!existingConnections || existingConnections.length === 0) {
            Logger.info('No existing connections to render', {
                connectionCount: 0,
                diagramName: loadedDiagram?.name || 'Unnamed Diagram'
            });
            return;
        }

        Logger.info('Rendering Existing Connections', {
            connectionCount: existingConnections.length,
            diagramName: loadedDiagram?.name || 'Unnamed Diagram'
        });

        try {
            // Iterate through existing connections
            for (const connection of existingConnections) {
                // Ensure source and target nodes exist
                const sourceNode = document.getElementById(connection.sourceNodeId);
                const targetNode = document.getElementById(connection.targetNodeId);

                if (!sourceNode || !targetNode) {
                    Logger.warn('Skipping connection due to missing nodes', {
                        sourceNodeId: connection.sourceNodeId,
                        targetNodeId: connection.targetNodeId
                    });
                    continue;
                }

                // Create connection using jsPlumb
                if (jsPlumbInstance.current) {
                    jsPlumbInstance.current.connect({
                        source: sourceNode,
                        target: targetNode,
                        type: connection.type || 'basic'
                    });
                }
            }
        } catch (error) {
            Logger.error('Error rendering existing connections', {
                error: error.message,
                stack: error.stack
            });
        }
    }, []);

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
        const relatedConnections = Object.values(ConnectionManager.topology.connections)
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
                ConnectionManager.removeConnectionTopology(
                    ConnectionManager.generateConnectionKey(
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
        ConnectionManager.removeTopologyNode(nodeId);

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
            Logger.info('Detailed Endpoint Selection', {
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
                    const connectionResult = ConnectionManager.createConnection(
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
        // Ensure container is available
        if (!containerRef.current) return;

        // Use singleton to get or create jsPlumb instance
        jsPlumbInstance.current = JsPlumbSingleton.getInstance(containerRef.current);

        // Render existing connections after a short delay to ensure DOM is ready
        const renderTimer = setTimeout(() => {
            renderExistingConnections(ConnectionManager.topology);
        }, 100);

        // Cleanup function
        return () => {
            clearTimeout(renderTimer);
            JsPlumbSingleton.destroy();
        };
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

        // Create multiple nodes in a grid-like sequence
        for (let i = 0; i < count; i++) {
            const nodeId = generateUUID();  // Generate unique node ID
            const nodeX = x + (i % 5) * 100;  // Spread nodes horizontally
            const nodeY = y + Math.floor(i / 5) * 100;  // Move to next row after 5 nodes

            const newNode = {
                id: nodeId,
                type: deviceType,
                name: generateNodeName(deviceType),
                iconPath: iconPath,
                position: { x: nodeX, y: nodeY },
                // Enhance endpoints with unique identifiers
                endpoints: (endpointConfig?.interfaces || []).map(endpoint => ({
                    ...endpoint,
                    id: generateUUID(),  // Add unique ID to each endpoint
                    nodeId: nodeId,      // Link endpoint to its node
                    originalName: endpoint.name  // Preserve original name
                }))
            };

            // Add node to ConnectionManager topology first
            ConnectionManager.addTopologyNode(newNode);
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
                                endpoint: endpoint.type === 'ethernet' ? DotEndpoint : BlankEndpoint,
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
                    ConnectionManager.registerTopologyNode(
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
            topology: ConnectionManager.topology
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
};

export default NetworkDiagram;
