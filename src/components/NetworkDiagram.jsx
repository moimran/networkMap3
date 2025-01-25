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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ready, newInstance, ContainmentType } from "@jsplumb/browser-ui"
import '../styles/NetworkDiagram.css';

// Constants for configuration paths and defaults
const DEVICE_CONFIG_PATH = '/deviceconfig';
const FLOWCHART_CONNECTOR_STYLE = { 
    stroke: '#007bff', 
    strokeWidth: 2 
};
const DEFAULT_ANCHORS = ['Top', 'Bottom', 'Left', 'Right'];
const DEFAULT_ENDPOINT_OPTIONS = {
    type: 'Blank',
    options: {
        cssClass: 'endpoint-blank',
        hoverClass: 'endpoint-hover'
    }
};

/**
 * Custom hook for managing endpoint connections
 * @param {Object} jsPlumbInstance - The jsPlumb library instance
 * @returns {Object} Connection management functions
 */
const useEndpointConnections = (jsPlumbInstance) => {
    // Use a ref to track initialization to prevent unnecessary re-renders
    const initializationRef = useRef(false);

    // State for managing connection and context menu
    const [contextMenu, setContextMenu] = useState(null);
    const [connectionState, setConnectionState] = useState({
        sourceNode: null,
        sourceEndpoint: null,
        targetNode: null,
        targetEndpoint: null
    });

    // Memoize the connection creation function
    const createConnection = useCallback((sourceEndpoint, targetEndpoint) => {
        console.log('Creating connection', { 
            sourceEndpointId: sourceEndpoint.id,
            sourceElementId: sourceEndpoint.elementId,
            sourceInterfaceName: sourceEndpoint.interfaceName,
            targetEndpointId: targetEndpoint.id,
            targetElementId: targetEndpoint.elementId,
            targetInterfaceName: targetEndpoint.interfaceName
        });

        try {
            // Prevent connecting to the same node
            if (sourceEndpoint.elementId === targetEndpoint.elementId) {
                console.warn('Cannot connect endpoints on the same node', { 
                    sourceElementId: sourceEndpoint.elementId,
                    targetElementId: targetEndpoint.elementId
                });
                return;
            }

            // Create connection with Continuous anchors
            const connection = jsPlumbInstance.current.connect({
                source: sourceEndpoint,
                target: targetEndpoint,
                connector: 'Flowchart', // More flexible routing
                paintStyle: FLOWCHART_CONNECTOR_STYLE,
                anchors: [
                    ['Continuous', { faces: ['top', 'bottom', 'left', 'right'] }],
                    ['Continuous', { faces: ['top', 'bottom', 'left', 'right'] }]
                ],
                endpoint: DEFAULT_ENDPOINT_OPTIONS,
                overlays: [
                    { 
                        type: 'Label', 
                        options: { 
                            label: sourceEndpoint.interfaceName,
                            location: [0.2, -0.5], 
                            cssClass: 'connection-label source-label'
                        }
                    },
                    { 
                        type: 'Label', 
                        options: { 
                            label: targetEndpoint.interfaceName,
                            location: [0.8, -0.5], 
                            cssClass: 'connection-label destination-label'
                        }
                    }
                ],
                // Additional flowchart connector options for more flexible routing
                connectorOptions: {
                    stub: [30, 30],  // Minimum stub length
                    gap: 10,          // Small gap between endpoint and connector
                    cornerRadius: 10, // Rounded corners
                    midpoint: 0.5     // Centered midpoint
                }
            });

            console.log('Connection created successfully', { 
                connectionId: connection.id,
                sourceEndpoint: sourceEndpoint.interfaceName,
                targetEndpoint: targetEndpoint.interfaceName
            });

            // Reset connection state
            setConnectionState({
                sourceNode: null,
                sourceEndpoint: null,
                targetNode: null,
                targetEndpoint: null
            });
        } catch (error) {
            console.error('Connection Error', { 
                errorMessage: error.message,
                sourceEndpoint: sourceEndpoint.interfaceName,
                targetEndpoint: targetEndpoint.interfaceName,
                errorStack: error.stack
            });
        }
    }, [jsPlumbInstance]);

    // Only log initialization once
    useEffect(() => {
        if (!initializationRef.current) {
            console.log('Initializing useEndpointConnections hook', { 
                jsPlumbInstance,
                timestamp: new Date().toISOString(),
                stackTrace: new Error().stack.split('\n').slice(1, 5).join('\n')
            });
            initializationRef.current = true;
        }
    }, [jsPlumbInstance]);

    // Memoized right-click handler
    const handleRightClick = useCallback((e, nodes) => {
        console.log('Right-click event triggered', { 
            event: {
                type: e.type,
                target: e.target.id || e.target.className
            }, 
            nodesCount: nodes.length,
            nodeIds: nodes.map(node => node.id) 
        });
        
        e.preventDefault();
        
        const targetNode = e.target.closest('.diagram-node');
        if (targetNode) {
            const nodeId = targetNode.id;
            const node = nodes.find(n => n.id === nodeId);
            
            console.log('Right-click on node', { 
                nodeId, 
                nodeDetails: node ? {
                    id: node.id,
                    type: node.type
                } : null
            });
            
            // Use stored endpoints for the node
            const endpoints = node.endpoints || [];
            
            console.log('Node endpoints', { 
                nodeId, 
                endpointCount: endpoints.length,
                endpointSummary: endpoints.map(ep => ({
                    id: ep.id,
                    interfaceName: ep.interfaceName
                }))
            });
            
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                node: node,
                endpoints: endpoints
            });
        }
    }, []);

    // Memoized endpoint selection handler
    const handleEndpointSelect = useCallback((endpoint, node) => {
        console.log('Endpoint selection', { 
            endpointId: endpoint.id,
            endpointInterfaceName: endpoint.interfaceName,
            nodeId: node.id,
            currentConnectionState: {
                hasSourceEndpoint: !!connectionState.sourceEndpoint,
                hasTargetEndpoint: !!connectionState.targetEndpoint
            }
        });

        // If no source is selected, set as source
        if (!connectionState.sourceEndpoint) {
            console.log('Setting source endpoint', { 
                sourceEndpointId: endpoint.id, 
                sourceNodeId: node.id 
            });

            setConnectionState(prev => ({
                ...prev,
                sourceNode: node,
                sourceEndpoint: endpoint
            }));
            setContextMenu(null);
        } 
        // If source is already selected, set as target
        else {
            console.log('Setting target endpoint', { 
                targetEndpointId: endpoint.id, 
                targetNodeId: node.id,
                sourceEndpointId: connectionState.sourceEndpoint.id 
            });

            setConnectionState(prev => ({
                ...prev,
                targetNode: node,
                targetEndpoint: endpoint
            }));
            
            // Create connection
            createConnection(
                connectionState.sourceEndpoint, 
                endpoint
            );
            
            // Reset context menu and connection state
            setContextMenu(null);
        }
    }, [connectionState, createConnection]);

    // Memoized context menu close handler
    const handleCloseContextMenu = useCallback(() => {
        console.log('Closing context menu');
        setContextMenu(null);
    }, []);

    // Return hook methods
    return {
        contextMenu,
        connectionState,
        handleRightClick,
        handleEndpointSelect,
        handleCloseContextMenu
    };
};

