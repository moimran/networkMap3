import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
    AppBar, 
    Toolbar as MuiToolbar,
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    Tooltip,
    IconButton,
    Typography
} from '@mui/material';
import ThemeSelector from './ThemeSelector';
import StatisticsPanel from './StatisticsPanel';
import TopologyManager from '../../utils/TopologyManager';
import Logger from '../../utils/Logger';
import toast from '../../utils/toast';
import SaveIcon from '@mui/icons-material/Save';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import axios from 'axios';

/**
 * Toolbar Component for Network Diagram
 * Provides tools and settings for manipulating the diagram
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSaveDiagram - Diagram save handler
 * @param {Function} props.onLoadDiagram - Diagram load handler
 * @param {string} props.currentTheme - Current theme ID
 * @param {Function} props.onThemeChange - Theme change handler
 * @param {boolean} props.hasCanvasActivity - Whether there's canvas activity
 */
const Toolbar = ({
    onSaveDiagram,
    onLoadDiagram,
    currentTheme,
    onThemeChange,
    hasCanvasActivity
}) => {
    const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
    const [savedDiagrams, setSavedDiagrams] = useState([]);

    // Fetch list of saved diagrams when dialog opens
    useEffect(() => {
        if (isLoadDialogOpen) {
            fetchSavedDiagrams();
        }
    }, [isLoadDialogOpen]);

    // Fetch saved diagrams from server
    const fetchSavedDiagrams = async () => {
        try {
            const response = await axios.get('/api/topology/list');
            if (response.data?.files) {
                setSavedDiagrams(response.data.files);
            }
        } catch (error) {
            Logger.error('Failed to fetch saved diagrams:', error);
            toast.error('Failed to fetch saved diagrams');
        }
    };

    // Handle save diagram
    const handleSaveDiagram = useCallback(async () => {
        try {
            Logger.info('Save diagram triggered');
            const config = TopologyManager.getTopology();
            onSaveDiagram(config);
        } catch (error) {
            Logger.error('Failed to save diagram:', error);
            toast.error('Failed to save diagram');
        }
    }, [onSaveDiagram]);

    // Handle diagram selection from load dialog
    const handleDiagramSelect = async (diagram) => {
        try {
            Logger.debug('Loading topology file:', diagram.filename);
            
            const response = await axios.get(`/api/topology/load?filename=${diagram.filename}`);
            
            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response from server');
            }

            // Load topology using TopologyManager
            const success = TopologyManager.loadTopology(response.data);
            if (success) {
                toast.success('Topology loaded successfully');
                setIsLoadDialogOpen(false);
            } else {
                throw new Error('Failed to load topology');
            }

        } catch (error) {
            Logger.error('Failed to load diagram:', error);
            toast.error('Failed to load diagram', {
                description: error.message
            });
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Format date
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString();
    };

    /**
     * Handle resetting the topology
     */
    const handleResetClick = () => {
        try {
            Logger.debug('Toolbar: Resetting topology');
            TopologyManager.resetTopology();
            toast.success('Canvas reset successfully');
        } catch (error) {
            Logger.error('Toolbar: Failed to reset topology', {
                error: error.message,
                stack: error.stack
            });
            toast.error('Failed to reset canvas');
        }
    };

    return (
        <>
            <AppBar 
                position="static" 
                color="default" 
                elevation={1}
                sx={{ 
                    backgroundColor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <MuiToolbar variant="dense">
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Save Diagram">
                            <span>
                                <IconButton onClick={handleSaveDiagram} disabled={!hasCanvasActivity}>
                                    <SaveIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Load Diagram">
                            <span>
                                <IconButton onClick={() => setIsLoadDialogOpen(true)}>
                                    <CloudDownloadIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Reset Diagram">
                            <span>
                                <IconButton onClick={handleResetClick}>
                                    <Typography variant="body1">Reset</Typography>
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>

                    {/* Center: Network Statistics */}
                    <Box flexGrow={1} display="flex" justifyContent="center">
                        <StatisticsPanel />
                    </Box>

                    {/* Right side: Theme Selector */}
                    <ThemeSelector 
                        currentTheme={currentTheme}
                        onThemeChange={onThemeChange}
                    />
                </MuiToolbar>
            </AppBar>

            {/* Load Diagram Dialog */}
            <Dialog 
                open={isLoadDialogOpen}
                onClose={() => setIsLoadDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Load Diagram
                    <Typography variant="caption" display="block" color="text.secondary">
                        Select a saved topology configuration
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <List>
                        {savedDiagrams.map((diagram) => (
                            <ListItem 
                                button 
                                key={diagram.filename}
                                onClick={() => handleDiagramSelect(diagram)}
                                sx={{
                                    borderBottom: '1px solid rgba(0,0,0,0.12)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(0,0,0,0.04)'
                                    }
                                }}
                            >
                                <ListItemText 
                                    primary={diagram.filename}
                                    secondary={
                                        <>
                                            <Typography component="span" variant="body2" color="text.secondary">
                                                Created: {formatDate(diagram.created)}
                                            </Typography>
                                            <br />
                                            <Typography component="span" variant="body2" color="text.secondary">
                                                Size: {formatFileSize(diagram.size)} | 
                                                Nodes: {diagram.nodeCount} | 
                                                Connections: {diagram.connectionCount}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                        {savedDiagrams.length === 0 && (
                            <ListItem>
                                <ListItemText 
                                    primary="No saved diagrams found"
                                    secondary="Save a diagram first to see it here"
                                />
                            </ListItem>
                        )}
                    </List>
                </DialogContent>
            </Dialog>
        </>
    );
};

Toolbar.propTypes = {
    onSaveDiagram: PropTypes.func.isRequired,
    onLoadDiagram: PropTypes.func.isRequired,
    currentTheme: PropTypes.string.isRequired,
    onThemeChange: PropTypes.func.isRequired,
    hasCanvasActivity: PropTypes.bool.isRequired
};

export default Toolbar;
