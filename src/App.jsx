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

    // Set CSS variables for layout dimensions
    useEffect(() => {
        document.documentElement.style.setProperty('--icon-menu-width', `${LAYOUT.ICON_MENU_WIDTH}px`);
        document.documentElement.style.setProperty('--file-explorer-width', `${LAYOUT.FILE_EXPLORER_WIDTH}px`);
        document.documentElement.style.setProperty('--toolbar-height', `${LAYOUT.TOOLBAR_HEIGHT}px`);
        document.documentElement.style.setProperty('--diagram-margin', `${LAYOUT.DIAGRAM_MARGIN}px`);
    }, []);

    useEffect(() => {
        // Detect environment comprehensively
        const isNode = typeof process !== 'undefined' && 
                       process.versions && 
                       process.versions.node;
        
        const isElectron = typeof window !== 'undefined' && 
                           window.process && 
                           window.process.type === 'renderer';
        
        const isBrowser = typeof window !== 'undefined' && 
                          typeof document !== 'undefined' && 
                          !isElectron;

        // Detailed environment information
        const envInfo = {
            isNode,
            isElectron,
            isBrowser,
            platform: isNode ? process.platform : 
                      isElectron ? 'electron' : 
                      'browser',
            userAgent: isNode ? 'Node.js' : 
                       isElectron ? 'Electron' : 
                       navigator.userAgent,
            currentWorkingDirectory: isNode ? process.cwd() : 
                                     isElectron ? window.process.cwd() : 
                                     'N/A',
            processEnv: isNode || isElectron ? 
                        JSON.stringify(process.env || window.process.env) : 
                        'N/A'
        };

        // Configure logging with environment-specific settings
        Logger.configure({
            fileLogging: isNode || isElectron,  // Enable file logging for Node.js and Electron
            level: 'debug',
            consoleOutput: true
        });

        // Log comprehensive environment information
        Logger.debug('Environment Diagnostic Information', envInfo);

        // Log application startup with more details
        Logger.info('Application started', {
            timestamp: new Date().toISOString(),
            logFile: Logger.getLogFilePath(),
            logDirectory: Logger.getLogDirectory()
        });

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

    return (
        <div className="app">
            <div className="left-sidebar">
                <IconMenu />
            </div>
            <div className="main-content">
                <div className="toolbar">
                    <Toolbar 
                        currentTheme={currentTheme}
                        onThemeChange={setCurrentTheme}
                        onSave={handleSave}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                    />
                </div>
                <div className="diagram-wrapper">
                    <NetworkDiagram currentTheme={currentTheme} />
                </div>
            </div>
            <div className="right-sidebar">
                <FileExplorer />
            </div>
        </div>
    );
}

export default App;
