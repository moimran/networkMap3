import { 
    newInstance 
} from "@jsplumb/browser-ui";
import { 
    NETWORK_DIAGRAM_CONFIG, 
    Logger 
} from '../../utils/NetworkDiagramConfig';

/**
 * Singleton management for jsPlumb instance
 */
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

export default JsPlumbSingleton;
