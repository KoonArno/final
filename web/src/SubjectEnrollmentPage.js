// File: web/src/SubjectEnrollmentPage.js
// (ไฟล์นี้สร้างใหม่ทั้งหมด)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { api } from './auth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import ClassIcon from '@mui/icons-material/Class';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

// ⭐️ Columns สำหรับตาราง User
const columns = [
  { field: 'user_id', headerName: 'ID', width: 90 },
  { field: 'username', headerName: 'Username', width: 180 },
  { field: 'full_name', headerName: 'Full Name', flex: 1, minWidth: 200 },
  {
    field: 'is_active',
    headerName: 'Active',
    type: 'boolean',
    width: 100,
  },
  {
    field: 'face_registered',
    headerName: 'Face Reg.',
    width: 120,
    renderCell: (params) => (
      params.value 
        ? <CheckCircleIcon color="success" /> 
        : <CancelIcon color="disabled" />
    )
  }
];

export default function SubjectEnrollmentPage() {
  const { id } = useParams(); // ⭐️ ดึง subject_id จาก URL
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // ⭐️ เรียก API ใหม่ที่เราสร้าง
    setLoading(true);
    setError('');
    api.get(`/admin/subjects/${id}/details`)
      .then(response => {
        setSubject(response.data);
        setUsers(response.data.users); // ⭐️ ได้รายชื่อ User มาจาก API
      })
      .catch(err => {
        setError('Failed to load subject details: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]); // ⭐️ เมื่อ id เปลี่ยน ให้ fetch ใหม่

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  if (!subject) {
    return <Typography sx={{ p: 3, textAlign: 'center' }}>Subject not found.</Typography>;
  }

  return (
    <Card>
      <CardContent>
        {/* --- 1. Navigation & Back Button --- */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              component={RouterLink}
              underline="hover"
              sx={{ display: 'flex', alignItems: 'center' }}
              color="inherit"
              to="/"
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Dashboard
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              <ClassIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              {subject.name}
            </Typography>
          </Breadcrumbs>

          <Tooltip title="Back to Dashboard">
            <IconButton onClick={() => navigate('/')}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* --- 2. Title --- */}
        <Typography variant="h5" gutterBottom>
          Enrolled Users in: {subject.name} ({subject.code})
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Total {users.length} user(s) enrolled.
        </Typography>

        {/* --- 3. User Table --- */}
        <Box sx={{ height: 600, width: '100%', mt: 3 }}>
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
    </Card>
  );
}