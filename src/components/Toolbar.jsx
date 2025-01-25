import React from 'react';
import {
    AppBar,
    Toolbar as MuiToolbar,
    IconButton,
    Typography,
    Box
} from '@mui/material';
import {
    Save,
    Undo,
    Redo
} from '@mui/icons-material';

/**
 * Toolbar Component
 * Provides tools for manipulating the network diagram
 */
const Toolbar = () => {
    return (
        <AppBar 
            position="static" 
            color="default" 
            elevation={1}
            sx={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: '#fff'
            }}
        >
            <MuiToolbar variant="dense">
                <Box display="flex" gap={1}>
                    <IconButton size="small" title="Save">
                        <Save />
                    </IconButton>
                    <IconButton size="small" title="Undo">
                        <Undo />
                    </IconButton>
                    <IconButton size="small" title="Redo">
                        <Redo />
                    </IconButton>
                </Box>
            </MuiToolbar>
        </AppBar>
    );
};

export default Toolbar;
