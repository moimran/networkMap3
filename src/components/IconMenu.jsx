import React, { useState, useEffect } from 'react';
import {
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Grid,
    Paper,
    Tooltip,
    Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LAYOUT } from '../constants/layout';
import { categorizeIcons, getNodeTypeFromIcon, getFullIconPath } from '../utils/IconUtils';

/**
 * IconMenu Component
 * Dynamically categorizes and displays network icons from public/net_icons
 */
const IconMenu = () => {
    const [expanded, setExpanded] = useState('Routers');
    const [iconsByCategory, setIconsByCategory] = useState({});

    useEffect(() => {
        // Dynamically categorize icons
        const categorized = categorizeIcons();
        setIconsByCategory(categorized);
    }, []);

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const handleDragStart = (e, iconPath) => {
        // Extract the base name without extension for the node type
        const nodeType = getNodeTypeFromIcon(iconPath);
        e.dataTransfer.setData('nodeType', nodeType);
        e.dataTransfer.setData('iconPath', getFullIconPath(iconPath));
    };

    return (
        <Box 
            sx={{ 
                width: LAYOUT.ICON_MENU_WIDTH,
                height: '100%',
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '1px 0 3px rgba(0,0,0,0.1)',
            }}
        >
            <Box sx={{ 
                p: 2, 
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                backgroundColor: '#f8f9fa'
            }}>
                <Typography 
                    variant="h6" 
                    sx={{ 
                        fontWeight: 500,
                        color: '#1976d2',
                        fontSize: '1.1rem'
                    }}
                >
                    Network Icons
                </Typography>
            </Box>
            <Box sx={{ 
                flex: 1,
                overflowY: 'auto',
                '&::-webkit-scrollbar': {
                    width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                    background: '#f1f1f1',
                },
                '&::-webkit-scrollbar-thumb': {
                    background: '#888',
                    borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                    background: '#555',
                },
            }}>
                {Object.entries(iconsByCategory).map(([category, data], index) => (
                    <React.Fragment key={category}>
                        <Accordion
                            expanded={expanded === category}
                            onChange={handleAccordionChange(category)}
                            disableGutters
                            elevation={0}
                            sx={{
                                '&:before': { display: 'none' },
                                backgroundColor: 'transparent',
                                '& .MuiAccordionSummary-root': {
                                    minHeight: 40,
                                    '&.Mui-expanded': {
                                        minHeight: 40,
                                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                    },
                                },
                                '& .MuiAccordionSummary-content': {
                                    margin: '8px 0',
                                    '&.Mui-expanded': {
                                        margin: '8px 0',
                                    },
                                },
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    px: 2,
                                    py: 0.5,
                                    '&:hover': {
                                        backgroundColor: 'rgba(0,0,0,0.04)',
                                    },
                                }}
                            >
                                <Typography 
                                    variant="subtitle1"
                                    sx={{ 
                                        fontWeight: expanded === category ? 600 : 400,
                                        color: expanded === category ? '#1976d2' : 'text.primary',
                                    }}
                                >
                                    {category}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 1.5 }}>
                                <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                        display: 'block',
                                        mb: 1,
                                        px: 0.5
                                    }}
                                >
                                    {data.description}
                                </Typography>
                                <Grid container spacing={1}>
                                    {data.icons.map((icon) => (
                                        <Grid item xs={4} key={icon}>
                                            <Tooltip 
                                                title={icon.split('.')[0].toLowerCase()}
                                                placement="right"
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 1,
                                                        textAlign: 'center',
                                                        cursor: 'move',
                                                        border: '1px solid transparent',
                                                        borderRadius: 1,
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(25, 118, 210, 0.04)',
                                                            border: '1px solid rgba(25, 118, 210, 0.2)',
                                                        },
                                                    }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, icon)}
                                                >
                                                    <img
                                                        src={`/net_icons/${icon.toLowerCase()}`}
                                                        alt={icon}
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                </Paper>
                                            </Tooltip>
                                        </Grid>
                                    ))}
                                </Grid>
                            </AccordionDetails>
                        </Accordion>
                        {index < Object.entries(iconsByCategory).length - 1 && (
                            <Divider />
                        )}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default IconMenu;
