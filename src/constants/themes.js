/**
 * Canvas themes configuration
 * Each theme provides explicit background properties
 */
export const CANVAS_THEMES = {
    BLANK: {
        id: 'blank',
        name: 'Blank',
        background: '#ffffff',
        backgroundImage: 'none',
        backgroundSize: 'auto',
        backgroundRepeat: 'no-repeat'
    },
    GRID_LIGHT: {
        id: 'grid-light',
        name: 'Light Grid',
        background: '#ffffff',
        backgroundImage: `linear-gradient(#e1e1e1 1px, transparent 1px),
                         linear-gradient(90deg, #e1e1e1 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        backgroundRepeat: 'repeat'
    },
    GRID_DARK: {
        id: 'grid-dark',
        name: 'Dark Grid',
        background: '#f5f5f5',
        backgroundImage: `linear-gradient(#d1d1d1 1px, transparent 1px),
                         linear-gradient(90deg, #d1d1d1 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        backgroundRepeat: 'repeat'
    },
    DOT_MATRIX: {
        id: 'dot-matrix',
        name: 'Dot Matrix',
        background: '#ffffff',
        backgroundImage: `radial-gradient(#e1e1e1 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        backgroundRepeat: 'repeat'
    },
    BLUEPRINT: {
        id: 'blueprint',
        name: 'Blueprint',
        background: '#f0f8ff',
        backgroundImage: `linear-gradient(#add8e6 1px, transparent 1px),
                         linear-gradient(90deg, #add8e6 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        backgroundRepeat: 'repeat'
    }
};
