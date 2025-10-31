// File: web/src/AdminLayout.js
import React from 'react';
import { Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline, Divider } from '@mui/material';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import MapIcon from '@mui/icons-material/Map';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import { removeToken } from './auth';

const drawerWidth = 250;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'User Management', icon: <PeopleIcon />, path: '/users' },
  { text: 'Geofence', icon: <MapIcon />, path: '/geofences' },
  { text: 'Attendance Logs', icon: <BarChartIcon />, path: '/logs' },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* 1. Header ด้านบน */}
      <AppBar
        position="fixed"
        sx={{ 
          width: `calc(100% - ${drawerWidth}px)`, 
          ml: `${drawerWidth}px`,
          backgroundColor: '#ffffff', // ⭐️ สีขาว
          color: '#333', // ⭐️ สีตัวอักษร
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)' // ⭐️ เงาจางๆ
        }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap component="div">
            Admin Dashboard
          </Typography>
          <ListItemButton onClick={handleLogout} sx={{ maxWidth: 120, borderRadius: '8px' }}>
            <ListItemIcon sx={{ minWidth: 30 }}><LogoutIcon color="error" /></ListItemIcon>
            <ListItemText primary="Logout" sx={{ color: 'error.main' }} />
          </ListItemButton>
        </Toolbar>
      </AppBar>
      
      {/* 2. Sidebar ด้านซ้าย */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            backgroundColor: '#111827', // ⭐️ สี Sidebar
            color: '#d1d5db',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ padding: '16px' }}>
           <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
             Face Attendance
           </Typography>
        </Toolbar>
        <Divider sx={{ borderColor: '#374151' }} />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ margin: '8px' }}>
              <ListItemButton 
                component={Link} 
                to={item.path}
                sx={{ 
                  borderRadius: '8px',
                  '&:hover': { backgroundColor: '#374151' },
                  '&.Mui-selected': { backgroundColor: '#1976d2' } // สีตอนเลือก
                }}
              >
                <ListItemIcon sx={{ color: '#d1d5db' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* 3. ส่วนเนื้อหาหลัก */}
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: '#f4f6f8', p: 3, minHeight: '100vh' }}
      >
        <Toolbar /> {/*เว้นที่ว่างให้ตรงกับ AppBar*/}
        
        {/* ⭐️ เนื้อหาของหน้า (UserManagement ฯลฯ) จะถูกแสดงตรงนี้ ⭐️ */}
        <Outlet /> 
        
      </Box>
    </Box>
  );
}