/**
 * Create a new jsPlumb instance with standardized configuration
 * @param {HTMLElement} container - The container element for the jsPlumb instance
 * @returns {Object} - Configured jsPlumb instance
 */
const createNewInstance = (container) => {
    return newInstance({
        container: container,
        dragOptions: {
            cursor: 'pointer',
            zIndex: 2000,
            grid: { w: 20, h: 20 },
            containment: ContainmentType.notNegative
        }
    });
};

/**
 * Safely extract configuration file name from icon path
 * @param {string} iconPath - Path to the icon
 * @returns {string} Extracted configuration file name
 */
const extractConfigFileName = (iconPath) => {
    try {
        return iconPath.split('/').pop().replace(/\.(svg|png)$/, '.json');
    } catch (error) {
        console.warn('Error extracting config file name:', error);
        return null;
    }
};

/**
 * Calculate the most appropriate anchor position based on device location
 * @param {Object} sourceElement - Source DOM element
 * @param {Object} targetElements - Array of target DOM elements
 * @returns {string} Recommended anchor position
 */
const calculateDynamicAnchor = (sourceElement, targetElements) => {
    if (!sourceElement || !targetElements || targetElements.length === 0) {
        return 'Bottom'; // Default fallback
    }

    // Get source element's bounding rectangle
    const sourceRect = sourceElement.getBoundingClientRect();
    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;

    // Calculate average position of target elements
    const avgTargetPosition = targetElements.reduce((acc, target) => {
        const targetRect = target.getBoundingClientRect();
        return {
            x: acc.x + (targetRect.left + targetRect.width / 2),
            y: acc.y + (targetRect.top + targetRect.height / 2)
        };
    }, { x: 0, y: 0 });

    avgTargetPosition.x /= targetElements.length;
    avgTargetPosition.y /= targetElements.length;

    // Calculate relative positioning
    const deltaX = avgTargetPosition.x - sourceCenterX;
    const deltaY = avgTargetPosition.y - sourceCenterY;

    // Determine anchor based on relative position
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        return deltaX > 0 ? 'Right' : 'Left';
    } else {
        return deltaY > 0 ? 'Bottom' : 'Top';
    }
};

