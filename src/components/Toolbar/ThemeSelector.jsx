import React from 'react';
import PropTypes from 'prop-types';
import { Select, MenuItem, styled } from '@mui/material';
import { CANVAS_THEMES } from '../../constants/themes';
import Logger from '../../utils/Logger';

const ThemeSelect = styled(Select)`
    && {
        background-color: white;
        min-width: 120px;
        margin-left: 16px;
        height: 32px;
        .MuiSelect-select {
            padding: 4px 8px;
        }
    }
`;

/**
 * ThemeSelector component for changing the canvas theme
 */
const ThemeSelector = ({ currentTheme, onThemeChange }) => {
    const handleThemeChange = (event) => {
        const newTheme = event.target.value;
        Logger.debug('Theme change requested', {
            from: currentTheme,
            to: newTheme
        });
        onThemeChange(newTheme);
    };

    return (
        <ThemeSelect
            value={currentTheme}
            onChange={handleThemeChange}
            size="small"
        >
            {Object.values(CANVAS_THEMES).map((theme) => (
                <MenuItem key={theme.id} value={theme.id}>
                    {theme.name}
                </MenuItem>
            ))}
        </ThemeSelect>
    );
};

ThemeSelector.propTypes = {
    currentTheme: PropTypes.string.isRequired,
    onThemeChange: PropTypes.func.isRequired
};

export default ThemeSelector;
