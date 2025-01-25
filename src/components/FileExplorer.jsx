import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
  FaFolder,
  FaFolderOpen,
  FaFile,
  FaPlus,
  FaFolderPlus,
  FaTrash,
  FaChevronRight,
  FaChevronDown
} from "react-icons/fa";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton as MuiIconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse
} from '@mui/material';
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const FileExplorerContainer = styled.div`
  width: 250px;
  height: 100%;
  background-color: ${({ theme }) => theme.colors?.background || '#ffffff'};
  color: ${({ theme }) => theme.colors?.text || '#000000'};
  border-left: 1px solid ${({ theme }) => theme.colors?.border || '#e0e0e0'};
  padding: 1rem;
  overflow-y: auto;
  font-family: monospace;
`;

const FileExplorerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.1rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors?.text || '#000000'};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors?.hover || 'rgba(0, 0, 0, 0.04)'};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors?.primary || '#1976d2'};
  }
`;

const TreeItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0.25rem;
  cursor: pointer;
  border-radius: 4px;
  margin: 0.125rem 0;
  gap: 0.5rem;
  position: relative;

  &:hover {
    background-color: ${({ theme }) => theme.colors?.hover || 'rgba(0, 0, 0, 0.04)'};
  }

  &:hover .actions {
    display: flex;
  }
`;

const TreeItemContent = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  padding-left: ${props => props.depth * 1.5}rem;
`;

const TreeLine = styled.span`
  position: absolute;
  left: ${props => (props.depth - 0.5) * 1.5}rem;
  top: 50%;
  width: 1rem;
  height: 1px;
  background-color: ${({ theme }) => theme.colors?.border || '#e0e0e0'};
  display: ${props => (props.depth > 0 ? 'block' : 'none')};
`;

const TreeItemActions = styled.div`
  display: none;
  gap: 0.25rem;
  margin-left: auto;
`;

const FileExplorer = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('file');
  const [itemName, setItemName] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedItem, setSelectedItem] = useState(null);
  const [open, setOpen] = useState({});
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await axios.get('/api/diagrams');
      setFiles(response.data);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleCreateClick = (type, path = '') => {
    setDialogType(type);
    setItemName('');
    setCurrentPath(path);
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setItemName('');
  };

  const handleItemCreate = async () => {
    if (!itemName) return;

    try {
      const cleanPath = currentPath.startsWith('/') ? currentPath.slice(1) : currentPath;
      
      if (dialogType === 'folder') {
        await axios.post('/api/create-folder', {
          path: cleanPath,
          name: itemName
        });
      } else {
        await axios.post('/api/create-file', {
          path: cleanPath,
          name: itemName,
          content: {}
        });
      }
      await loadFiles();
      handleDialogClose();
    } catch (error) {
      console.error(`Error creating ${dialogType}:`, error);
    }
  };

  const handleDelete = async (item) => {
    try {
      await axios.delete('/api/delete-item', {
        data: {
          path: item.path,
          type: item.type
        }
      });
      await loadFiles();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    navigate(`/diagram/${file.name}`);
  };

  const renderTreeItem = (item, depth = 0) => {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders.has(item.path);
    const hasChildren = isFolder && item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.path}>
        <TreeItem
          onMouseEnter={() => setSelectedItem(item)}
          onMouseLeave={() => setSelectedItem(null)}
        >
          <TreeLine depth={depth} />
          <TreeItemContent
            depth={depth}
            onClick={() => isFolder ? toggleFolder(item.path) : handleFileClick(item)}
          >
            {isFolder && (hasChildren ? (
              isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />
            ) : <span style={{ width: '12px' }} />)}
            {isFolder ? (isExpanded ? <FaFolderOpen /> : <FaFolder />) : <FaFile />}
            <span>{item.name}</span>
          </TreeItemContent>
          
          {selectedItem === item && (
            <TreeItemActions className="actions">
              {isFolder && (
                <>
                  <Tooltip title="New File">
                    <MuiIconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateClick('file', item.path);
                      }}
                    >
                      <FaPlus size={12} />
                    </MuiIconButton>
                  </Tooltip>
                  <Tooltip title="New Folder">
                    <MuiIconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateClick('folder', item.path);
                      }}
                    >
                      <FaFolderPlus size={12} />
                    </MuiIconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip title="Delete">
                <MuiIconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                >
                  <FaTrash size={12} />
                </MuiIconButton>
              </Tooltip>
            </TreeItemActions>
          )}
        </TreeItem>
        {isExpanded && hasChildren && item.children.map(child => renderTreeItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  const handleClick = (path) => {
    setOpen(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => {
      const isFolder = item.type === 'folder';
      const isOpen = open[item.path];

      return (
        <React.Fragment key={item.path}>
          <ListItem
            button
            onClick={() => isFolder ? handleClick(item.path) : handleFileClick(item)}
            sx={{ pl: level * 2 }}
          >
            <ListItemIcon>
              {isFolder ? (isOpen ? <FaFolderOpen /> : <FaFolder />) : <FaFile />}
            </ListItemIcon>
            <ListItemText primary={item.name} />
            {isFolder && (
              <IconButton onClick={(e) => {
                e.stopPropagation();
                handleClick(item.path);
              }}>
                {isOpen ? <FaChevronDown /> : <FaChevronRight />}
              </IconButton>
            )}
          </ListItem>
          {isFolder && (
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderFileTree(item.children || [], level + 1)}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <FileExplorerContainer>
      <FileExplorerHeader>
        <Title>Files</Title>
        <ButtonGroup>
          <IconButton onClick={() => handleCreateClick('file')} title="New File">
            <FaPlus />
          </IconButton>
          <IconButton onClick={() => handleCreateClick('folder')} title="New Folder">
            <FaFolderPlus />
          </IconButton>
        </ButtonGroup>
      </FileExplorerHeader>

      <List component="nav">
        {renderFileTree(files)}
      </List>

      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>
          Create New {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}
          {currentPath && ` in ${currentPath}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label={`${dialogType.charAt(0).toUpperCase() + dialogType.slice(1)} Name`}
              fullWidth
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleItemCreate} variant="contained" color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </FileExplorerContainer>
  );
};

export default FileExplorer;
