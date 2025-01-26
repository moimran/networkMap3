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
    PerformanceLogger, 
    EndpointConfigLoader 
} from '../utils/NetworkDiagramConfig';
import ConnectionManager from '../utils/ConnectionManager';

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
                    PerformanceLogger.log('jsPlumb Connection Event', {
                        sourceId: info.sourceId,
                        targetId: info.targetId
                    });
                });

                PerformanceLogger.log('JSPlumb Initialized', {
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

        const newNode = {
            id: `node-${Date.now()}`,
            type: deviceType,  // Use extracted device type
            iconPath: iconPath,
            position: { x, y },
            endpoints: endpointConfig?.interfaces || []
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
                PerformanceLogger.log('Node Registration', {
                    nodeId: newNode.id,
                    registrationResult
                });

                // Store node reference
                nodesRef.current[newNode.id] = {
                    node: newNode,
                    jsPlumbEndpoints: jsPlumbEndpoints
                };
            }
        }, 0);

        PerformanceLogger.log('Node Created', { 
            deviceType, 
            iconPath, 
            position: newNode.position 
        });
        return newNode;
    }, []);

    /**
     * Handle endpoint selection for connection creation
     * @param {Object} selectedNode - Node being selected
     * @param {Object} selectedEndpoint - Endpoint being selected
     */
    const handleEndpointSelection = useCallback((selectedNode, selectedEndpoint) => {
        // Debug logging for connection state
        PerformanceLogger.log('Endpoint Selection', {
            nodeId: selectedNode.id,
            endpointName: selectedEndpoint.name,
            currentStage: connectionState.stage
        });

        switch (connectionState.stage) {
            case 'IDLE':
                // Start connection from source
                setConnectionState({
                    sourceNode: selectedNode,
                    sourceEndpoint: selectedEndpoint,
                    stage: 'SOURCE_SELECTED'
                });
                PerformanceLogger.log('Connection Source Selected', {
                    nodeId: selectedNode.id,
                    endpointName: selectedEndpoint.name
                });
                break;

            case 'SOURCE_SELECTED':
                // Complete connection
                if (selectedNode.id !== connectionState.sourceNode.id) {
                    const connectionType = selectedEndpoint.type === 'serial' 
                        ? 'SERIAL' 
                        : 'ETHERNET';

                    // Attempt to create connection
                    const connection = ConnectionManager.createConnection(
                        connectionState.sourceNode, 
                        selectedNode, 
                        connectionType
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
                            } catch (error) {
                                PerformanceLogger.error('jsPlumb Connection Visualization Failed', error);
                            }
                        }
                    }

                    // Reset connection state
                    setConnectionState({
                        sourceNode: null,
                        sourceEndpoint: null,
                        stage: 'IDLE'
                    });
                }
                break;

            default:
                break;
        }

        // Close context menu
        setContextMenu(null);
    }, [connectionState]);

    /**
     * Handle context menu for node
     * @param {Event} e - Context menu event
     * @param {Object} node - Node for which context menu is triggered
     */
    const handleContextMenu = useCallback((e, node) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            node: node,
            endpoints: node.endpoints || [],
            connectionStage: connectionState.stage
        });
    }, [connectionState.stage]);

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
            onClick={handleCanvasClick}  // Add click handler to container
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
                        zIndex: 1000
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
