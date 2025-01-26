import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
    ready, 
    newInstance, 
    BlankEndpoint, 
    DotEndpoint 
} from "@jsplumb/browser-ui";
import '../styles/NetworkDiagram.css';

// Import utility modules
import { 
    NETWORK_DIAGRAM_CONFIG, 
    Logger, 
    EndpointConfigLoader,
    generateUUID  
} from '../utils/NetworkDiagramConfig';
import ConnectionManager from '../utils/ConnectionManager';
import toast from '../utils/toast'; 

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

const NetworkDiagram = () => {
    // Refs for managing jsPlumb and container
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);
    const nodesRef = useRef({});

    // State management
    const [nodes, setNodes] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        stage: 'IDLE' // IDLE, SOURCE_SELECTED
    });
    const [deviceTypeCount, setDeviceTypeCount] = useState({});

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

        // Load device-specific endpoint configuration using icon path
        const endpointConfig = await EndpointConfigLoader.loadDeviceEndpoints(iconPath);

        // Extract device type from icon path
        const deviceType = iconPath
            .split('/')           // Split by path separator
            .pop()                // Get the filename
            .replace(/\.(svg|png)$/, '');  // Remove .svg or .png extension

        const nodeId = generateUUID();  // Generate unique node ID

        const newNode = {
            id: nodeId,
            type: deviceType,  // Use extracted device type
            name: generateNodeName(deviceType),
            iconPath: iconPath,
            position: { x, y },
            // Enhance endpoints with unique identifiers
            endpoints: (endpointConfig?.interfaces || []).map(endpoint => ({
                ...endpoint,
                id: generateUUID(),  // Add unique ID to each endpoint
                nodeId: nodeId,      // Link endpoint to its node
                originalName: endpoint.name  // Preserve original name
            }))
        };

        // Create node immediately
        setNodes(prev => [...prev, newNode]);

        // Setup jsPlumb endpoints after rendering
        setTimeout(() => {
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
                const registrationResult = ConnectionManager.registerNode(
                    newNode,  // Actual node data
                    libraryNodeData  // Library-specific node representation
                );

                // Log registration result
                Logger.info('Node Registration', {
                    nodeId: newNode.id,
                    nodeName: newNode.name,
                    nodeType: newNode.type,
                    registrationResult,
                    endpointCount: newNode.endpoints.length
                });

                // Store node reference
                nodesRef.current[newNode.id] = {
                    node: newNode,
                    jsPlumbEndpoints: jsPlumbEndpoints
                };
            }
        }, 0);

        Logger.info('Node Created', { 
            deviceType, 
            nodeName: newNode.name,
            iconPath, 
            position: newNode.position,
            endpointCount: newNode.endpoints.length
        });
        return newNode;
    }, [generateNodeName]);

    /**
     * Handle context menu for node endpoints
     * @param {Event} e - Context menu event
     * @param {Object} node - Node being right-clicked
     */
    const handleContextMenu = useCallback((e, node) => {
        // Prevent default context menu
        e.preventDefault();
        
        // Determine available endpoints based on connection stage
        let availableEndpoints = node.endpoints;

        // If a source endpoint is already selected, filter endpoints
        if (connectionState.stage === 'SOURCE_SELECTED') {
            // Filter endpoints to match the type of the source endpoint
            availableEndpoints = node.endpoints.filter(
                endpoint => 
                    endpoint.type === connectionState.sourceEndpoint.type && 
                    ConnectionManager.isEndpointAvailable(endpoint)
            );
        } else {
            // In IDLE state, show only available endpoints
            availableEndpoints = node.endpoints.filter(
                endpoint => ConnectionManager.isEndpointAvailable(endpoint)
            );
        }

        // Prevent showing context menu if no endpoints are available
        if (availableEndpoints.length === 0) {
            Logger.info('No Available Endpoints', {
                nodeId: node.id,
                nodeName: node.name,
                totalEndpoints: node.endpoints.length
            });
            return;
        }

        // Set context menu state
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            node: node,
            endpoints: availableEndpoints
        });

        Logger.info('Context Menu Opened', {
            nodeId: node.id,
            nodeName: node.name,
            totalEndpoints: node.endpoints.length,
            availableEndpoints: availableEndpoints.length
        });
    }, [connectionState.stage]);

    /**
     * Handle endpoint selection for connection creation
     * @param {Object} selectedNode - Node being selected
     * @param {Object} selectedEndpoint - Endpoint being selected
     */
    const handleEndpointSelection = useCallback((selectedNode, selectedEndpoint) => {
        // Debug logging for connection state
        Logger.info('Endpoint Selection', {
            nodeId: selectedNode.id,
            nodeName: selectedNode.name,
            endpointName: selectedEndpoint.name,
            currentStage: connectionState.stage
        });

        try {
            switch (connectionState.stage) {
                case 'IDLE':
                    // Check if endpoint is available
                    if (ConnectionManager.isEndpointAvailable(selectedEndpoint)) {
                        // Start connection from source
                        setConnectionState({
                            sourceNode: selectedNode,
                            sourceEndpoint: selectedEndpoint,
                            stage: 'SOURCE_SELECTED'
                        });
                    } else {
                        // Notify user that endpoint is already in use
                        Logger.info('Endpoint Already Used', {
                            nodeId: selectedNode.id,
                            nodeName: selectedNode.name,
                            endpointName: selectedEndpoint.name
                        });
                        
                        // Show warning about endpoint usage
                        toast.warning(`Endpoint ${selectedEndpoint.name} has reached maximum connections`);
                    }
                    break;

                case 'SOURCE_SELECTED':
                    // Prevent connecting to the same node
                    if (selectedNode.id === connectionState.sourceNode.id) {
                        Logger.info('Self Connection Prevented', {
                            nodeId: selectedNode.id,
                            nodeName: selectedNode.name
                        });
                        
                        // Reset connection state
                        setConnectionState({
                            sourceNode: null,
                            sourceEndpoint: null,
                            stage: 'IDLE'
                        });
                        break;
                    }

                    // Validate endpoint type compatibility
                    const isCompatibleEndpoint = 
                        selectedEndpoint.type === connectionState.sourceEndpoint.type;

                    if (!isCompatibleEndpoint) {
                        Logger.info('Incompatible Endpoint Types', {
                            sourceType: connectionState.sourceEndpoint.type,
                            targetType: selectedEndpoint.type,
                            sourceNodeId: connectionState.sourceNode.id,
                            sourceNodeName: connectionState.sourceNode.name,
                            targetNodeId: selectedNode.id,
                            targetNodeName: selectedNode.name
                        });
                        
                        // Show error about incompatible endpoint types
                        toast.error(`Cannot connect incompatible endpoint types: 
                            ${connectionState.sourceEndpoint.type} to ${selectedEndpoint.type}`);
                        
                        // Reset connection state
                        setConnectionState({
                            sourceNode: null,
                            sourceEndpoint: null,
                            stage: 'IDLE'
                        });
                        break;
                    }

                    try {
                        // Determine connection type based on endpoint type
                        const connectionType = selectedEndpoint.type === 'serial' 
                            ? 'SERIAL' 
                            : 'ETHERNET';

                        // Attempt to create connection
                        const connection = ConnectionManager.createConnection(
                            connectionState.sourceNode, 
                            selectedNode, 
                            connectionType,
                            connectionState.sourceEndpoint,
                            selectedEndpoint
                        );

                        // If connection is successful, use jsPlumb to visualize
                        if (connection && jsPlumbInstance.current) {
                            const sourceNodeData = nodesRef.current[connectionState.sourceNode.id];
                            const targetNodeData = nodesRef.current[selectedNode.id];

                            if (sourceNodeData && targetNodeData) {
                                try {
                                    jsPlumbInstance.current.connect({
                                        source: sourceNodeData.jsPlumbEndpoints[0],
                                        target: targetNodeData.jsPlumbEndpoints[0],
                                        ...NETWORK_DIAGRAM_CONFIG.CONNECTION_TYPES[connectionType]
                                    });

                                    // Show success toast
                                    toast.success(`Connected ${connectionState.sourceEndpoint.name} to ${selectedEndpoint.name}`);
                                } catch (visualizationError) {
                                    Logger.error('jsPlumb Connection Visualization Failed', visualizationError);
                                    
                                    // Rollback connection
                                    ConnectionManager.removeConnection(connection.id);
                                    
                                    toast.error('Failed to visualize connection');
                                }
                            }
                        }
                    } catch (connectionError) {
                        // Handle connection creation errors
                        Logger.error('Connection Creation Failed', connectionError);
                        
                        // Show detailed error message
                        toast.error(connectionError.message || 'Failed to create connection');
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
            Logger.error('Endpoint Selection Error', error);
            
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
    }, [connectionState]);

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
     * Initialize jsPlumb instance
     */
    useEffect(() => {
        // Ensure container is available
        if (!containerRef.current) return;

        // Use singleton to get or create jsPlumb instance
        jsPlumbInstance.current = JsPlumbSingleton.getInstance(containerRef.current);

        // Cleanup function
        return () => {
            JsPlumbSingleton.destroy();
        };
    }, []); 

    // Render network diagram
    return (
        <div 
            ref={containerRef}
            className="network-diagram-container"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleCanvasClick}  
        >
            {/* Render Nodes */}
            {nodes.map(node => (
                <div
                    key={node.id}
                    id={node.id}
                    className={`network-node ${
                        connectionState.stage === 'SOURCE_SELECTED' 
                            ? 'connection-target-highlight' 
                            : ''
                    }`}
                    style={{
                        position: 'absolute',
                        left: node.position.x,
                        top: node.position.y,
                        width: '80px',
                        height: '80px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'move'
                    }}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                >
                    <img 
                        src={node.iconPath}
                        alt={node.type}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                        }}
                    />
                </div>
            ))}

            {/* Context Menu for Endpoint Selection */}
            {contextMenu && (
                <div 
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px'
                    }}
                >
                    <h4>
                        {connectionState.stage === 'SOURCE_SELECTED' 
                            ? 'Select Destination Endpoint' 
                            : 'Select Source Endpoint'}
                    </h4>
                    {contextMenu.endpoints.map((endpoint, index) => (
                        <div 
                            key={`${endpoint.name}-${index}`}
                            onClick={() => handleEndpointSelection(contextMenu.node, endpoint)}
                            style={{
                                cursor: 'pointer',
                                padding: '5px',
                                borderBottom: '1px solid #eee'
                            }}
                        >
                            {endpoint.name} ({endpoint.type}) 
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NetworkDiagram;
