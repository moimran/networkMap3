import React, { useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import Toolbar from './components/Toolbar';
import IconMenu from './components/IconMenu';
import NetworkDiagram from './components/NetworkDiagram';
import { LAYOUT } from './constants/layout';
import './styles/App.css';

/**
 * Main Application Component
 * Layout structure:
 * - Left sidebar (IconMenu)
 * - Main content area (Toolbar and NetworkDiagram)
 * - Right sidebar (FileExplorer)
 */
function App() {
    // Set CSS variables for layout dimensions
    useEffect(() => {
        document.documentElement.style.setProperty('--icon-menu-width', `${LAYOUT.ICON_MENU_WIDTH}px`);
        document.documentElement.style.setProperty('--file-explorer-width', `${LAYOUT.FILE_EXPLORER_WIDTH}px`);
        document.documentElement.style.setProperty('--toolbar-height', `${LAYOUT.TOOLBAR_HEIGHT}px`);
        document.documentElement.style.setProperty('--diagram-margin', `${LAYOUT.DIAGRAM_MARGIN}px`);
    }, []);

    return (
        <div className="app">
            <div className="left-sidebar">
                <IconMenu />
            </div>
            <div className="main-content">
                <div className="toolbar">
                    <Toolbar />
                </div>
                <div className="diagram-wrapper">
                    <NetworkDiagram />
                </div>
            </div>
            <div className="right-sidebar">
                <FileExplorer />
            </div>
        </div>
    );
}

export default App;
