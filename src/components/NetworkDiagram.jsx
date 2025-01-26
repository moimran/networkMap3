/**
 * NetworkDiagram Component
 * 
 * A container component for the network diagram workspace.
 * This component will be enhanced with jsPlumb functionality in future iterations.
 * 
 * Design Considerations:
 * - Component is designed to be library-agnostic for future flexibility
 * - Uses CSS modules for styling isolation
 * - Maintains a clean separation of concerns
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ready, newInstance, ContainmentType } from "@jsplumb/browser-ui"
import '../styles/NetworkDiagram.css';

// Configuration and Path Management
// Centralized configuration to make path and library changes easier
const NETWORK_DIAGRAM_CONFIG = {
    // Centralized path configuration
    PATHS: {
        DEVICE_CONFIG: '/configs/devices',
        ICONS: '/assets/icons',
        ENDPOINTS: '/configs/endpoints'
    },
    
    // Library configuration for easy swapping
    LIBRARY_OPTIONS: {
        jsPlumb: {
            connectorType: 'Bezier',
            endpointType: 'Dot'
        }
    }
};

/**
 * Performance Monitoring Utility
 * Provides standardized performance tracking methods
 */
const PerformanceMonitor = {
    /**
     * Start measuring performance for a specific operation
     * @param {string} label - Unique identifier for the performance measurement
     * @returns {number} Start timestamp
     */
    startMeasure: (label) => {
        console.time(label);
        return Date.now();
    },

    /**
     * End performance measurement and log results
     * @param {number} startTime - Timestamp from startMeasure
     * @param {string} label - Unique identifier for the performance measurement
     */
    endMeasure: (startTime, label) => {
        const duration = Date.now() - startTime;
        console.timeEnd(label);
        
        // Log performance warnings for slow operations
        if (duration > 50) {
            console.warn(`Performance warning: ${label} took ${duration}ms`);
        }
    }
};

/**
 * Connection State Management Utility
 * Provides a centralized state management for network connections
 */
const ConnectionStateManager = {
    // Connection creation stages for clear state tracking
    STAGES: {
        IDLE: 'idle',
        SOURCE_SELECTED: 'source_selected',
        DESTINATION_SELECTED: 'destination_selected'
    },

    /**
     * Create a connection state handler
     * @param {Function} setConnectionState - State setter function
     * @returns {Object} Connection state management methods
     */
    createHandler: (setConnectionState) => ({
        /**
         * Initiate connection from a source node
         * @param {Object} sourceNode - Source node details
         * @param {Object} sourceEndpoint - Selected source endpoint
         */
        startConnection: (sourceNode, sourceEndpoint) => {
            console.log('Connection Creation Started', {
                sourceNodeId: sourceNode.id,
                sourceEndpointInterface: sourceEndpoint.interfaceName,
                timestamp: Date.now()
            });

            setConnectionState(prev => ({
                ...prev,
                sourceNode,
                sourceEndpoint,
                stage: ConnectionStateManager.STAGES.SOURCE_SELECTED
            }));
        },

        /**
         * Complete connection to a destination node
         * @param {Object} targetNode - Destination node details
         * @param {Object} targetEndpoint - Selected target endpoint
         * @param {Function} createConnectionFn - Function to create connection
         */
        completeConnection: (targetNode, targetEndpoint, createConnectionFn) => {
            setConnectionState(prev => {
                // Validate connection state before proceeding
                if (!prev.sourceNode || !prev.sourceEndpoint) {
                    console.warn('Invalid connection state', {
                        currentState: prev,
                        timestamp: Date.now()
                    });
                    return prev;
                }

                // Create connection
                const newConnection = createConnectionFn(
                    prev.sourceEndpoint, 
                    targetEndpoint
                );

                console.log('Connection Created', {
                    sourceNodeId: prev.sourceNode.id,
                    sourceEndpointInterface: prev.sourceEndpoint.interfaceName,
                    targetNodeId: targetNode.id,
                    targetEndpointInterface: targetEndpoint.interfaceName,
                    timestamp: Date.now()
                });

                // Reset connection state
                return {
                    sourceNode: null,
                    sourceEndpoint: null,
                    targetNode: null,
                    targetEndpoint: null,
                    stage: ConnectionStateManager.STAGES.IDLE
                };
            });
        },

        /**
         * Reset connection creation process
         */
        resetConnection: (setConnectionState) => {
            setConnectionState({
                sourceNode: null,
                sourceEndpoint: null,
                targetNode: null,
                targetEndpoint: null,
                stage: ConnectionStateManager.STAGES.IDLE
            });
        }
    })
};

