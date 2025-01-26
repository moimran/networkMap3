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

/**
 * IconMenu Component
 * Displays network icons in categorized dropdown menus
 */
const IconMenu = () => {
    const [expanded, setExpanded] = useState('Routers'); // Default open category

    // Icon categories and their patterns
    const categories = {
        'Routers': {
            patterns: ['Router-2D-', 'Router2.png'],
            description: 'Network routing devices',
            icons: []
        },
        'Switches': {
            patterns: ['Switch-2D-', 'Switch-3D-', 'Switch2.png', 'Switch L32.png'],
            description: 'Network switching devices',
            icons: []
        },
        'Servers': {
            patterns: ['Server-2D-', 'Server_'],
            description: 'Various server types',
            icons: []
        },
        'End Devices': {
            patterns: ['PC-2D-', 'Desktop2.png'],
            description: 'End-user devices',
            icons: []
        },
        'Network Clouds': {
            patterns: ['Cloud-2D-', 'cloud'],
            description: 'Network clouds and internet',
            icons: []
        },
        'Network Points': {
            patterns: ['Dot-2D-', 'Dot_'],
            description: 'Network connection points',
            icons: []
        },
        'Global Networks': {
            patterns: ['Globe-2D-', 'globe'],
            description: 'Global network icons',
            icons: []
        }
    };

    // Group icons by category
    const [iconsByCategory, setIconsByCategory] = useState(categories);

    useEffect(() => {
        // Function to check if an icon matches any pattern in a category
        const matchesCategory = (iconName, patterns) => {
            return patterns.some(pattern => 
                iconName.toLowerCase().includes(pattern.toLowerCase())
            );
        };

        // Load and categorize icons
        const loadIcons = async () => {
            try {
                // List of all available icons
                const allIcons = [
                    // Routers
                    'Router-2D-FW-S.svg', 'Router-2D-Gen-Dark-S.svg', 'Router-2D-Gen-Grey-S.svg',
                    'Router-2D-Gen-White-S.svg', 'Router2.png',
                    
                    // Switches
                    'Switch-2D-Cat9k-Blue-S.svg', 'Switch-2D-DC-NX-Blue-S.svg',
                    'Switch-2D-L2-Generic-S.svg', 'Switch-2D-L3-Generic-S.svg',
                    'Switch-3D-L2-S.svg', 'Switch-3D-L3-S.svg', 'Switch2.png', 'Switch L32.png',
                    
                    // Servers
                    'Server-2D-DNS-S.svg', 'Server-2D-Generic-S.svg', 'Server-2D-LDAP-S.svg',
                    'Server-2D-Linux-S.svg', 'Server-2D-SEC-S.svg', 'Server_WEB1.png', 'Server_file.png',
                    
                    // End Devices
                    'PC-2D-Desktop-Docker-S.svg', 'PC-2D-Desktop-Generic-S.svg',
                    'PC-2D-Desktop-Linux-S.svg', 'PC-2D-Desktop-Windows-S.svg', 'Desktop2.png',
                    
                    // Clouds
                    'Cloud-2D-Blue-S.svg', 'Cloud-2D-Green-S.svg', 'Cloud-2D-Grey-S.svg',
                    'Cloud-2D-White-S.svg', 'Cloud-2D-Yellow-S.svg', 'cloud.png', 'cloud_green.png',
                    'cloud_sm.png', 'cloud_sm_green.png',
                    
                    // Network Points
                    'Dot-2D-Black-S.svg', 'Dot-2D-Blue-S.svg', 'Dot-2D-Green-S.svg',
                    'Dot_black.png', 'Dot_blue.png', 'Dot_green.png',
                    
                    // Global Networks
                    'Globe-2D-Blue.svg', 'Globe-2D-Green.svg', 'Globe-2D-Grey.svg',
                    'Globe-2D-Orange.svg', 'Globe-2D-Pink.svg', 'globe1.png', 'globe2.png'
                ];

                // Categorize icons
                const categorized = { ...categories };
                Object.entries(categorized).forEach(([category, data]) => {
                    data.icons = allIcons.filter(icon => 
                        matchesCategory(icon, data.patterns)
                    );
                });
                
                setIconsByCategory(categorized);
            } catch (error) {
                console.error('Error loading icons:', error);
            }
        };

        loadIcons();
    }, []);

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const handleDragStart = (e, iconPath) => {
        // Extract the base name without extension for the node type
        const nodeType = iconPath.split('.')[0].toLowerCase();
        e.dataTransfer.setData('nodeType', nodeType);
        e.dataTransfer.setData('iconPath', `/net_icons/${iconPath}`);
    };

    const DEVICE_ICONS = [
        { 
            type: 'router', 
            icons: [
                '/net_icons/Router-2D-Gen-Dark-S.svg',
                '/net_icons/Router-2D-Gen-Grey-S.svg',
                '/net_icons/Router-2D-Gen-White-S.svg',
                '/net_icons/Router-2D-FW-S.svg'
            ]
        },
        { 
            type: 'switch', 
            icons: [
                '/net_icons/Switch-2D-L2-Generic-S.svg',
                '/net_icons/Switch-2D-L3-Generic-S.svg',
                '/net_icons/Switch-2D-Cat9k-Blue-S.svg',
                '/net_icons/Switch-2D-DC-NX-Blue-S.svg'
            ]
        },
        { 
            type: 'server', 
            icons: [
                '/net_icons/Server-2D-Generic-S.svg',
                '/net_icons/Server-2D-Linux-S.svg',
                '/net_icons/Server-2D-DNS-S.svg',
                '/net_icons/Server-2D-LDAP-S.svg'
            ]
        },
        { 
            type: 'cloud', 
            icons: [
                '/net_icons/Cloud-2D-Blue-S.svg',
                '/net_icons/Cloud-2D-Green-S.svg',
                '/net_icons/Cloud-2D-Grey-S.svg',
                '/net_icons/Cloud-2D-White-S.svg'
            ]
        }
    ];

    const handleDragStartDevice = (e, deviceType, iconPath) => {
        e.dataTransfer.setData('nodeType', deviceType);
        e.dataTransfer.setData('iconPath', iconPath);
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
                                                title={icon.split('.')[0]}
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
                                                        src={`/net_icons/${icon}`}
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
                {DEVICE_ICONS.map((deviceGroup) => (
                    <div key={deviceGroup.type} className="device-group">
                        <h3>{deviceGroup.type.charAt(0).toUpperCase() + deviceGroup.type.slice(1)}</h3>
                        <div className="icon-container">
                            {deviceGroup.icons.map((iconPath, index) => (
                                <img 
                                    key={`${deviceGroup.type}-${index}`}
                                    src={iconPath} 
                                    alt={`${deviceGroup.type} icon`}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStartDevice(e, deviceGroup.type, iconPath)}
                                    className="device-icon"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </Box>
        </Box>
    );
};

export default IconMenu;
