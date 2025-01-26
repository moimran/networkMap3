import { PATHS } from '../constants/paths';

/**
 * Categorize icons based on their first word
 * @returns {Object} Categorized icons object
 */
export const categorizeIcons = () => {
    // Dynamically import all icons from the public/net_icons directory
    const iconContext = import.meta.glob('/public/net_icons/*');
    
    const categorizedIcons = {};

    // Process each icon file
    Object.keys(iconContext).forEach(iconPath => {
        // Extract filename from the full path and convert to lowercase
        const filename = iconPath.split('/').pop().toLowerCase();
        
        // Extract the first word from the filename (before first hyphen)
        const category = filename.split('-')[0].charAt(0).toUpperCase() + 
                         filename.split('-')[0].slice(1);
        
        // Create category if it doesn't exist
        if (!categorizedIcons[category]) {
            categorizedIcons[category] = {
                type: category.toLowerCase(),
                description: `${category} icons`,
                icons: []
            };
        }

        // Add icon to its category
        categorizedIcons[category].icons.push(filename);
    });

    return categorizedIcons;
};

/**
 * Get the node type from an icon filename
 * @param {string} iconPath - Path of the icon
 * @returns {string} Extracted node type
 */
export const getNodeTypeFromIcon = (iconPath) => {
    // Convert to lowercase and extract the first word from the filename (before first hyphen)
    return iconPath.toLowerCase().split('-')[0];
};

/**
 * Generate full icon path
 * @param {string} iconFilename - Filename of the icon
 * @returns {string} Full path to the icon
 */
export const getFullIconPath = (iconFilename) => {
    return `${PATHS.NET_ICONS}/${iconFilename.toLowerCase()}`;
};
