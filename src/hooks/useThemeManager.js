import { useMemo } from 'react';
import { CANVAS_THEMES } from '../constants/themes';

/**
 * Custom hook for managing theme-related functionality
 * @param {string} currentTheme Current theme ID
 * @returns {Object} Theme-related data and utilities
 */
const useThemeManager = (currentTheme) => {
    // Get active theme settings
    const activeTheme = useMemo(() => 
        Object.values(CANVAS_THEMES).find(theme => theme.id === currentTheme) || CANVAS_THEMES.GRID_LIGHT,
        [currentTheme]
    );

    // Memoize background styles to prevent unnecessary re-renders
    const backgroundStyles = useMemo(() => ({
        backgroundColor: activeTheme.background,
        backgroundImage: activeTheme.backgroundImage,
        backgroundSize: activeTheme.backgroundSize,
        backgroundRepeat: 'repeat'
    }), [activeTheme]);

    return {
        activeTheme,
        backgroundStyles
    };
};

export default useThemeManager;
