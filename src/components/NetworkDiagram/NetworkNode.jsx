import React from 'react';
import PropTypes from 'prop-types';

/**
 * NetworkNode component for rendering individual nodes in the network diagram
 * @param {Object} props Component properties
 * @param {string} props.id Node unique identifier
 * @param {Object} props.node Node data object
 * @param {boolean} props.isConnectionTarget Whether this node is a potential connection target
 * @param {function} props.onContextMenu Context menu handler
 */
const NetworkNode = ({ 
    id, 
    node, 
    isConnectionTarget, 
    onContextMenu 
}) => {
    return (
        <div 
            id={id}
            className={`network-node ${isConnectionTarget ? 'connection-target-highlight' : ''}`}
            style={{
                position: 'absolute',
                left: node.position.x,
                top: node.position.y
            }}
            onContextMenu={(e) => onContextMenu(e, node)}
        >
            <img 
                src={node.iconPath}
                alt={node.type}
            />
        </div>
    );
};

NetworkNode.propTypes = {
    id: PropTypes.string.isRequired,
    node: PropTypes.shape({
        id: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        position: PropTypes.shape({
            x: PropTypes.number.isRequired,
            y: PropTypes.number.isRequired
        }).isRequired,
        iconPath: PropTypes.string.isRequired
    }).isRequired,
    isConnectionTarget: PropTypes.bool.isRequired,
    onContextMenu: PropTypes.func.isRequired
};

export default NetworkNode;
