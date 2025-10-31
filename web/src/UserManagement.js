// File: web/src/UserManagement.js
// (ไฟล์ใหม่ทั้งหมด: เปลี่ยนไปใช้ DataGrid + Modal เพื่อให้รองรับการเลือก Subject)

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Modal, TextField,
  CircularProgress, Alert, Switch, FormControlLabel, Tooltip, IconButton,
  List, ListItem, ListItemButton, ListItemText, ListItemIcon, Checkbox, Paper
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { api } from './auth';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';

// ⭐️ Style สำหรับ Modal
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'clamp(400px, 60vw, 600px)', // Responsive width
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  maxHeight: '85vh',
  overflowY: 'auto'
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]); // ⭐️ [ใหม่] เก็บวิชาทั้งหมด
  
  // State for Add/Edit Modal
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    isActive: true,
  });
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set()); // ⭐️ [ใหม่] เก็บ ID วิชาที่เลือก
  
  // General state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // ⭐️ Fetch ข้อมูล User (ทำใน useEffect)
  const fetchUsers = () => {
    setLoading(true); setError('');
    api.get('/users')
      .then(response => {
        setUsers(response.data);
      })
      .catch(err => setError('Failed to fetch users.'))
      .finally(() => setLoading(false));
  };
  
  // ⭐️ Fetch วิชาทั้งหมด (ทำใน useEffect)
  const fetchAllSubjects = () => {
    api.get('/admin/subjects') // ⭐️ เรียก API ที่มีอยู่แล้ว
      .then(response => {
        setAllSubjects(response.data);
      })
      .catch(err => setError('Failed to load subjects. Subject selection will be unavailable.'));
  };

  useEffect(() => {
    fetchUsers();
    fetchAllSubjects(); // ⭐️ โหลดวิชาทั้งหมดเมื่อเปิดหน้า
  }, []);

  // --- Modal Handlers ---
  const handleOpenCreate = () => {
    setIsEdit(false);
    setCurrentUser(null);
    setFormData({ username: '', password: '', fullName: '', isActive: true });
    setSelectedSubjectIds(new Set()); // ⭐️ เคลียร์วิชา
    setFormError('');
    setOpen(true);
  };

  const handleOpenEdit = (user) => {
    setIsEdit(true);
    setCurrentUser(user);
    setFormData({
      username: user.username,
      fullName: user.full_name,
      isActive: user.is_active,
      password: '', // ไม่แสดง pass เก่า, ให้กรอกใหม่ถ้าจะเปลี่ยน
    });
    // ⭐️ ตั้งค่าวิชาที่ user คนนี้ลงทะเบียนไว้
    const enrolledIds = new Set(user.subjects.map(s => s.subject_id));
    setSelectedSubjectIds(enrolledIds);
    setFormError('');
    setOpen(true);
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
  
  // ⭐️ [ใหม่] จัดการการเลือกวิชาใน Modal
  const handleSubjectToggle = (subjectId) => {
    const newSelectedIds = new Set(selectedSubjectIds);
    if (newSelectedIds.has(subjectId)) {
      newSelectedIds.delete(subjectId);
    } else {
      newSelectedIds.add(subjectId);
    }
    setSelectedSubjectIds(newSelectedIds);
  };

  // --- CRUD Operations ---
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    
    // ตรวจสอบ Password
    if (!isEdit && formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (isEdit && formData.password && formData.password.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }
    
    // ⭐️ สร้าง Payload
    const payload = {
      username: formData.username,
      fullName: formData.fullName,
      isActive: formData.isActive,
    };
    
    // ⭐️ [ใหม่] เพิ่มวิชาใน Payload (เฉพาะตอน Edit)
    if (isEdit) {
      payload.subjectIds = Array.from(selectedSubjectIds);
    }
    
    // ⭐️ เพิ่ม pass ถ้ามีการกรอก
    if (formData.password) {
      payload.password = formData.password;
    }
    
    // ⭐️ เลือก API (Create vs Update)
    const apiCall = isEdit
      ? api.put(`/users/${currentUser.user_id}`, payload)
      : api.post('/users', payload);

    setLoading(true);
    apiCall
      .then(() => {
        handleClose();
        fetchUsers(); // โหลด user ใหม่
      })
      .catch(err => {
        setFormError(err.response?.data?.error || 'Operation failed');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDeleteUser = (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      setError(''); setLoading(true);
      api.delete(`/users/${userId}`)
        .then(() => fetchUsers())
        .catch(err => setError(err.response?.data?.error || 'Failed to delete user'))
        .finally(() => setLoading(false));
    }
  };

  // --- ⭐️ Columns สำหรับ DataGrid ⭐️ ---
  const columns = [
    { field: 'user_id', headerName: 'ID', width: 70 },
    { field: 'username', headerName: 'Username', width: 150 },
    { field: 'full_name', headerName: 'Full Name', width: 200 },
    { 
      field: 'is_active', 
      headerName: 'Active', 
      width: 90,
      type: 'boolean'
    },
    { 
      field: 'face_registered', 
      headerName: 'Face', 
      width: 90,
      type: 'boolean',
      renderCell: (params) => (params.value ? '✅ Yes' : '❌ No')
    },
    {
      field: 'subjects',
      headerName: 'Enrolled Subjects',
      width: 200,
      sortable: false,
      // ⭐️ แสดงรายชื่อวิชาที่ลงทะเบียน
      valueGetter: (value, row) => row.subjects.map(s => s.code).join(', '),
      renderCell: (params) => (
         <Tooltip title={params.value || 'None'}>
           <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
             {params.value || 'None'}
           </Box>
         </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit User & Subjects">
            <IconButton onClick={() => handleOpenEdit(params.row)} color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton onClick={() => handleDeleteUser(params.row.user_id, params.row.username)} color="error">
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
          <Typography variant="h5">User Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleIcon />}
            onClick={handleOpenCreate}
          >
            Add User
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box sx={{ height: 600, width: '100%', mt: 2 }}>
          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row.user_id}
            loading={loading}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </CardContent>

      {/* --- ⭐️ Modal สำหรับ Create / Edit ⭐️ --- */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle} component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" component="h2">
            {isEdit ? `Edit User: ${currentUser?.username}` : 'Create New User'}
          </Typography>
          
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
          
          <TextField
            fullWidth margin="normal"
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleFormChange}
            required
            disabled={loading}
          />
          <TextField
            fullWidth margin="normal"
            label={isEdit ? "New Password (Optional)" : "Password (min 6 chars)"}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleFormChange}
            required={!isEdit} // ⭐️ จำเป็นต้องกรอกตอนสร้าง
            disabled={loading}
          />
          <TextField
            fullWidth margin="normal"
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleFormChange}
            required
            disabled={loading}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={handleFormChange}
                name="isActive"
              />
            }
            label="User is Active"
            disabled={loading}
          />
          
          {/* --- ⭐️ [ใหม่] ส่วนเลือกวิชา (แสดงเฉพาะตอน Edit) ⭐️ --- */}
          {isEdit && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Subject Enrollments</Typography>
              <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                <List dense>
                  {allSubjects.length === 0 && <ListItem><ListItemText primary="No subjects available..." /></ListItem>}
                  {allSubjects.map((subject) => (
                    <ListItemButton 
                      key={subject.subject_id} 
                      onClick={() => handleSubjectToggle(subject.subject_id)}
                      disabled={loading}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={selectedSubjectIds.has(subject.subject_id)}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText primary={subject.name} secondary={subject.code} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Box>
          )}
          {/* --- สิ้นสุดส่วนเลือกวิชา --- */}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose} disabled={loading} sx={{ mr: 1 }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : (isEdit ? 'Save Changes' : 'Create User')}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Card>
  );
}