import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for paths
const PATHS = {
  PUBLIC: path.join(__dirname, '../public'),
  DIAGRAMS: path.join(__dirname, '../public/diagrams'),
  ICONS: path.join(__dirname, '../public/net_icons'),
  DEVICE_CONFIG: path.join(__dirname, '../public/deviceconfig')
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PATHS.PUBLIC));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

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
 * Helper function to recursively delete directory
 * @param {string} dirPath - Path to directory to delete
 */
async function removeDir(dirPath) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        await removeDir(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }
    await fs.rmdir(dirPath);
  } catch (error) {
    console.error(`Error removing directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Helper function to get files recursively
 * @param {string} dir - Directory to scan
 * @returns {Promise<Array>} Array of file and folder objects
 */
async function getFilesRecursively(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    items.map(async item => {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(PATHS.DIAGRAMS, fullPath);
      
      if (item.isDirectory()) {
        const children = await getFilesRecursively(fullPath);
        return {
          name: item.name,
          type: 'folder',
          path: relativePath,
          children
        };
      }
      return {
        name: item.name.replace('.json', ''),
        type: 'file',
        path: relativePath
      };
    })
  );
  return files;
}

/**
 * Validate and normalize file path
 * @param {string} filePath - Path to validate
 * @param {string} baseDir - Base directory to check against
 * @returns {string} Normalized path
 * @throws {Error} If path is invalid or outside base directory
 */
function validatePath(filePath, baseDir) {
  const normalizedPath = filePath ? filePath.replace(/\.\./g, '') : '';
  const fullPath = path.join(baseDir, normalizedPath);
  
  if (!fullPath.startsWith(baseDir)) {
    throw new Error('Invalid path: Path is outside allowed directory');
  }
  
  return fullPath;
}

// API Routes
app.get('/api/list-icons', async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.ICONS);
    res.json(files);
  } catch (error) {
    console.error('Error reading icons directory:', error);
    res.status(500).json({ error: 'Failed to list icons' });
  }
});

app.get('/api/device-config/:filename', async (req, res) => {
  try {
    const configPath = validatePath(req.params.filename, PATHS.DEVICE_CONFIG);
    const config = await fs.readFile(configPath, 'utf-8');
    res.json(JSON.parse(config));
  } catch (error) {
    console.error('Error reading device config:', error);
    res.status(500).json({ error: 'Failed to load device configuration' });
  }
});

app.get('/api/diagrams', async (req, res) => {
  try {
    await ensureDir(PATHS.DIAGRAMS);
    const files = await getFilesRecursively(PATHS.DIAGRAMS);
    res.json(files);
  } catch (error) {
    console.error('Error reading diagrams directory:', error);
    res.status(500).json({ error: 'Failed to list diagrams' });
  }
});

app.post('/api/create-folder', async (req, res) => {
  try {
    console.log('Creating folder:', req.body);
    const { path: folderPath, name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const fullPath = validatePath(path.join(folderPath || '', name), PATHS.DIAGRAMS);
    await ensureDir(fullPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.post('/api/create-file', async (req, res) => {
  try {
    console.log('Creating file:', req.body);
    const { path: filePath, name, content } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }

    const fullPath = validatePath(path.join(filePath || '', `${name}.json`), PATHS.DIAGRAMS);
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, JSON.stringify(content || {}, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
});

app.delete('/api/delete-item', async (req, res) => {
  try {
    console.log('Deleting item:', req.body);
    const { path: itemPath, type } = req.body;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const fullPath = validatePath(itemPath, PATHS.DIAGRAMS);
    
    if (type === 'folder') {
      await removeDir(fullPath);
    } else {
      await fs.unlink(fullPath + '.json');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.post('/api/save-diagram', async (req, res) => {
  try {
    const { filename, data } = req.body;
    const configPath = validatePath(`${filename}.json`, PATHS.DIAGRAMS);
    await fs.writeFile(configPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving diagram:', error);
    res.status(500).json({ error: 'Failed to save diagram' });
  }
});

app.get('/api/load-diagram/:filename', async (req, res) => {
  try {
    const configPath = validatePath(`${req.params.filename}.json`, PATHS.DIAGRAMS);
    const data = await fs.readFile(configPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading diagram:', error);
    res.status(500).json({ error: 'Failed to load diagram' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
