import React, { useEffect, useState, useCallback } from 'react';
import FileExplorer from './components/FileExplorer';
import Toolbar from './components/Toolbar/Toolbar'; // Import from the Toolbar directory
import IconMenu from './components/IconMenu';
import NetworkDiagram from './components/NetworkDiagram';
import { LAYOUT } from './constants/layout';
import { CANVAS_THEMES } from './constants/themes';
import Logger from './utils/Logger';
import './styles/App.css';
import TopologyManager from './utils/TopologyManager'; // Import TopologyManager
import toast from './utils/toast'; // Import toast
import axios from 'axios'; // Import axios

/**
 * Main Application Component
 * Layout structure:
 * - Left sidebar (IconMenu)
 * - Main content area (Toolbar and NetworkDiagram)
 * - Right sidebar (FileExplorer)
 */
function App() {
    // Theme state
    const [currentTheme, setCurrentTheme] = useState(CANVAS_THEMES.GRID_LIGHT.id);
    const [hasCanvasActivity, setHasCanvasActivity] = useState(false);

    // Set CSS variables for layout dimensions
    useEffect(() => {
        document.documentElement.style.setProperty('--icon-menu-width', `${LAYOUT.ICON_MENU_WIDTH}px`);
        document.documentElement.style.setProperty('--file-explorer-width', `${LAYOUT.FILE_EXPLORER_WIDTH}px`);
        document.documentElement.style.setProperty('--toolbar-height', `${LAYOUT.TOOLBAR_HEIGHT}px`);
        document.documentElement.style.setProperty('--diagram-margin', `${LAYOUT.DIAGRAM_MARGIN}px`);
    }, []);

    useEffect(() => {
        // Configure logging with simplified settings
        Logger.configure({
            level: 'debug',
            consoleOutput: true
        });

        // Log application startup
        Logger.debug('Application started');

        // Optional: Log when the component unmounts
        return () => {
            Logger.info('Application closed');
        };
    }, []);

    // Toolbar handlers
    const handleUndo = useCallback(() => {
        Logger.info('Undo action triggered');
    }, []);

    const handleRedo = useCallback(() => {
        Logger.info('Redo action triggered');
    }, []);

    const handleThemeChange = useCallback((theme) => {
        setCurrentTheme(theme);
        Logger.info('Theme changed:', { theme });
    }, []);

    const handleSaveDiagram = useCallback(async (config) => {
        Logger.info('Save diagram triggered');
        try {
            // Validate topology before saving
            const nodeCount = Object.keys(config.nodes).length;
            const connectionCount = Object.keys(config.connections).length;

            if (nodeCount === 0) {
                toast.warning('No nodes in the topology to save');
                return;
            }

            Logger.debug('Saving Topology Configuration', {
                nodeCount,
                connectionCount,
                configSize: JSON.stringify(config).length,
                nodes: Object.keys(config.nodes),
                connections: Object.keys(config.connections)
            });

            // Send topology to server for saving
            const response = await axios.post('/api/topology/save', config, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Show success toast
            toast.success(`Topology saved as ${response.data.filename}`, {
                description: `Nodes: ${nodeCount}, Connections: ${connectionCount}`
            });

            // Log successful save
            Logger.info('Topology Saved Successfully', {
                filename: response.data.filename,
                serverPath: response.data.path
            });

        } catch (error) {
            // Log detailed error information
            Logger.error('Topology Save Error', {
                error: error.message,
                stack: error.stack,
                responseData: error.response?.data,
                requestConfig: error.config
            });
            
            // Check if it's an axios error with response
            const errorMessage = error.response?.data?.message || error.message;
            
            toast.error('Failed to save topology', {
                description: errorMessage
            });
        }
    }, []);

    const handleLoadDiagram = useCallback(() => {
        Logger.info('Load diagram triggered');
        try {
            // Load from local storage
            const savedConfig = localStorage.getItem('networkTopology');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                const success = TopologyManager.loadTopology(config);
                if (success) {
                    toast.success('Diagram loaded successfully');
                } else {
                    toast.error('Failed to load diagram: Invalid configuration');
                }
            } else {
                toast.warning('No saved diagram found');
            }
        } catch (error) {
            Logger.error('Failed to load diagram:', error);
            toast.error('Failed to load diagram');
        }
    }, []);

    const handleUploadFile = useCallback(() => {
        Logger.info('Upload file triggered');
        // TODO: Implement file upload functionality
    }, []);

    const handleToggleListView = useCallback(() => {
        Logger.info('Toggle list view triggered');
        // TODO: Implement list view toggle
    }, []);

    return (
        <div className="app">
            <div className="left-sidebar">
                <IconMenu />
            </div>
            <div className="main-content">
                <div className="toolbar">
                    <Toolbar
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        currentTheme={currentTheme}
                        onThemeChange={handleThemeChange}
                        hasCanvasActivity={hasCanvasActivity}
                        onSaveDiagram={handleSaveDiagram}
                        onLoadDiagram={handleLoadDiagram}
                        onUploadFile={handleUploadFile}
                        onToggleListView={handleToggleListView}
                    />
                </div>
                <div className="diagram-wrapper">
                    <NetworkDiagram
                        currentTheme={currentTheme}
                        onCanvasActivityChange={setHasCanvasActivity}
                    />
                </div>
            </div>
            <div className="right-sidebar">
                <FileExplorer />
            </div>
        </div>
    );
}

export default App;
