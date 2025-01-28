import { useCallback } from 'react';
import { NETWORK_DIAGRAM_CONFIG } from '../utils/NetworkDiagramConfig';
import Logger from '../utils/Logger';

/**
 * Custom hook for handling drag and drop operations in the network diagram
 * @param {Object} params Hook parameters
 * @param {Object} params.containerRef Reference to the container element
 * @param {Function} params.onNodeCreate Callback function to create a node
 * @returns {Object} Drag and drop handlers
 */
const useDragAndDrop = ({ containerRef, onNodeCreate }) => {
    /**
     * Handle drag over event
     * @param {DragEvent} e Drag event
     */
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    /**
     * Handle drop event
     * @param {DragEvent} e Drop event
     */
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        
        try {
            const nodeType = e.dataTransfer.getData('nodeType');
            const iconPath = e.dataTransfer.getData('iconPath');
            
            if (!nodeType || !iconPath) {
                Logger.warn('Drop event missing required data', {
                    nodeType,
                    iconPath
                });
                return;
            }

            if (!containerRef.current) {
                Logger.warn('Container reference not available');
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            
            // Calculate grid-aligned coordinates
            const x = Math.round((e.clientX - rect.left) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) 
                * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;
            const y = Math.round((e.clientY - rect.top) / NETWORK_DIAGRAM_CONFIG.GRID.SIZE) 
                * NETWORK_DIAGRAM_CONFIG.GRID.SIZE;

            Logger.debug('Node drop detected', {
                nodeType,
                iconPath,
                position: { x, y }
            });

            onNodeCreate(nodeType, iconPath, { clientX: x, clientY: y });
        } catch (error) {
            Logger.error('Error handling node drop', {
                error: error.message,
                stack: error.stack
            });
        }
    }, [containerRef, onNodeCreate]);

    return {
        handleDragOver,
        handleDrop
    };
};

export default useDragAndDrop;
