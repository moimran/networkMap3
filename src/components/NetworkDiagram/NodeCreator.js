import { generateUUID } from '../../utils/NetworkDiagramConfig';
import { JsPlumbCoreWrapper } from './JsPlumbWrapper';
import TopologyManager from '../../utils/TopologyManager';
import Logger from '../../utils/Logger';

/**
 * NodeCreator class handles the creation and setup of network nodes
 * This abstraction makes it easier to switch node creation libraries in the future
 */
class NodeCreator {
    /**
     * Create jsPlumb endpoints for a node
     * @param {Object} params - Parameters for endpoint creation
     * @param {Object} params.jsPlumbInstance - jsPlumb instance
     * @param {HTMLElement} params.nodeElement - DOM element of the node
     * @param {Array} params.endpoints - Array of endpoint configurations
     * @returns {Array} Created jsPlumb endpoints
     */
    static createJsPlumbEndpoints({ jsPlumbInstance, nodeElement, endpoints }) {
        return endpoints.map((endpoint, index) => {
            const endpointOptions = {
                anchor: ['Left', 'Right', 'Top', 'Bottom'][index % 4],
                source: true,
                target: true
            };

            return jsPlumbInstance.addEndpoint(
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
    }

    /**
     * Create a new node with the given configuration
     * @param {Object} params - Node creation parameters
     * @param {string} params.deviceType - Type of the device
     * @param {string} params.name - Name of the node
     * @param {string} params.iconPath - Path to the node's icon
     * @param {number} params.x - X coordinate
     * @param {number} params.y - Y coordinate
     * @param {Array} params.interfaces - Array of interface configurations
     * @returns {Object} Created node object
     */
    static createNode({ deviceType, name, iconPath, x, y, interfaces = [] }) {
        const nodeId = generateUUID();
        
        const node = {
            id: nodeId,
            type: deviceType,
            name: name,
            iconPath: iconPath,
            position: { x, y },
            endpoints: interfaces.map(endpoint => ({
                ...endpoint,
                id: generateUUID(),
                nodeId: nodeId,
                originalName: endpoint.name
            }))
        };

        TopologyManager.addTopologyNode(node);
        Logger.debug('Node Created', { nodeId, type: deviceType, name });
        
        return node;
    }

    /**
     * Setup jsPlumb for a newly created node
     * @param {Object} params - Setup parameters
     * @param {Object} params.node - Node object
     * @param {Object} params.jsPlumbInstance - jsPlumb instance
     * @param {Object} params.nodesRef - Reference to nodes object
     */
    static setupNodeJsPlumb({ node, jsPlumbInstance, nodesRef }) {
        const nodeElement = document.getElementById(node.id);
        if (!nodeElement || !jsPlumbInstance) {
            Logger.warn('Node setup failed: Missing element or jsPlumb instance', {
                nodeId: node.id,
                hasElement: !!nodeElement,
                hasJsPlumb: !!jsPlumbInstance
            });
            return;
        }

        const jsPlumbEndpoints = this.createJsPlumbEndpoints({
            jsPlumbInstance,
            nodeElement,
            endpoints: node.endpoints
        });

        const libraryNodeData = {
            element: nodeElement,
            jsPlumbEndpoints,
            id: node.id,
            type: node.type
        };

        TopologyManager.registerTopologyNode(node, libraryNodeData);

        nodesRef[node.id] = {
            node,
            jsPlumbEndpoints
        };

        Logger.debug('Node jsPlumb setup complete', { 
            nodeId: node.id, 
            endpointCount: jsPlumbEndpoints.length 
        });
    }
}

export default NodeCreator;
