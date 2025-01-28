import React, { useEffect, useState, useCallback } from 'react';
import FileExplorer from './components/FileExplorer';
import Toolbar from './components/Toolbar';
import IconMenu from './components/IconMenu';
import NetworkDiagram from './components/NetworkDiagram';
import { LAYOUT } from './constants/layout';
import { CANVAS_THEMES } from './constants/themes';
import toast from './utils/toast';
import Logger from './utils/Logger';
import './styles/App.css';

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
    const handleSave = useCallback(() => {
        toast.info('Save functionality coming soon');
    }, []);

    const handleUndo = useCallback(() => {
        toast.info('Undo functionality coming soon');
    }, []);

    const handleRedo = useCallback(() => {
        toast.info('Redo functionality coming soon');
    }, []);

    const handleThemeChange = useCallback((newTheme) => {
        setCurrentTheme(newTheme);
    }, []);

    return (
        <div className="app">
            <div className="left-sidebar">
                <IconMenu />
            </div>
            <div className="main-content">
                <div className="toolbar">
                    <Toolbar 
                        currentTheme={currentTheme}
                        onThemeChange={handleThemeChange}
                        onSave={handleSave}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        hasCanvasActivity={hasCanvasActivity}
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
