import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for paths
const PATHS = {
  DIAGRAMS: path.join(__dirname, '../public/diagrams')
};

/**
 * Helper function to ensure directory exists
 * @param {string} dirPath - Path to directory
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Save topology configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function saveTopology(req, res) {
  try {
    // Log debug information
    console.log('Save Topology Request:', {
      body: req.body,
      diagramsDir: PATHS.DIAGRAMS
    });

    // Ensure diagrams directory exists
    await ensureDir(PATHS.DIAGRAMS);

    // Get topology configuration from request body
    const topologyConfig = req.body;

    // Validate configuration
    if (!topologyConfig || !topologyConfig.nodes || !topologyConfig.connections) {
      return res.status(400).json({ message: 'Invalid topology configuration' });
    }

    // Generate a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `network-topology-${timestamp}.json`;
    const savePath = path.join(PATHS.DIAGRAMS, filename);

    // Write the file
    await fs.writeFile(savePath, JSON.stringify(topologyConfig, null, 2));

    // Log success
    console.log('Topology saved successfully:', {
      filename,
      savePath,
      stats: await fs.stat(savePath)
    });

    // Return success response
    return res.status(200).json({
      message: 'Topology saved successfully',
      filename,
      path: `/diagrams/${filename}`
    });

  } catch (error) {
    console.error('Topology Save Error:', error);
    return res.status(500).json({
      message: 'Failed to save topology',
      error: error.message
    });
  }
}

/**
 * Load topology configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function loadTopology(req, res) {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    const filePath = path.join(PATHS.DIAGRAMS, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ message: 'Topology file not found' });
    }

    // Read and parse file
    const fileContents = await fs.readFile(filePath, 'utf8');
    const topologyConfig = JSON.parse(fileContents);

    // Validate configuration
    if (!topologyConfig.nodes || !topologyConfig.connections) {
      return res.status(400).json({ message: 'Invalid topology configuration' });
    }

    return res.status(200).json(topologyConfig);

  } catch (error) {
    console.error('Topology Load Error:', error);
    return res.status(500).json({
      message: 'Failed to load topology',
      error: error.message
    });
  }
}

/**
 * List topology files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function listTopologies(req, res) {
  try {
    // Ensure directory exists
    await ensureDir(PATHS.DIAGRAMS);

    // Read directory contents
    const fileNames = await fs.readdir(PATHS.DIAGRAMS);
    const files = await Promise.all(
      fileNames
        .filter(file => file.endsWith('.json'))
        .map(async filename => {
          const fullPath = path.join(PATHS.DIAGRAMS, filename);
          const stats = await fs.stat(fullPath);

          try {
            const content = JSON.parse(await fs.readFile(fullPath, 'utf8'));
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
    );

    // Sort by creation time, newest first
    files.sort((a, b) => new Date(b.created) - new Date(a.created));

    return res.status(200).json({ files });

  } catch (error) {
    console.error('Topology List Error:', error);
    return res.status(500).json({
      message: 'Failed to list topology files',
      error: error.message
    });
  }
}
