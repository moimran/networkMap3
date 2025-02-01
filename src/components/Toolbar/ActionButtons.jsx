import React from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, Tooltip } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import LoadIcon from '@mui/icons-material/CloudDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListIcon from '@mui/icons-material/List';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Logger from '../../utils/Logger';

/**
 * ActionButtons component for diagram manipulation actions
 * Includes save, load, undo, redo, upload, and list view functionality
 */
const ActionButtons = ({ 
    onUndo, 
    onRedo, 
    onSaveDiagram, 
    onLoadDiagram, 
    onUploadFile,
    onToggleListView,
    onResetDiagram
}) => {
    const handleUndo = () => {
        Logger.debug('Undo button clicked');
        onUndo();
    };

    const handleRedo = () => {
        Logger.debug('Redo button clicked');
        onRedo();
    };

    const handleSave = () => {
        Logger.debug('Save button clicked');
        onSaveDiagram();
    };

    const handleLoad = () => {
        Logger.debug('Load button clicked');
        onLoadDiagram();
    };

    const handleUpload = () => {
        Logger.debug('Upload button clicked');
        onUploadFile();
    };

    const handleListView = () => {
        Logger.debug('List view button clicked');
        onToggleListView();
    };

    const handleReset = () => {
        Logger.debug('Reset button clicked');
        onResetDiagram();
    };

    return (
        <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Save Diagram">
                <IconButton onClick={handleSave} color="primary">
                    <SaveIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Load Diagram">
                <IconButton onClick={handleLoad} color="primary">
                    <LoadIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Upload File">
                <IconButton onClick={handleUpload} color="primary">
                    <UploadFileIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Undo">
                <IconButton onClick={handleUndo} color="primary">
                    <UndoIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
                <IconButton onClick={handleRedo} color="primary">
                    <RedoIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="List View">
                <IconButton onClick={handleListView} color="primary">
                    <ListIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset Diagram">
                <IconButton onClick={handleReset} color="primary">
                    <RestartAltIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

ActionButtons.propTypes = {
    onUndo: PropTypes.func.isRequired,
    onRedo: PropTypes.func.isRequired,
    onSaveDiagram: PropTypes.func.isRequired,
    onLoadDiagram: PropTypes.func.isRequired,
    onUploadFile: PropTypes.func.isRequired,
    onToggleListView: PropTypes.func.isRequired,
    onResetDiagram: PropTypes.func.isRequired
};

export default ActionButtons;
