/**
 * Layout-related constants used throughout the application
 * Centralizing these values makes it easier to maintain consistent spacing and sizes
 */

export const LAYOUT = {
    // Sidebar widths
    ICON_MENU_WIDTH: 200,  // Increased from 60 to 200
    FILE_EXPLORER_WIDTH: 250,

    // Component heights
    TOOLBAR_HEIGHT: 48,

    // Spacing and margins
    DIAGRAM_MARGIN: 8,
    
    // Node dimensions
    NODE_WIDTH: 80,
    NODE_HEIGHT: 80
};

/**
 * Node types available in the application
 * Used for consistent type checking and identification
 */
export const NODE_TYPES = {
    SERVER: 'server',
    ROUTER: 'router',
    SWITCH: 'switch'
};
