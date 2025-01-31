import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Get filename from query
        const { filename } = req.query;

        // Validate filename
        if (!filename) {
            return res.status(400).json({ message: 'Filename is required' });
        }

        // Define the file path
        const filePath = path.join(process.cwd(), 'public', 'diagrams', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Topology file not found' });
        }

        // Read file contents
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const topologyConfig = JSON.parse(fileContents);

        // Validate configuration
        if (!topologyConfig.nodes || !topologyConfig.connections) {
            return res.status(400).json({ message: 'Invalid topology configuration' });
        }

        // Return topology configuration
        return res.status(200).json(topologyConfig);

    } catch (error) {
        console.error('Topology Load Error:', error);
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
