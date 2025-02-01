import fs from 'fs';
import path from 'path';
import Logger from '../../../src/utils/Logger';

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        Logger.warn('Invalid HTTP method for topology list:', req.method);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Define the diagrams directory
        const diagramsDir = path.join(process.cwd(), 'public', 'diagrams');
        Logger.debug('Listing topology files from:', diagramsDir);

        // Ensure the directory exists
        if (!fs.existsSync(diagramsDir)) {
            Logger.warn('Diagrams directory does not exist:', diagramsDir);
            return res.status(200).json({ files: [] });
        }

        // Read directory contents
        const allFiles = fs.readdirSync(diagramsDir);
        Logger.debug('Found files in diagrams directory:', allFiles);

        const files = allFiles
            .filter(file => {
                const fullPath = path.join(diagramsDir, file);
                const isFile = fs.statSync(fullPath).isFile();
                const isJson = file.toLowerCase().endsWith('.json');
                return isFile && isJson;
            })
            .map(filename => {
                const fullPath = path.join(diagramsDir, filename);
                const stats = fs.statSync(fullPath);
                
                // Try to read file contents to get additional metadata
                try {
                    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    const fileInfo = {
                        filename,
                        size: stats.size,
                        created: stats.birthtime,
                        nodeCount: Object.keys(content.nodes || {}).length,
                        connectionCount: Object.keys(content.connections || {}).length
                    };
                    Logger.debug('Processed topology file:', fileInfo);
                    return fileInfo;
                } catch (error) {
                    Logger.warn('Failed to parse topology file:', {
                        filename,
                        error: error.message
                    });
                    return {
                        filename,
                        size: stats.size,
                        created: stats.birthtime,
                        nodeCount: 0,
                        connectionCount: 0,
                        error: 'Invalid or corrupted file'
                    };
                }
            })
            // Sort by creation time, newest first
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        Logger.info('Successfully listed topology files:', {
            totalFiles: allFiles.length,
            jsonFiles: files.length
        });

        return res.status(200).json({ files });

    } catch (error) {
        Logger.error('Failed to list topology files:', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ 
            message: 'Failed to list topology files', 
            error: error.message 
        });
    }
}
