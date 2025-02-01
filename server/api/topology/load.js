import fs from 'fs';
import path from 'path';
import Logger from '../../../src/utils/Logger';

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        Logger.warn('Invalid HTTP method for topology load:', req.method);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Get filename from query
        const { filename } = req.query;

        // Validate filename
        if (!filename) {
            Logger.warn('No filename provided for topology load');
            return res.status(400).json({ message: 'Filename is required' });
        }

        // Define the file path
        const filePath = path.join(process.cwd(), 'public', 'diagrams', filename);
        Logger.debug('Loading topology file:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            Logger.warn('Topology file not found:', filePath);
            return res.status(404).json({ message: 'Topology file not found' });
        }

        // Read file contents
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const topologyConfig = JSON.parse(fileContents);

        // Validate configuration
        if (!topologyConfig.nodes || !topologyConfig.connections) {
            Logger.error('Invalid topology configuration:', {
                filename,
                hasNodes: !!topologyConfig.nodes,
                hasConnections: !!topologyConfig.connections
            });
            return res.status(400).json({ message: 'Invalid topology configuration' });
        }

        Logger.info('Successfully loaded topology file:', {
            filename,
            nodeCount: Object.keys(topologyConfig.nodes).length,
            connectionCount: Object.keys(topologyConfig.connections).length
        });

        // Return topology configuration
        return res.status(200).json(topologyConfig);

    } catch (error) {
        Logger.error('Failed to load topology file:', {
            error: error.message,
            stack: error.stack,
            query: req.query
        });
        return res.status(500).json({ 
            message: 'Failed to load topology', 
            error: error.message 
        });
    }
}

export const config = {
    api: {
        bodyParser: false
    }
}
