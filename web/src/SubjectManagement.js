// File: web/src/SubjectManagement.js
// (ไฟล์นี้สร้างใหม่ทั้งหมด)

import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, TextField, Modal, IconButton, Switch, FormControlLabel, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { api } from './auth'; // ⭐️ Import api instance
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';

// ⭐️ Style สำหรับ Modal (เหมือนใน UserManagement)
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(null);

  // ⭐️ State สำหรับ Form
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    isActive: true,
  });

  // ⭐️ Fetch ข้อมูลวิชา
  const fetchSubjects = () => {
    setLoading(true);
    setError('');
    api.get('/admin/subjects') // ⭐️ เรียก API ดึงวิชา
      .then(response => {
        setSubjects(response.data);
      })
      .catch(err => {
        setError('Failed to fetch subjects: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => setLoading(false));
  };

  // ⭐️ เรียก fetchSubjects() เมื่อ Component โหลด
  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleOpenCreate = () => {
    setIsEdit(false);
    setCurrentSubject(null);
    setFormData({ code: '', name: '', description: '', isActive: true });
    setOpen(true);
    setError('');
  };

  const handleOpenEdit = (subject) => {
    setIsEdit(true);
    setCurrentSubject(subject);
    setFormData({
      code: subject.code,
      name: subject.name,
      description: subject.description || '',
      isActive: subject.is_active,
    });
    setOpen(true);
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ⭐️ จัดการการ Submit Form (Create/Update)
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const apiCall = isEdit
      ? api.put(`/admin/subjects/${currentSubject.subject_id}`, formData) // ⭐️ API แก้ไข
      : api.post('/admin/subjects', formData); // ⭐️ API สร้างใหม่

    apiCall.then(response => {
      fetchSubjects(); // โหลดข้อมูลใหม่
      handleClose();
    }).catch(err => {
      setError('Operation failed: ' + (err.response?.data?.error || err.message));
    });
  };

  // ⭐️ จัดการการลบ
  const handleDelete = (id) => {
    if (!window.confirm('Are you sure you want to delete this subject? This might fail if it is linked to attendance logs.')) {
      return;
    }
    setError('');
    api.delete(`/admin/subjects/${id}`) // ⭐️ API ลบ
      .then(() => {
        fetchSubjects(); // โหลดข้อมูลใหม่
      })
      .catch(err => {
        setError('Delete failed: ' + (err.response?.data?.error || err.message));
      });
  };

  // ⭐️ Columns สำหรับ DataGrid
  const columns = [
    { field: 'subject_id', headerName: 'ID', width: 70 },
    { field: 'code', headerName: 'Subject Code', width: 150 },
    { field: 'name', headerName: 'Subject Name', width: 250 },
    { field: 'description', headerName: 'Description', width: 300 },
    { 
      field: 'is_active', 
      headerName: 'Active', 
      width: 100,
      type: 'boolean'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit Subject">
            <IconButton onClick={() => handleOpenEdit(params.row)} color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Subject">
            <IconButton onClick={() => handleDelete(params.row.subject_id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Subject Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleIcon />}
            onClick={handleOpenCreate}
          >
            Add Subject
          </Button>
        </Box>
        {error && <Typography color="error" gutterBottom>{error}</Typography>}
        <Box sx={{ height: 600, width: '100%', mt: 2 }}>
          <DataGrid
            rows={subjects}
            columns={columns}
            getRowId={(row) => row.subject_id} // ⭐️ ใช้ subject_id เป็น ID
            loading={loading}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: { sortModel: [{ field: 'code', sort: 'asc' }] },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </CardContent>

      {/* Modal สำหรับ Create/Edit */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">
            {isEdit ? 'Edit Subject' : 'Create New Subject'}
          </Typography>
          {error && <Typography color="error" gutterBottom>{error}</Typography>}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth margin="normal"
              label="Subject Code (e.g., CS101)"
              name="code"
              value={formData.code}
              onChange={handleFormChange}
              required
            />
            <TextField
              fullWidth margin="normal"
              label="Subject Name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              required
            />
            <TextField
              fullWidth margin="normal"
              label="Description (Optional)"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              multiline
              rows={3}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={handleFormChange}
                  name="isActive"
                />
              }
              label="Is Active"
            />
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleClose} sx={{ mr: 1 }}>Cancel</Button>
              <Button type="submit" variant="contained">
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
    </Card>
  );
}