// File: web/src/SubjectEnrollmentPage.js
// (อัปเดต: เพิ่มปุ่ม Import CSV)

import React, { useState, useEffect, useRef } from 'react'; // ⭐️ [เพิ่ม] useRef
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
  Button, // ⭐️ [เพิ่ม]
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import ClassIcon from '@mui/icons-material/Class';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FileUploadIcon from '@mui/icons-material/FileUpload';

// Columns (เหมือนเดิม)
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
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ⭐️ [เพิ่ม] State สำหรับการ Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRef = useRef(null); // ⭐️ Ref สำหรับ hidden input

  // ⭐️ [แก้ไข] แยก Logic การ Fetch ออกมา
  const fetchSubjectDetails = () => {
    setLoading(true);
    setError('');
    api.get(`/admin/subjects/${id}/details`)
      .then(response => {
        setSubject(response.data);
        setUsers(response.data.users); 
      })
      .catch(err => {
        setError('Failed to load subject details: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // ⭐️ [แก้ไข] เรียกใช้ fetchSubjectDetails ใน useEffect
  useEffect(() => {
    fetchSubjectDetails();
  }, [id]); 

  // ⭐️ [เพิ่ม] Handler สำหรับการเลือกไฟล์
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input value เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
    event.target.value = null;
  };

  // ⭐️ [เพิ่ม] Handler สำหรับการ Upload
  const handleUpload = (file) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('csvfile', file); // ⭐️ 'csvfile' ต้องตรงกับที่ server.js (upload.single)

    api.post(`/admin/subjects/${id}/import-users`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then(response => {
        setUploadSuccess(response.data.message || 'Import successful.');
        fetchSubjectDetails(); // ⭐️⭐️ Refresh ตาราง User เมื่อสำเร็จ
    })
    .catch(err => {
        setUploadError(err.response?.data?.error || 'An error occurred during upload.');
    })
    .finally(() => {
        setUploading(false);
    });
  };


  if (loading && !subject) { // ⭐️ แก้ไข: ให้โหลดครั้งแรกเท่านั้น
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
            <IconButton onClick={() => navigate('/')} disabled={uploading}>
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

        {/* --- ⭐️ [เพิ่ม] 3. Import Button --- */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', my: 2, p: 2, border: '1px dashed #ddd', borderRadius: '8px' }}>
          <Box>
            <Typography variant="h6" gutterBottom>Import Students</Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              Upload a CSV file with headers: <strong>student_id, full_name</strong> (or <strong>รหัสนักศึกษา, ชื่อนามสกุล</strong>).<br/>
              Users will be created or updated, and automatically enrolled in this subject.
            </Typography>
            <Button
                variant="contained"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <FileUploadIcon />}
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
            >
                {uploading ? 'Importing...' : 'Import CSV File'}
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                hidden
                accept=".csv, text/csv"
                onChange={handleFileSelect}
            />
          </Box>
        </Box>
        
        {/* --- ⭐️ [เพิ่ม] Alerts for upload status --- */}
        {uploadError && <Alert severity="error" sx={{ my: 2 }}>{uploadError}</Alert>}
        {uploadSuccess && <Alert severity="success" sx={{ my: 2 }}>{uploadSuccess}</Alert>}


        {/* --- 4. User Table --- */}
        <Box sx={{ height: 600, width: '100%', mt: 3 }}>
          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row.user_id}
            loading={loading || uploading} // ⭐️ แสดง loading
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