/**
 * Batch-optimized connection creation
 * Provides a standardized method for creating network connections
 * @param {Object} jsPlumbInstance - jsPlumb library instance
 * @param {Object} sourceEndpoint - Source endpoint for connection
 * @param {Object} targetEndpoint - Target endpoint for connection
 * @returns {Object|null} Created connection or null
 */
const createBatchConnection = (jsPlumbInstance, sourceEndpoint, targetEndpoint) => {
    // Validate jsPlumb instance
    if (!jsPlumbInstance || !jsPlumbInstance.current) {
        console.error('Invalid jsPlumb Instance for connection', {
            timestamp: new Date().toISOString()
        });
        return null;
    }

    let createdConnection = null;

    // Use batch to optimize connection creation
    jsPlumbInstance.current.batch(() => {
        try {
            // Create connection with comprehensive options
            createdConnection = jsPlumbInstance.current.connect({
                source: sourceEndpoint,
                target: targetEndpoint,
                connector: [
                    NETWORK_DIAGRAM_CONFIG.LIBRARY_OPTIONS.jsPlumb.connectorType, 
                    { 
                        curviness: 50,  // Smooth curve
                        stub: 20,       // Stub length
                        gap: 5          // Gap between connector and endpoint
                    }
                ],
                paintStyle: { 
                    strokeWidth: 2, 
                    stroke: '#61dafb',  // React blue
                    outlineStroke: 'transparent',
                    outlineWidth: 2
                },
                hoverPaintStyle: { 
                    strokeWidth: 3, 
                    stroke: '#ff6347'  // Highlight color
                },
                overlays: [
                    ['Arrow', { 
                        location: 1,     // Arrow at the end
                        width: 10,       // Arrow width
                        length: 10       // Arrow length
                    }]
                ],
                endpoint: NETWORK_DIAGRAM_CONFIG.LIBRARY_OPTIONS.jsPlumb.endpointType,
                endpointStyle: { 
                    radius: 5, 
                    fill: '#61dafb' 
                }
            });

            // Add connection metadata
            if (createdConnection) {
                createdConnection.sourceInterfaceName = sourceEndpoint.interfaceName;
                createdConnection.targetInterfaceName = targetEndpoint.interfaceName;
            }

            console.log('Connection Created', {
                sourceId: sourceEndpoint.elementId,
                targetId: targetEndpoint.elementId,
                timestamp: new Date().toISOString()
            });
        } catch (connectionError) {
            console.error('Batch connection creation failed', {
                error: connectionError,
                sourceEndpoint,
                targetEndpoint,
                timestamp: new Date().toISOString()
            });
        }
    });

    return createdConnection;
};

/**
 * Main Network Diagram Component
 * Provides a flexible and modular network visualization interface
 */