/**
 * Create endpoints from device configuration with dynamic anchor positioning
 * @param {Object} jsPlumbInstance - jsPlumb library instance
 * @param {HTMLElement} element - DOM element to add endpoints to
 * @param {Object} config - Device configuration object
 * @param {Function} registerEndpoints - Function to register node endpoints
 * @param {Array} [otherNodes] - Optional array of other nodes for positioning calculation
 * @returns {Array} Created endpoints
 */
const createConfiguredEndpoints = (jsPlumbInstance, element, config, registerEndpoints, otherNodes = []) => {
    if (!config || !config.interfaces) {
        console.warn('No interfaces found in configuration');
        return [];
    }

    const anchorPositions = [
        'Top', 'Bottom', 'Left', 'Right',
        'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'
    ];

    // Safely manage the element
    try {
        // Use a try-catch to handle potential method variations
        if (typeof jsPlumbInstance.current.manage === 'function') {
            jsPlumbInstance.current.manage(element);
        } else if (typeof jsPlumbInstance.current.addToDragSelection === 'function') {
            jsPlumbInstance.current.addToDragSelection(element);
        }
    } catch (managementError) {
        console.warn('Could not manage element:', managementError);
    }

    // Convert otherNodes to DOM elements if they are not already
    const targetElements = otherNodes
        .map(node => document.getElementById(node.id))
        .filter(el => el !== null);

    const createdEndpoints = config.interfaces.map((iface, index) => {
        try {
            // Dynamically calculate anchor if other nodes are provided
            const dynamicAnchor = targetElements.length > 0
                ? calculateDynamicAnchor(element, targetElements)
                : anchorPositions[index % anchorPositions.length];

            const endpointOptions = {
                anchor: dynamicAnchor,
                endpoint: DEFAULT_ENDPOINT_OPTIONS,
                connectorOverlays: [{ 
                    type: 'Label', 
                    options: { 
                        label: iface.name,
                        location: 0.5,
                        cssClass: 'connection-label' 
                    }
                }],
                source: true,
                target: true,
                maxConnections: -1
            };

            // Add the endpoint with enhanced error handling
            let endpoint;
            try {
                endpoint = jsPlumbInstance.current.addEndpoint(element, endpointOptions);
            } catch (addEndpointError) {
                console.error('Failed to add endpoint:', {
                    error: addEndpointError,
                    interfaceName: iface.name,
                    elementId: element.id
                });
                return null;
            }

            if (!endpoint) {
                console.error(`Failed to create endpoint for interface ${iface.name}`);
                return null;
            }

            // Attach interface name and dynamic anchor to the endpoint
            endpoint.interfaceName = iface.name;
            endpoint.dynamicAnchor = dynamicAnchor;

            return endpoint;
        } catch (error) {
            console.error(`Comprehensive error creating endpoint for ${iface.name}:`, {
                errorMessage: error.message,
                errorStack: error.stack,
                interfaceDetails: iface
            });
            return null;
        }
    }).filter(endpoint => endpoint !== null);

    // Register endpoints for this node
    registerEndpoints(element.id, createdEndpoints);

    return createdEndpoints;
};

/**
 * Create default endpoints for a node
 * @param {Object} jsPlumbInstance - jsPlumb library instance
 * @param {HTMLElement} element - DOM element to add endpoints to
 * @returns {Array} Created endpoints
 */
const createDefaultEndpoints = (jsPlumbInstance, element) => {
    // Safely manage the element
    try {
        // Use a try-catch to handle potential method variations
        if (typeof jsPlumbInstance.current.manage === 'function') {
            jsPlumbInstance.current.manage(element);
        } else if (typeof jsPlumbInstance.current.addToDragSelection === 'function') {
            jsPlumbInstance.current.addToDragSelection(element);
        }
    } catch (managementError) {
        console.warn('Could not manage element:', managementError);
    }

    return DEFAULT_ANCHORS.map(anchor => {
        try {
            const endpoint = jsPlumbInstance.current.addEndpoint(element, {
                anchor: anchor,
                endpoint: DEFAULT_ENDPOINT_OPTIONS,
                source: true,
                target: true,
                maxConnections: -1
            });

            return endpoint;
        } catch (error) {
            console.error(`Failed to create default endpoint at ${anchor}:`, error);
            return null;
        }
    }).filter(endpoint => endpoint !== null);
};

