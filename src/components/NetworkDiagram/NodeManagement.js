import { useState, useCallback } from 'react';
import { 
    NETWORK_DIAGRAM_CONFIG, 
    generateUUID 
} from '../../utils/NetworkDiagramConfig';

/**
 * Custom hook for managing nodes in a network diagram
 * @param {Function} setNodeConfigModal - Function to set node configuration modal state
 * @returns {Object} Node management utilities
 */
const useNodeManagement = (setNodeConfigModal) => {
    const [nodes, setNodes] = useState([]);
    const [deviceTypeCount, setDeviceTypeCount] = useState({});

    /**
     * Create a unique node name based on device type
     * @param {string} deviceType - Type of device
     * @returns {string} Unique node name
     */
    const generateNodeName = useCallback((deviceType) => {
        setDeviceTypeCount(prevCount => {
            const updatedDeviceTypeCount = {...prevCount};
            updatedDeviceTypeCount[deviceType] = (updatedDeviceTypeCount[deviceType] || 0) + 1;
            return updatedDeviceTypeCount;
        });

        const currentCount = (deviceTypeCount[deviceType] || 0) + 1;
        return `${deviceType}-${currentCount}`;
    }, [deviceTypeCount]);

    /**
     * Create a new node with grid-aligned positioning
     * @param {string} nodeType - Type of node to create
     * @param {string} iconPath - Path to node icon
     * @param {Event} event - Drop event
     */
    const createNode = useCallback((nodeType, iconPath, event) => {
        const containerRect = event.currentTarget.getBoundingClientRect();
        const x = Math.round((event.clientX - containerRect.left) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;
        const y = Math.round((event.clientY - containerRect.top) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;

        // Open node configuration modal
        setNodeConfigModal({
            type: nodeType,
            iconPath: iconPath,
            x,
            y
        });
    }, [setNodeConfigModal]);

    /**
     * Add a new node to the diagram
     * @param {Object} nodeConfig - Configuration for the new node
     */
    const addNode = useCallback((nodeConfig) => {
        const newNode = {
            id: generateUUID(),
            ...nodeConfig
        };

        setNodes(prevNodes => [...prevNodes, newNode]);
    }, []);

    /**
     * Remove a node from the diagram
     * @param {string} nodeId - ID of the node to remove
     */
    const removeNode = useCallback((nodeId) => {
        setNodes(prevNodes => prevNodes.filter(node => node.id !== nodeId));
    }, []);

    return {
        nodes,
        deviceTypeCount,
        generateNodeName,
        createNode,
        addNode,
        removeNode
    };
};

export default useNodeManagement;
