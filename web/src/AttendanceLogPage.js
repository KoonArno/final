// File: web/src/AttendanceLogPage.js
import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Link } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { api } from './auth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

// ⭐️ อัปเดต Columns ใหม่ทั้งหมด ⭐️
const columns = [
  { field: 'log_id', headerName: 'Log ID', width: 90 },
  { 
    field: 'user_name', 
    headerName: 'User', 
    width: 200,
    // ⭐️ ดึงข้อมูลจาก Object ที่ Join มา
    valueGetter: (value, row) => `${row.users?.full_name || 'N/A'} (${row.users?.username || 'N/A'})`
  },
  { 
    field: 'subject_name', 
    headerName: 'Subject', 
    width: 220,
    // ⭐️ ดึงข้อมูลจาก Object ที่ Join มา
    valueGetter: (value, row) => row.subjects ? `${row.subjects.name} (${row.subjects.code})` : 'N/A'
  },
  { 
    field: 'check_in_time', 
    headerName: 'Check-in Time', 
    width: 200, 
    type: 'dateTime',
    valueGetter: (value) => value ? new Date(value) : null,
    valueFormatter: (value) => value ? value.toLocaleString() : ''
  },
  { 
    field: 'is_in_geofence', 
    headerName: 'In Geofence?', 
    width: 120, 
    type: 'boolean',
    renderCell: (params) => (
      params.value ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />
    )
  },
  { 
    field: 'face_match_distance', 
    headerName: 'Face Distance', 
    width: 120, 
    type: 'number',
    valueFormatter: (value) => value ? value.toFixed(4) : '-'
  },
  { 
    field: 'image_url', 
    headerName: 'Image', 
    width: 150,
    renderCell: (params) => (
      params.value ? 
      // ⭐️ ใช้ api.defaults.baseURL เพื่อสร้าง URL ที่ถูกต้อง
      <Link href={`${api.defaults.baseURL}${params.value}`} target="_blank" rel="noopener noreferrer">
        View Image
      </Link> 
      : 'No Image'
    )
  },
];

export default function AttendanceLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // ⭐️ อัปเดต Effect ให้เรียก API ⭐️
    setLoading(true); 
    setError('');
    api.get('/admin/attendance-logs') // ⭐️ เรียก Endpoint ใหม่
      .then(response => {
        setLogs(response.data);
      })
      .catch(err => {
        setError('Failed to fetch logs: ' + (err.response?.data?.error || err.message));
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>Attendance Logs</Typography>
        {error && <Typography color="error" gutterBottom>{error}</Typography>}
        <Box sx={{ height: 600, width: '100%', mt: 2 }}>
          <DataGrid
            rows={logs}
            columns={columns}
            getRowId={(row) => row.log_id} // ⭐️ ใช้ log_id เป็น ID
            loading={loading}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: { // ⭐️ เรียงลำดับตามเวลาล่าสุดก่อน
                sortModel: [{ field: 'check_in_time', sort: 'desc' }],
              },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </CardContent>
    </Card>
  );
}