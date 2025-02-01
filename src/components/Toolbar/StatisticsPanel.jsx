import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import TopologyManager from '../../utils/TopologyManager';
import Logger from '../../utils/Logger';

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
 * StatisticsPanel component displays network topology statistics
 * Shows total nodes, connections, and endpoints
 */
const StatisticsPanel = () => {
    const [networkStats, setNetworkStats] = useState({
        totalNodes: 0,
        totalConnections: 0,
        totalEndpoints: 0
    });

    const updateStats = () => {
        Logger.debug('StatisticsPanel: Updating network stats...');
        try {
            const topology = TopologyManager.getTopology();
            const stats = {
                totalNodes: Object.keys(topology.nodes || {}).length,
                totalConnections: Object.keys(topology.connections || {}).length,
                totalEndpoints: Object.keys(topology.lines || {}).length
            };
            Logger.debug('StatisticsPanel: Retrieved network stats:', stats);
            setNetworkStats(stats);
        } catch (error) {
            Logger.error('StatisticsPanel: Failed to update network stats:', error);
            setNetworkStats({
                totalNodes: 0,
                totalConnections: 0,
                totalEndpoints: 0
            });
        }
    };

    useEffect(() => {
        // Initial update
        updateStats();

        // Subscribe to topology changes
        TopologyManager.on('topologyChanged', updateStats);
        TopologyManager.on('nodeAdded', updateStats);
        TopologyManager.on('nodeRemoved', updateStats);
        TopologyManager.on('connectionAdded', updateStats);
        TopologyManager.on('connectionRemoved', updateStats);
        TopologyManager.on('topologyReset', updateStats);
        TopologyManager.on('topologyLoaded', updateStats);

        // Cleanup subscription
        return () => {
            TopologyManager.off('topologyChanged', updateStats);
            TopologyManager.off('nodeAdded', updateStats);
            TopologyManager.off('nodeRemoved', updateStats);
            TopologyManager.off('connectionAdded', updateStats);
            TopologyManager.off('connectionRemoved', updateStats);
            TopologyManager.off('topologyReset', updateStats);
            TopologyManager.off('topologyLoaded', updateStats);
        };
    }, []);

    return (
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
    );
};

export default StatisticsPanel;
