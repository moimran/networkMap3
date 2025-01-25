/**
 * NetworkDiagram Component
 * 
 * A container component for the network diagram workspace.
 * This component will be enhanced with jsPlumb functionality in future iterations.
 * 
 * Design Considerations:
 * - Component is designed to be library-agnostic for future flexibility
 * - Uses CSS modules for styling isolation
 * - Maintains a clean separation of concerns
 */

import React, { useEffect, useRef, useState } from 'react';
import { ready, newInstance } from "@jsplumb/browser-ui"
import '../styles/NetworkDiagram.css';

const NetworkDiagram = () => {
    const containerRef = useRef(null);
    const jsPlumbInstance = useRef(null);
    const [nodes, setNodes] = useState([]);

    // Initialize jsPlumb
    useEffect(() => {
        if (!containerRef.current) return;

        ready(() => {
            jsPlumbInstance.current = newInstance({
                container: containerRef.current,
                dragOptions: { cursor: 'move', grid: [20, 20] }
            });
        });

        return () => {
            if (jsPlumbInstance.current) {
                jsPlumbInstance.current.destroy();
            }
        };
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        if (!nodeType) return;

        // Get drop coordinates relative to container
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create new node
        const newNode = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            position: { x, y }
        };

        setNodes(prev => [...prev, newNode]);
    };

    return (
        <div 
            ref={containerRef}
            className="diagram-container"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {nodes.map(node => (
                <div
                    key={node.id}
                    id={node.id}
                    className="diagram-node"
                    style={{
                        position: 'absolute',
                        left: node.position.x,
                        top: node.position.y
                    }}
                >
                    {node.type}
                </div>
            ))}
        </div>
    );
};

export default NetworkDiagram;
