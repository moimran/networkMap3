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
  padding-left: ${props => props.$depth * 1.5}rem;
`;

const TreeLine = styled.span`
  position: absolute;
  left: ${props => (props.$depth - 0.5) * 1.5}rem;
  top: 50%;
  width: 1rem;
  height: 1px;
  background-color: ${({ theme }) => theme.colors?.border || '#e0e0e0'};
  display: ${props => (props.$depth > 0 ? 'block' : 'none')};
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
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  const colors = {
    folder: '#ffd700',        // Golden yellow for folders
    folderOpen: '#ffb900',    // Darker yellow for open folders
    file: '#4a90e2',         // Blue for files
    delete: '#ff4d4f',       // Red for delete button
    add: '#52c41a',          // Green for add button
    hover: 'rgba(0, 0, 0, 0.1)'
  };

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

  const handleCreateClick = (type, item = null) => {
    const targetPath = item?.path || (selectedItem?.type === 'folder' ? selectedItem.path : '');
    console.log('Creating in path:', targetPath); 
    setDialogType(type);
    setItemName('');
    setCurrentPath(targetPath);
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setItemName('');
  };

  const handleItemCreate = async () => {
    if (!itemName) return;

    try {
      console.log('Creating item in path:', currentPath); 
      const cleanPath = currentPath.startsWith('/') ? currentPath.slice(1) : currentPath;
      
      if (dialogType === 'folder') {
        await axios.post('/api/create-folder', {
          path: cleanPath,
          name: itemName
        });
      } else {
        // Send raw filename, backend will handle extension
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

  const handleDeleteClick = (item, e) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      // Send the path with .json extension if it's already there
      const path = itemToDelete.path;
      await axios.delete('/api/delete-item', {
        data: {
          path,
          type: itemToDelete.type
        }
      });
      await loadFiles();
      if (selectedItem?.path === itemToDelete.path) {
        setSelectedItem(null);
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setSelectedItem(file);
    // File name already comes without extension from the backend
    navigate(`/diagram/${file.name}`);
  };

  const toggleFolder = (folder, e) => {
    e.stopPropagation(); 
    setExpandedFolders(prev => ({
      ...prev,
      [folder.path]: !prev[folder.path]
    }));
  };

  const handleItemClick = (item, e) => {
    e.stopPropagation(); 
    setSelectedItem(item);
    if (item.type === 'file') {
      handleFileClick(item);
    }
  };

  const renderTreeItems = (items, depth = 0) => {
    return items.map(item => (
      <React.Fragment key={item.path}>
        <TreeItem
          onClick={(e) => handleItemClick(item, e)}
          style={{ 
            backgroundColor: selectedItem?.path === item.path ? colors.hover : 'transparent' 
          }}
        >
          <TreeLine $depth={depth} />
          <TreeItemContent $depth={depth}>
            {item.type === 'folder' && (
              <IconButton 
                onClick={(e) => toggleFolder(item, e)}
                style={{ padding: '2px' }}
              >
                {expandedFolders[item.path] ? <FaChevronDown color="#666" /> : <FaChevronRight color="#666" />}
              </IconButton>
            )}
            {item.type === 'folder' ? (
              expandedFolders[item.path] ? 
                <FaFolderOpen style={{ color: colors.folderOpen }} /> : 
                <FaFolder style={{ color: colors.folder }} />
            ) : (
              <FaFile style={{ color: colors.file }} />
            )}
            <span>{item.name}</span>
          </TreeItemContent>
          <TreeItemActions className="actions">
            {item.type === 'folder' && (
              <Tooltip title="Add Item">
                <IconButton 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateClick('file', item);
                  }}
                >
                  <FaPlus style={{ color: colors.add }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete">
              <IconButton 
                onClick={(e) => handleDeleteClick(item, e)}
              >
                <FaTrash style={{ color: colors.delete }} />
              </IconButton>
            </Tooltip>
          </TreeItemActions>
        </TreeItem>

        {item.type === 'folder' && expandedFolders[item.path] && item.children && (
          <div style={{ marginLeft: '20px' }}>
            {renderTreeItems(item.children, depth + 1)}
          </div>
        )}
      </React.Fragment>
    ));
  };

  return (
    <FileExplorerContainer>
      <FileExplorerHeader>
        <Title>Files</Title>
        <ButtonGroup>
          <IconButton onClick={() => handleCreateClick('file')} title="New File">
            <FaPlus style={{ color: colors.add }} />
          </IconButton>
          <IconButton onClick={() => handleCreateClick('folder')} title="New Folder">
            <FaFolderPlus style={{ color: colors.folder }} />
          </IconButton>
        </ButtonGroup>
      </FileExplorerHeader>

      <div>
        {files.map(item => renderTreeItems([item], 0))}
      </div>

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

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        PaperProps={{
          style: {
            minWidth: '400px'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {itemToDelete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {itemToDelete.type === 'folder' ? (
                  <FaFolder style={{ color: colors.folder }} />
                ) : (
                  <FaFile style={{ color: colors.file }} />
                )}
                <span>
                  Are you sure you want to delete{' '}
                  <strong>{itemToDelete.name}</strong>
                  {itemToDelete.type === 'folder' ? ' and all its contents' : ''}?
                </span>
              </div>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            sx={{ 
              bgcolor: colors.delete,
              '&:hover': {
                bgcolor: '#ff7875'
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </FileExplorerContainer>
  );
};

export default FileExplorer;