const NetworkDiagram = () => {
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);
    const [nodes, setNodes] = useState([]);

    // Use the custom endpoint connection hook
    const {
        contextMenu,
        connectionState,
        handleRightClick,
        handleEndpointSelect,
        handleCloseContextMenu
    } = useEndpointConnections(jsPlumbInstance);

    // Initialize jsPlumb
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

    // Add endpoints to nodes after they're added
    useEffect(() => {
        if (!jsPlumbInstance.current) return;

        nodes.forEach(node => {
            const element = document.getElementById(node.id);
            if (element) {
                // Get device config
                const configFileName = extractConfigFileName(node.iconPath);
                
                if (!configFileName) {
                    // Fallback to default endpoints if config extraction fails
                    const defaultEndpoints = createDefaultEndpoints(jsPlumbInstance, element);
                    
                    // Update node with endpoints
                    setNodes(prevNodes => 
                        prevNodes.map(n => 
                            n.id === node.id 
                                ? {...n, endpoints: defaultEndpoints} 
                                : n
                        )
                    );
                    return;
                }

                // Fetch device configuration dynamically
                fetch(`${DEVICE_CONFIG_PATH}/${configFileName}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`No configuration found for ${configFileName}`);
                        }
                        return response.json();
                    })
                    .then(config => {
                        // Try to create configured endpoints, fallback to default if it fails
                        const configuredEndpoints = createConfiguredEndpoints(
                            jsPlumbInstance, 
                            element, 
                            config, 
                            () => {} // No need for separate registration
                        );
                        
                        // Update node with endpoints
                        setNodes(prevNodes => 
                            prevNodes.map(n => 
                                n.id === node.id 
                                    ? {...n, endpoints: configuredEndpoints} 
                                    : n
                            )
                        );

                        if (configuredEndpoints.length === 0) {
                            const defaultEndpoints = createDefaultEndpoints(jsPlumbInstance, element);
                            
                            // Update node with default endpoints
                            setNodes(prevNodes => 
                                prevNodes.map(n => 
                                    n.id === node.id 
                                        ? {...n, endpoints: defaultEndpoints} 
                                        : n
                                )
                            );
                        }
                    })
                    .catch(error => {
                        console.error(`Error loading config for ${node.id}:`, error);
                        // Create default endpoints if config loading fails
                        const defaultEndpoints = createDefaultEndpoints(jsPlumbInstance, element);
                        
                        // Update node with default endpoints
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

    // Add right-click event listener
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            const rightClickHandler = (e) => handleRightClick(e, nodes);
            container.addEventListener('contextmenu', rightClickHandler);
            return () => {
                container.removeEventListener('contextmenu', rightClickHandler);
            };
        }
    }, [nodes, handleRightClick]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        const iconPath = e.dataTransfer.getData('iconPath');
        
        if (!nodeType || !iconPath) return;

        // Get drop coordinates relative to container
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create new node
        const newNode = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            position: { x, y },
            iconPath: iconPath
        };

        setNodes(prev => [...prev, newNode]);
    };

    return (
        <div 
            ref={containerRef}
            className="diagram-container"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleCloseContextMenu}
        >
            {nodes.map(node => (
                <div
                    key={node.id}
                    id={node.id}
                    className="diagram-node"
                    style={{
                        position: 'absolute',
                        left: node.position.x,
                        top: node.position.y,
                        cursor: 'move'
                    }}
                >
                    <img 
                        src={node.iconPath}
                        alt={node.type}
                        draggable={false}
                    />
                </div>
            ))}
            
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
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        zIndex: 1000
                    }}
                >
                    <h4>
                        {connectionState.sourceEndpoint 
                            ? 'Select Destination Endpoint' 
                            : 'Select Source Endpoint'}
                    </h4>
                    {contextMenu.endpoints.map((endpoint, index) => {
                        const interfaceName = endpoint.interfaceName;
                        return (
                            <div 
                                key={index}
                                onClick={() => handleEndpointSelect(endpoint, contextMenu.node)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '5px',
                                    borderBottom: '1px solid #eee',
                                    backgroundColor: connectionState.sourceEndpoint === endpoint 
                                        ? '#e0e0e0' 
                                        : 'transparent'
                                }}
                            >
                                {interfaceName}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NetworkDiagram;
