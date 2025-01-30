import React, { useState, useEffect } from 'react';
import { 
    AppBar, 
    Toolbar as MuiToolbar, 
    Box,
    IconButton,
    MenuItem,
    Select,
    Tooltip
} from '@mui/material';
import styled from 'styled-components';
import SaveIcon from '@mui/icons-material/Save';
import LoadIcon from '@mui/icons-material/CloudDownload';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TopologyManager from '../utils/TopologyManager'
// Import theme constants
import { CANVAS_THEMES } from '../constants/themes';
import Logger from '../utils/Logger';
import toast from '../utils/toast'; // Assuming toast is imported from a utility file

const NetworkStatsContainer = styled.div`
    display: flex;
    gap: 20px;
    font-size: 14px;
    color: #333;
`;

const StatItem = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
`;

const StatLabel = styled.span`
    font-weight: bold;
    color: #666;
`;

const ThemeSelect = styled(Select)`
    && {
        margin-left: 10px;
        min-width: 150px;
    }
`;

/**
 * Toolbar Component for Network Diagram
 * Provides tools and settings for manipulating the diagram
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSaveDiagram - Diagram save handler
 * @param {Function} props.onLoadDiagram - Diagram load handler
 * @param {Function} props.onUndo - Undo handler
 * @param {Function} props.onRedo - Redo handler
 * @param {string} props.currentTheme - Current theme ID
 * @param {Function} props.onThemeChange - Theme change handler
 * @param {boolean} props.hasCanvasActivity - Whether there's canvas activity
 */
const Toolbar = ({
    onSaveDiagram, 
    onLoadDiagram,
    onUndo,
    onRedo,
    currentTheme,
    onThemeChange,
    hasCanvasActivity
}) => {
    // State to track network statistics
    const [networkStats, setNetworkStats] = useState({
        totalNodes: 0,
        totalConnections: 0,
        totalEndpoints: 0
    });

    // Update network statistics
    const updateNetworkStats = () => {
        Logger.debug('Toolbar: Attempting to update network stats...');
        try {
            const stats = TopologyManager.getTopologyNetworkStatistics();
            Logger.debug('Toolbar: Retrieved network stats:', stats);
            setNetworkStats(stats);
        } catch (error) {
            Logger.error('Toolbar: Failed to update network stats:', error);
            // Fallback to default stats
            setNetworkStats({
                totalNodes: 0,
                totalConnections: 0,
                totalEndpoints: 0
            });
        }
    };

    // Subscribe to connection changes
    useEffect(() => {
        // Initial stats
        updateNetworkStats();

        // Event handlers
        const handleConnectionChange = () => {
            updateNetworkStats();
        };

        // Add event listeners
        TopologyManager
            .on('connectionAdded', handleConnectionChange)
            .on('connectionRemoved', handleConnectionChange)
            .on('nodeAdded', handleConnectionChange)
            .on('nodeRemoved', handleConnectionChange);

        // Cleanup subscription
        return () => {
            TopologyManager
                .off('connectionAdded', handleConnectionChange)
                .off('connectionRemoved', handleConnectionChange)
                .off('nodeAdded', handleConnectionChange)
                .off('nodeRemoved', handleConnectionChange);
        };
    }, []);

    // Convert theme constants to menu items
    const themeOptions = Object.values(CANVAS_THEMES).map(theme => ({
        value: theme.id,
        label: theme.name
    }));

    const handleSave = () => {
        // Get the current topology state
        const topology = TopologyManager.getTopology();
        
        // Create a clean configuration object with only the necessary data
        const config = {
            nodes: {},
            connections: {},
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        // Sanitize nodes data
        Object.entries(topology.nodes || {}).forEach(([nodeId, node]) => {
            config.nodes[nodeId] = {
                id: node.id,
                type: node.type,
                name: node.name,
                interfaces: node.interfaces,
                position: node.position,
                properties: node.properties
            };
        });

        // Sanitize connections data
        Object.entries(topology.connections || {}).forEach(([connId, conn]) => {
            config.connections[connId] = {
                id: conn.id,
                sourceNode: {
                    id: conn.sourceNode.id,
                    interface: conn.sourceNode.interface
                },
                targetNode: {
                    id: conn.targetNode.id,
                    interface: conn.targetNode.interface
                }
            };
        });
        
        // Print the configuration in debug console using Logger
        Logger.info('Network Topology Configuration:', {
            config,
            nodeCount: Object.keys(config.nodes).length,
            connectionCount: Object.keys(config.connections).length
        });
        
        // Also print using regular console for backup
        console.log('Network Topology Configuration:', config);
        
        // Call the onSaveDiagram prop if provided
        if (onSaveDiagram) {
            onSaveDiagram(config);
        }
        
        // Show success message
        toast.success('Topology configuration saved to debug console');
    };

    return (
        <AppBar 
            position="static" 
            color="default" 
            elevation={0}
        >
            <MuiToolbar variant="dense">
                {/* Left side: Action buttons */}
                <Box display="flex" alignItems="center" gap={1}>
                    <Tooltip title={hasCanvasActivity ? "Save Diagram" : "No changes to save"}>
                        <span>
                            <IconButton 
                                onClick={handleSave}
                                disabled={!hasCanvasActivity}
                            >
                                <SaveIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Load Diagram">
                        <IconButton onClick={onLoadDiagram} color="primary">
                            <LoadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Undo">
                        <IconButton onClick={onUndo} color="primary">
                            <UndoIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Redo">
                        <IconButton onClick={onRedo} color="primary">
                            <RedoIcon />
                        </IconButton>
                    </Tooltip>

                    {/* Theme Dropdown */}
                    <ThemeSelect
                        value={currentTheme}
                        onChange={(e) => onThemeChange(e.target.value)}
                        variant="outlined"
                        size="small"
                    >
                        {themeOptions.map((theme) => (
                            <MenuItem key={theme.value} value={theme.value}>
                                {theme.label}
                            </MenuItem>
                        ))}
                    </ThemeSelect>
                </Box>

                {/* Right side: Network Statistics */}
                <Box ml="auto" display="flex" gap={1}>
                    <NetworkStatsContainer>
                        <StatItem>
                            <StatLabel>Nodes:</StatLabel>
                            {networkStats.totalNodes}
                        </StatItem>
                        <StatItem>
                            <StatLabel>Connections:</StatLabel>
                            {networkStats.totalConnections}
                        </StatItem>
                        <StatItem>
                            <StatLabel>Endpoints:</StatLabel>
                            {networkStats.totalEndpoints}
                        </StatItem>
                    </NetworkStatsContainer>
                </Box>
            </MuiToolbar>
        </AppBar>
    );
};

export default Toolbar;
