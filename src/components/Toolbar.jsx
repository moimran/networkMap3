import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    AppBar, 
    Toolbar as MuiToolbar, 
    Box, 
    IconButton, 
    MenuItem,
    Select,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    Typography
} from '@mui/material';
import styled from 'styled-components';
import SaveIcon from '@mui/icons-material/Save';
import LoadIcon from '@mui/icons-material/CloudDownload';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListIcon from '@mui/icons-material/List';
import TopologyManager from '../utils/TopologyManager'
// Import theme constants
import { CANVAS_THEMES } from '../constants/themes';
import Logger from '../utils/Logger';
import toast from '../utils/toast'; // Assuming toast is imported from a utility file
import axios from 'axios'; // Import axios for server-side API calls

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

    // File input ref for topology loading
    const fileInputRef = useRef(null);

    // Handle save topology
    const handleSaveTopology = useCallback(async () => {
        try {
            // Validate topology before saving
            const nodeCount = Object.keys(TopologyManager.topology.nodes).length;
            const connectionCount = Object.keys(TopologyManager.topology.connections).length;

            if (nodeCount === 0) {
                toast.warning('No nodes in the topology to save');
                return;
            }

            // Save topology
            const config = TopologyManager.saveTopology();
            
            if (!config) {
                toast.error('Failed to generate topology configuration');
                return;
            }

            // Log detailed topology configuration
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

    // Handle load topology from file
    const handleLoadTopology = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file extension
        if (!file.name.toLowerCase().endsWith('.json')) {
            toast.error('Invalid file type. Please upload a JSON topology file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                // Parse JSON configuration
                const config = JSON.parse(e.target.result);

                // Validate configuration structure
                if (!config.nodes || typeof config.nodes !== 'object') {
                    throw new Error('Invalid topology configuration: missing or invalid nodes');
                }
                if (!config.connections || typeof config.connections !== 'object') {
                    throw new Error('Invalid topology configuration: missing or invalid connections');
                }

                // Load topology using common load function
                await loadTopologyConfig(config);

            } catch (error) {
                Logger.error('Topology Load Error', {
                    error: error.message,
                    stack: error.stack
                });
                toast.error('Failed to load topology', {
                    description: error.message
                });
            } finally {
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };

        reader.onerror = (error) => {
            Logger.error('File Reading Error', error);
            toast.error('Failed to read topology file');
        };

        // Read file as text
        reader.readAsText(file);
    }, []);

    // Common function to load topology configuration
    const loadTopologyConfig = async (config) => {
        try {
            // Validate config structure
            if (!config.nodes || !config.connections) {
                toast.error('Invalid topology configuration');
                return;
            }

            Logger.info('Loading topology configuration', {
                nodeCount: Object.keys(config.nodes).length,
                connectionCount: Object.keys(config.connections).length
            });

            // Dispatch topology loaded event
            const event = new CustomEvent('topologyLoaded', {
                detail: { config }
            });
            window.dispatchEvent(event);

            Logger.debug('Topology loaded event dispatched', { config });

        } catch (error) {
            Logger.error('Failed to load topology configuration', {
                error: error.message,
                stack: error.stack
            });
            toast.error('Failed to load topology configuration');
        }
    };

    // Load selected topology file from server
    const loadSelectedTopology = useCallback(async (filename) => {
        try {
            Logger.debug('Loading topology file:', filename);
            
            const response = await axios.get(`/api/topology/load?filename=${filename}`);
            
            // Validate response data
            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response from server');
            }

            // Load topology using common load function
            await loadTopologyConfig(response.data);

        } catch (error) {
            Logger.error('Topology Load Error', {
                error: error.message,
                stack: error.stack,
                responseData: error.response?.data,
                requestConfig: error.config
            });
            
            const errorMessage = error.response?.data?.message || error.message;
            toast.error('Failed to load topology', {
                description: errorMessage
            });
        }
    }, [loadTopologyConfig]);

    // State for topology files
    const [topologyFiles, setTopologyFiles] = useState([]);
    const [isFileListOpen, setIsFileListOpen] = useState(false);

    // Fetch available topology files
    const fetchTopologyFiles = useCallback(async () => {
        try {
            const response = await axios.get('/api/topology/list');
            setTopologyFiles(response.data.files);
        } catch (error) {
            Logger.error('Failed to fetch topology files', error);
            toast.error('Could not retrieve topology files');
        }
    }, []);

    // Open topology file list
    const openTopologyFileList = () => {
        fetchTopologyFiles();
        setIsFileListOpen(true);
    };

    // Hidden file input for topology loading
    const renderFileInput = () => (
        <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadTopology}
        />
    );

    // Trigger file input dialog
    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

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

        Logger.info('Topology Structure:', topology);
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
            Logger.debug('Connection Structure:', conn);
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
        
        // Call the onSaveDiagram prop if provided
        if (onSaveDiagram) {
            onSaveDiagram(config);
        }
        
        // Show success message
        toast.success('Topology configuration saved to debug console');
    };

    // Render topology files dialog
    const renderTopologyFileList = () => (
        <Dialog
            open={isFileListOpen}
            onClose={() => setIsFileListOpen(false)}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>Saved Topology Files</DialogTitle>
            <DialogContent>
                {topologyFiles.length === 0 ? (
                    <Typography variant="body2" color="textSecondary">
                        No saved topology files found.
                    </Typography>
                ) : (
                    <List>
                        {topologyFiles.map((file) => (
                            <ListItem 
                                key={file.filename} 
                                button 
                                onClick={() => loadSelectedTopology(file.filename)}
                            >
                                <ListItemText
                                    primary={file.filename}
                                    secondary={`Nodes: ${file.nodeCount}, Connections: ${file.connectionCount}`}
                                />
                                <Typography variant="caption" color="textSecondary">
                                    {new Date(file.created).toLocaleString()}
                                </Typography>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );

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

                    {/* Save Topology Button */}
                    <Tooltip title={hasCanvasActivity ? "Save Topology" : "No changes to save"}>
                        <span>
                            <IconButton 
                                color="primary"
                                onClick={handleSaveTopology}
                                disabled={!hasCanvasActivity}
                            >
                                <SaveIcon />
                            </IconButton>
                        </span>
                    </Tooltip>

                    {/* Upload Topology Button */}
                    <Tooltip title="Upload Topology">
                        <IconButton 
                            color="primary"
                            onClick={triggerFileInput}
                        >
                            <UploadFileIcon />
                        </IconButton>
                    </Tooltip>

                    {/* List Saved Topologies Button */}
                    <Tooltip title="List Saved Topologies">
                        <IconButton 
                            color="primary"
                            onClick={openTopologyFileList}
                        >
                            <ListIcon />
                        </IconButton>
                    </Tooltip>

                    {/* Hidden file input for topology upload */}
                    {renderFileInput()}

                    {/* Topology files dialog */}
                    {renderTopologyFileList()}

                    {/* Theme selector */}
                    <ThemeSelect
                        value={currentTheme}
                        onChange={(e) => onThemeChange(e.target.value)}
                        size="small"
                    >
                        {themeOptions.map(theme => (
                            <MenuItem key={theme.value} value={theme.value}>
                                {theme.label}
                            </MenuItem>
                        ))}
                    </ThemeSelect>
                </Box>

                {/* Right side: Network stats */}
                <Box ml="auto">
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