export default function NetworkDiagram() {
    // Refs for managing jsPlumb and container
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);

    // State management for nodes and connections
    const [nodes, setNodes] = useState([]);
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        targetNode: null,
        targetEndpoint: null,
        stage: ConnectionStateManager.STAGES.IDLE
    });
    const [contextMenu, setContextMenu] = useState(null);

    // Initialize jsPlumb instance
    useEffect(() => {
        if (!containerRef.current) return;

        ready(() => {
            jsPlumbInstance.current = createNewInstance(containerRef.current);
        });

        return () => {
            if (jsPlumbInstance.current) {
                jsPlumbInstance.current.destroy();
            }
        };
    }, []);

    // Dynamically add endpoints to nodes
    useEffect(() => {
        if (!jsPlumbInstance.current) return;

        nodes.forEach(node => {
            const element = document.getElementById(node.id);
            if (element) {
                // Dynamically load device-specific configuration
                const configFileName = extractConfigFileName(node.iconPath);
                
                if (!configFileName) {
                    // Fallback to default endpoints
                    const defaultEndpoints = createDefaultEndpoints(jsPlumbInstance, element);
                    setNodes(prevNodes => 
                        prevNodes.map(n => 
                            n.id === node.id 
                                ? {...n, endpoints: defaultEndpoints} 
                                : n
                        )
                    );
                    return;
                }

                // Fetch and apply device-specific endpoint configuration
                fetch(`${NETWORK_DIAGRAM_CONFIG.PATHS.DEVICE_CONFIG}/${configFileName}`)
                    .then(response => response.ok ? response.json() : null)
                    .then(config => {
                        const configuredEndpoints = config 
                            ? createConfiguredEndpoints(jsPlumbInstance, element, config, () => {}) 
                            : createDefaultEndpoints(jsPlumbInstance, element);
                        
                        // Update node with endpoints
                        setNodes(prevNodes => 
                            prevNodes.map(n => 
                                n.id === node.id 
                                    ? {...n, endpoints: configuredEndpoints} 
                                    : n
                            )
                        );
                    })
                    .catch(error => {
                        console.error(`Error loading config for ${node.id}:`, error);
                        const defaultEndpoints = createDefaultEndpoints(jsPlumbInstance, element);
                        setNodes(prevNodes => 
                            prevNodes.map(n => 
                                n.id === node.id 
                                    ? {...n, endpoints: defaultEndpoints} 
                                    : n
                            )
                        );
                    });
            }
        });
    }, [nodes]);

    // Drag and drop event handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        const iconPath = e.dataTransfer.getData('iconPath');
        
        if (!nodeType || !iconPath) return;

        // Calculate drop coordinates
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create new node with unique identifier
        const newNode = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            position: { x, y },
            iconPath: iconPath
        };

        setNodes(prev => [...prev, newNode]);
    };

    // Connection creation function
    const createConnection = useCallback((sourceEndpoint, targetEndpoint) => {
        const startTime = PerformanceMonitor.startMeasure('createConnection');

        // Create connection using batch method
        const connection = createBatchConnection(
            jsPlumbInstance, 
            sourceEndpoint, 
            targetEndpoint
        );

        // Track performance
        PerformanceMonitor.endMeasure(startTime, 'createConnection');

        return connection;
    }, []);

    // Connection state handler
    const connectionStateHandler = useMemo(() => 
        ConnectionStateManager.createHandler(setConnectionState), 
        [setConnectionState]
    );

    // Endpoint selection handler
    const handleEndpointSelect = useCallback((selectedEndpoint, selectedNode) => {
        // Handle connection creation based on current stage
        switch (connectionState.stage) {
            case ConnectionStateManager.STAGES.IDLE:
                connectionStateHandler.startConnection(selectedNode, selectedEndpoint);
                break;
            
            case ConnectionStateManager.STAGES.SOURCE_SELECTED:
                connectionStateHandler.completeConnection(
                    selectedNode, 
                    selectedEndpoint, 
                    createConnection
                );
                break;
            
            default:
                console.warn('Unexpected connection stage', {
                    stage: connectionState.stage,
                    timestamp: Date.now()
                });
        }

        // Close context menu
        setContextMenu(null);
    }, [connectionState, connectionStateHandler, createConnection]);

    return (
        <div 
            ref={containerRef}
            className="network-diagram-container"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Render network nodes */}
            {nodes.map(node => (
                <div
                    key={node.id}
                    id={node.id}
                    className={`network-node ${
                        connectionState.stage === ConnectionStateManager.STAGES.SOURCE_SELECTED 
                            ? 'connection-target-highlight' 
                            : ''
                    }`}
                    style={{
                        position: 'absolute',
                        left: node.position.x,
                        top: node.position.y,
                        cursor: 'move'
                    }}
                    onContextMenu={(event) => {
                        // Context menu handling based on connection stage
                        const nodeEndpoints = node.endpoints || [];
                        
                        event.preventDefault();
                        event.stopPropagation();

                        setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            node: node,
                            endpoints: nodeEndpoints,
                            type: connectionState.stage === ConnectionStateManager.STAGES.SOURCE_SELECTED 
                                ? 'destination-selection' 
                                : 'source-selection'
                        });
                    }}
                >
                    <img 
                        src={node.iconPath}
                        alt={node.type}
                        draggable={false}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    />
                </div>
            ))}
            
            {/* Context Menu Rendering */}
            {contextMenu && (
                <div 
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px',
                        zIndex: 1000
                    }}
                >
                    <h4>
                        {contextMenu.type === 'destination-selection'
                            ? 'Select Destination Endpoint' 
                            : 'Select Source Endpoint'}
                    </h4>
                    {contextMenu.endpoints.map((endpoint, index) => (
                        <div 
                            key={`${endpoint.id}-${index}`}
                            onClick={() => handleEndpointSelect(endpoint, contextMenu.node)}
                            style={{
                                cursor: 'pointer',
                                padding: '5px',
                                borderBottom: '1px solid #eee'
                            }}
                        >
                            {endpoint.interfaceName}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
