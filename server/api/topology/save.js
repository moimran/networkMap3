import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Log the current working directory and full save path
        const cwd = process.cwd();
        const diagramsDir = path.join(cwd, 'public', 'diagrams');
        
        console.log('Save Topology - Debug Information:', {
            cwd,
            diagramsDir,
            dirExists: fs.existsSync(diagramsDir),
            requestBody: req.body
        });

        // Ensure the diagrams directory exists
        if (!fs.existsSync(diagramsDir)) {
            try {
                fs.mkdirSync(diagramsDir, { recursive: true });
                console.log('Created diagrams directory:', diagramsDir);
            } catch (mkdirError) {
                console.error('Failed to create diagrams directory:', mkdirError);
                return res.status(500).json({ 
                    message: 'Failed to create diagrams directory', 
                    error: mkdirError.message 
                });
            }
        }

        // Get topology configuration from request body
        const topologyConfig = req.body;

        // Validate configuration
        if (!topologyConfig || !topologyConfig.nodes || !topologyConfig.connections) {
            return res.status(400).json({ message: 'Invalid topology configuration' });
        }

        // Generate a unique filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `network-topology-${timestamp}.json`;

        // Define the full save path
        const savePath = path.join(diagramsDir, filename);

        try {
            // Write the file with detailed logging
            fs.writeFileSync(savePath, JSON.stringify(topologyConfig, null, 2));
            
            console.log('Topology saved successfully:', {
                filename,
                savePath,
                fileSize: fs.statSync(savePath).size
            });

            // Return success response with filename
            return res.status(200).json({ 
                message: 'Topology saved successfully', 
                filename: filename,
                path: `/diagrams/${filename}`
            });

        } catch (writeError) {
            console.error('Failed to write topology file:', {
                error: writeError.message,
                savePath,
                diagramsDirContents: fs.readdirSync(diagramsDir)
            });

            return res.status(500).json({ 
                message: 'Failed to save topology file', 
                error: writeError.message 
            });
        }

    } catch (error) {
        console.error('Topology Save Error:', error);
        return res.status(500).json({ 
            message: 'Failed to save topology', 
            error: error.message 
        });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
}
