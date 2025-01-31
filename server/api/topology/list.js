import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Define the diagrams directory
        const diagramsDir = path.join(process.cwd(), 'public', 'diagrams');

        // Ensure the directory exists
        if (!fs.existsSync(diagramsDir)) {
            return res.status(200).json({ files: [] });
        }

        // Read directory contents
        const files = fs.readdirSync(diagramsDir)
            .filter(file => file.endsWith('.json'))
            .map(filename => {
                const fullPath = path.join(diagramsDir, filename);
                const stats = fs.statSync(fullPath);
                
                // Try to read file contents to get additional metadata
                try {
                    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    return {
                        filename,
                        size: stats.size,
                        created: stats.birthtime,
                        nodeCount: Object.keys(content.nodes || {}).length,
                        connectionCount: Object.keys(content.connections || {}).length
                    };
                } catch {
                    return {
                        filename,
                        size: stats.size,
                        created: stats.birthtime,
                        nodeCount: 0,
                        connectionCount: 0
                    };
                }
            })
            // Sort by creation time, newest first
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        return res.status(200).json({ files });

    } catch (error) {
        console.error('Topology List Error:', error);
        return res.status(500).json({ 
            message: 'Failed to list topology files', 
            error: error.message 
        });
    }
}
