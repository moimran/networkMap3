import React from 'react';
import PropTypes from 'prop-types';
import { 
    Menu, 
    MenuItem, 
    ListItemIcon, 
    ListItemText, 
    Typography, 
    Divider 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

/**
 * Context menu component for network nodes
 */
const NodeContextMenu = ({ 
    contextMenu, 
    connectionState, 
    onEndpointSelect, 
    onDeleteNode, 
    onClose 
}) => {
    if (!contextMenu) return null;

    return (
        <Menu
            open={!!contextMenu}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={
                contextMenu 
                    ? { 
                        top: contextMenu.mouseY, 
                        left: contextMenu.mouseX 
                    }
                    : undefined
            }
            PaperProps={{
                style: {
                    maxHeight: 300,
                    width: '250px',
                }
            }}
        >
            {/* Endpoint Selection Section */}
            <MenuItem disabled>
                <Typography variant="subtitle2">
                    {connectionState.stage === 'SOURCE_SELECTED' 
                        ? 'Select Destination Endpoint' 
                        : 'Select Source Endpoint'}
                </Typography>
            </MenuItem>
            {contextMenu.endpoints.map((endpoint, index) => (
                <MenuItem 
                    key={`${endpoint.name}-${index}`}
                    onClick={() => onEndpointSelect(contextMenu.node, endpoint)}
                >
                    {endpoint.name} ({endpoint.type})
                </MenuItem>
            ))}

            {/* Delete Node Option */}
            <Divider />
            <MenuItem 
                onClick={() => {
                    onDeleteNode(contextMenu.node.id);
                    onClose();
                }}
                sx={{
                    color: 'error.main',
                    '&:hover': {
                        backgroundColor: 'error.light',
                        color: 'error.contrastText'
                    }
                }}
            >
                <ListItemIcon>
                    <DeleteIcon color="error" />
                </ListItemIcon>
                <ListItemText 
                    primary="Delete Node" 
                    primaryTypographyProps={{color: 'error'}} 
                />
            </MenuItem>
        </Menu>
    );
};

NodeContextMenu.propTypes = {
    contextMenu: PropTypes.shape({
        mouseX: PropTypes.number,
        mouseY: PropTypes.number,
        node: PropTypes.object,
        endpoints: PropTypes.array
    }),
    connectionState: PropTypes.shape({
        stage: PropTypes.string.isRequired,
        sourceNode: PropTypes.object,
        sourceEndpoint: PropTypes.object
    }).isRequired,
    onEndpointSelect: PropTypes.func.isRequired,
    onDeleteNode: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default NodeContextMenu;
