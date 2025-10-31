// File: web/src/DashboardHome.js
import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Button } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MapIcon from '@mui/icons-material/Map';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from './auth'; // Import api

// ข้อมูลจำลองสำหรับ Chart
const chartData = [
  { name: 'Mon', Present: 8, Absent: 2 },
  { name: 'Tue', Present: 9, Absent: 1 },
  { name: 'Wed', Present: 7, Absent: 3 },
  { name: 'Thu', Present: 10, Absent: 0 },
  { name: 'Fri', Present: 8, Absent: 2 },
];

function SummaryCard({ title, value, icon, color }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom>{title}</Typography>
            <Typography variant="h4">{value}</Typography>
          </Box>
          <Box sx={{ 
            backgroundColor: color, 
            color: 'white', 
            borderRadius: '50%', 
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardHome() {
  const [dbStatus, setDbStatus] = useState('...not tested...');

  const testDB = async () => {
    try {
      setDbStatus('Testing...');
      const response = await api.get('/test-db');
      setDbStatus(`✅ ${response.data.message}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setDbStatus(`❌ FAILED: ${msg}`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard Overview</Typography>
      
      {/* 1. Cards สรุปข้อมูล */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <SummaryCard title="Total Users" value="12" icon={<PeopleIcon />} color="#1976d2" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard title="Total Geofences" value="3" icon={<MapIcon />} color="#ed6c02" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard title="Check-ins Today" value="8" icon={<CheckCircleIcon />} color="#2e7d32" />
        </Grid>
      </Grid>
      
      {/* 2. Chart กราฟ */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Weekly Attendance</Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" fill="#2e7d32" />
                <Bar dataKey="Absent" fill="#d32f2f" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* 3. ปุ่ม Test (ย้ายมาไว้ที่นี่) */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>System Connection Test</Typography>
          <Button onClick={testDB} variant="outlined">Test DB Connection</Button>
          <Typography sx={{ display: 'inline', marginLeft: '15px' }}>Status: {dbStatus}</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}