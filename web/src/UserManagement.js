// File: web/src/UserManagement.js
// (เวอร์ชัน MUI: ใช้ DataGrid สำหรับแสดงผล, แต่ยังคง logic การ Edit คล้ายเดิม)
// หมายเหตุ: การ Edit ใน DataGrid โดยตรงซับซ้อนกว่า
// นี่คือเวอร์ชันที่ปรับปรุงจากโค้ดเดิมของคุณ

import React, { useState, useEffect } from 'react';
import { api } from './auth';
import { 
  Box, Typography, Card, CardContent, Grid, TextField, Button, 
  CircularProgress, Alert, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

function UserManagement() {
  const [users, setUsers] = useState([]);
  // State for adding
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  // State for editing
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFormData, setEditFormData] = useState({ username: '', fullName: '', isActive: true, password: '' });
  // General state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) { setError('Failed to fetch users.'); }
    finally { setLoading(false); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault(); setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters long.'); return; }
    setLoading(true);
    try {
      await api.post('/users', { username, password, fullName });
      setUsername(''); setPassword(''); setFullName('');
      fetchUsers();
    } catch (err) { setError(err.response?.data?.error || 'Failed to add user'); }
    finally { setLoading(false); }
  };

  const handleStartEdit = (user) => {
      setEditingUserId(user.user_id);
      setEditFormData({ username: user.username, fullName: user.full_name, isActive: user.is_active, password: '' });
      setError('');
  };

  const handleUpdateUser = async (userId) => {
      setError(''); setLoading(true);
      const payload = { username: editFormData.username, fullName: editFormData.fullName, isActive: editFormData.isActive };
      if (editFormData.password) {
        if (editFormData.password.length < 6) { setError('Password must be at least 6 characters long.'); setLoading(false); return; }
        payload.password = editFormData.password;
      }
      try {
          await api.put(`/users/${userId}`, payload);
          setEditingUserId(null); fetchUsers();
      } catch (err) { setError(err.response?.data?.error || 'Failed to update user'); }
      finally { setLoading(false); }
  };

  const handleCancelEdit = () => { setEditingUserId(null); setError(''); };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      setError(''); setLoading(true);
      try { await api.delete(`/users/${userId}`); fetchUsers(); }
      catch (err) { setError(err.response?.data?.error || 'Failed to delete user'); }
      finally { setLoading(false); }
    }
  };

  const handleEditInputChange = (e) => {
      const { name, value, type, checked } = e.target;
      setEditFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>User Management</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* --- Add User Form (ซ่อนตอน Edit) --- */}
        {!editingUserId && (
          <Box component="form" onSubmit={handleAddUser} sx={{ mb: 2, p: 2, border: '1px dashed #ddd', borderRadius: '8px' }}>
            <Typography variant="h6" gutterBottom>Add New User</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}><TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth disabled={loading} /></Grid>
              <Grid item xs={12} sm={3}><TextField label="Password (min 6)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} fullWidth disabled={loading} /></Grid>
              <Grid item xs={12} sm={3}><TextField label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth disabled={loading} /></Grid>
              <Grid item xs={12} sm={3}><Button type="submit" variant="contained" disabled={loading} fullWidth>{loading ? <CircularProgress size={24} /> : 'Add User'}</Button></Grid>
            </Grid>
          </Box>
        )}
        
        {/* --- Users Table (ใช้ MUI Table) --- */}
        <TableContainer component={Paper}>
          {loading && users.length === 0 && <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>}
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Full Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Active?</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Face Registered?</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id} sx={{ backgroundColor: editingUserId === user.user_id ? '#f0f0f0' : 'inherit' }}>
                  {editingUserId === user.user_id ? (
                    // --- ⭐️ แถวในโหมด Edit ⭐️ ---
                    <>
                      <TableCell>{user.user_id}</TableCell>
                      <TableCell><TextField name="username" value={editFormData.username} onChange={handleEditInputChange} size="small" variant="standard" /></TableCell>
                      <TableCell><TextField name="fullName" value={editFormData.fullName} onChange={handleEditInputChange} size="small" variant="standard" /></TableCell>
                      <TableCell><Switch name="isActive" checked={editFormData.isActive} onChange={handleEditInputChange} /></TableCell>
                      <TableCell align="center">{user.face_registered ? '✅' : '❌'}</TableCell>
                      <TableCell>
                        <TextField name="password" placeholder="New Password (optional)" type="password" value={editFormData.password} onChange={handleEditInputChange} size="small" variant="standard" sx={{ mb: 1, width: '100%' }} />
                        <IconButton onClick={() => handleUpdateUser(user.user_id)} disabled={loading} color="success" size="small"><SaveIcon /></IconButton>
                        <IconButton onClick={handleCancelEdit} disabled={loading} color="default" size="small"><CancelIcon /></IconButton>
                      </TableCell>
                    </>
                  ) : (
                    // --- ⭐️ แถวในโหมดปกติ ⭐️ ---
                    <>
                      <TableCell>{user.user_id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.full_name}</TableCell>
                      <TableCell align="center">{user.is_active ? '✅' : '❌'}</TableCell>
                      <TableCell align="center">{user.face_registered ? '✅' : '❌'}</TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleStartEdit(user)} disabled={loading || editingUserId !== null} color="primary" size="small"><EditIcon /></IconButton>
                        <IconButton onClick={() => handleDeleteUser(user.user_id, user.username)} disabled={loading || editingUserId !== null} color="error" size="small"><DeleteIcon /></IconButton>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default UserManagement;