import React, { useState, useMemo } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    TextField, 
    Typography, 
    Grid, 
    Paper 
} from '@mui/material';
import PropTypes from 'prop-types';
import ConnectionManager from '../utils/ConnectionManager';

/**
 * Constants for node configuration
 */
const NODE_CONFIG_CONSTANTS = {
    MIN_NODES: 1,
    MAX_NODES: 10,
    DEFAULT_NODES: 1
};

/**
 * Validate node count input
 * @param {string} value - Input value
 * @returns {number} Validated node count
 */
const validateNodeCount = (value) => {
    // Only allow positive integers within the specified range
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) 
        ? NODE_CONFIG_CONSTANTS.DEFAULT_NODES 
        : Math.min(
            Math.max(parsedValue, NODE_CONFIG_CONSTANTS.MIN_NODES), 
            NODE_CONFIG_CONSTANTS.MAX_NODES
        );
};

/**
 * NodeConfigModal - A configurable modal for node creation
 * Allows users to specify the number of nodes to create
 */
const NodeConfigModal = ({ 
    open, 
    onClose, 
    nodeConfig, 
    onSubmit 
}) => {
    // State for node count with memoized validation
    const [nodeCount, setNodeCount] = useState(NODE_CONFIG_CONSTANTS.DEFAULT_NODES);

    // Memoized node details to prevent unnecessary re-renders
    const nodeDetails = useMemo(() => ({
        type: nodeConfig.type,
        iconPath: nodeConfig.iconPath.split('/').pop(),
        interfaces: nodeConfig.endpoints || []
    }), [nodeConfig]);

    /**
     * Handle node count input changes
     * @param {Event} e - Input change event
     */
    const handleNodeCountChange = (e) => {
        const value = e.target.value;
        // Only allow numeric input
        if (/^\d*$/.test(value)) {
            setNodeCount(validateNodeCount(value));
        }
    };

    /**
     * Confirm node creation
     */
    const handleConfirm = () => {
        // Simply pass the node count to parent component
        onSubmit(nodeCount);
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="md"
            fullWidth
            aria-labelledby="node-config-dialog-title"
        >
            <DialogTitle id="node-config-dialog-title">
                Node Configuration
            </DialogTitle>
            <DialogContent>
                <Grid container spacing={2}>
                    {/* Node Details Section */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>
                            Node Details
                        </Typography>
                        <Paper 
                            variant="outlined" 
                            sx={{ 
                                p: 2, 
                                mb: 2,
                                backgroundColor: 'background.default' 
                            }}
                        >
                            <Typography>
                                <strong>Type:</strong> {nodeDetails.type}
                            </Typography>
                            <Typography>
                                <strong>Icon:</strong> {nodeDetails.iconPath}
                            </Typography>
                            <Typography>
                                <strong>Interfaces:</strong>
                            </Typography>
                            <ul>
                                {nodeDetails.interfaces.map((endpoint, index) => (
                                    <li key={index}>
                                        {endpoint.name} ({endpoint.type})
                                    </li>
                                ))}
                            </ul>
                        </Paper>
                    </Grid>

                    {/* Node Quantity Input Section */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>
                            Node Quantity
                        </Typography>
                        <TextField
                            fullWidth
                            type="number"
                            label="Number of Nodes"
                            variant="outlined"
                            value={nodeCount}
                            onChange={handleNodeCountChange}
                            inputProps={{
                                min: NODE_CONFIG_CONSTANTS.MIN_NODES,
                                max: NODE_CONFIG_CONSTANTS.MAX_NODES
                            }}
                            helperText={`Enter number of nodes (${NODE_CONFIG_CONSTANTS.MIN_NODES}-${NODE_CONFIG_CONSTANTS.MAX_NODES})`}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Cancel
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    color="primary" 
                    disabled={nodeCount < NODE_CONFIG_CONSTANTS.MIN_NODES}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// PropTypes for type checking and documentation
NodeConfigModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    nodeConfig: PropTypes.shape({
        type: PropTypes.string.isRequired,
        iconPath: PropTypes.string.isRequired,
        endpoints: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
            type: PropTypes.string
        }))
    }).isRequired,
    onSubmit: PropTypes.func.isRequired
};

export default NodeConfigModal;
