const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * GET /net_icons
 * Returns a list of all network icons in the public/net_icons directory
 */
router.get('/', async (req, res) => {
    try {
        const iconsPath = path.join(process.cwd(), 'public', 'net_icons');
        const files = await fs.readdir(iconsPath);
        res.json(files);
    } catch (error) {
        console.error('Error reading icons directory:', error);
        res.status(500).json({ error: 'Failed to load icons' });
    }
});

module.exports = router;
