import React, { useState, useEffect } from 'react';
import { 
    AppBar, 
    Toolbar as MuiToolbar, 
    Box 
} from '@mui/material';
import styled from 'styled-components';
import ConnectionManager from '../utils/ConnectionManager';

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

/**
 * Toolbar Component for Network Diagram
 * Provides tools and settings for manipulating the diagram
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onAddNode - Node addition handler
 * @param {Function} props.onAddConnection - Connection addition handler
 * @param {Function} props.onSaveDiagram - Diagram save handler
 * @param {Function} props.onLoadDiagram - Diagram load handler
 * @param {Function} props.onUndo - Undo handler
 * @param {Function} props.onRedo - Redo handler
 */
const Toolbar = ({ 
    onAddNode, 
    onAddConnection, 
    onSaveDiagram, 
    onLoadDiagram,
    onUndo,
    onRedo 
}) => {
    // State to track network statistics
    const [networkStats, setNetworkStats] = useState({
        totalNodes: 0,
        totalConnections: 0,
        totalEndpoints: 0
    });

    // Update network statistics
    const updateNetworkStats = () => {
        console.log('Attempting to update network stats...');
        try {
            const stats = ConnectionManager.getNetworkStatistics();
            console.log('Retrieved network stats:', stats);
            setNetworkStats(stats);
        } catch (error) {
            console.error('Failed to update network stats:', error);
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
        ConnectionManager
            .on('connectionAdded', handleConnectionChange)
            .on('connectionRemoved', handleConnectionChange)
            .on('nodeAdded', handleConnectionChange)
            .on('nodeRemoved', handleConnectionChange);

        // Cleanup subscription
        return () => {
            ConnectionManager
                .off('connectionAdded', handleConnectionChange)
                .off('connectionRemoved', handleConnectionChange)
                .off('nodeAdded', handleConnectionChange)
                .off('nodeRemoved', handleConnectionChange);
        };
    }, []);

    return (
        <AppBar 
            position="static" 
            color="default" 
            elevation={0}
        >
            <MuiToolbar variant="dense">
                {/* Left side: Action buttons */}
                <Box display="flex" gap={1}>
                    <button onClick={onAddNode}>Add Node</button>
                    <button onClick={onAddConnection}>Add Connection</button>
                    <button onClick={onSaveDiagram}>Save</button>
                    <button onClick={onLoadDiagram}>Load</button>
                    <button onClick={onUndo}>Undo</button>
                    <button onClick={onRedo}>Redo</button>
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
