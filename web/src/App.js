// File: web/src/App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import AdminLayout from './AdminLayout'; // ⭐️ Import Layout ใหม่
import DashboardHome from './DashboardHome'; // ⭐️ หน้า Dashboard หลัก
import UserManagement from './UserManagement'; // Component เดิม
import GeofenceManagement from './GeofenceManagement'; // Component เดิม
import AttendanceLogPage from './AttendanceLogPage'; // ⭐️ หน้าใหม่สำหรับ Log
import { getToken } from './auth';

// Component ป้องกัน
function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      {/* 1. หน้า Login (อยู่นอก Layout) */}
      <Route path="/login" element={<LoginPage />} />

      {/* 2. หน้าหลัก (/) จะใช้ AdminLayout หุ้ม */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        {/* ⭐️ หน้าลูก (nested routes) ที่จะแสดงใน <Outlet /> ⭐️ */}
        <Route index element={<DashboardHome />} /> {/* หน้าแรก (Dashboard) */}
        <Route path="users" element={<UserManagement />} />
        <Route path="geofences" element={<GeofenceManagement />} />
        <Route path="logs" element={<AttendanceLogPage />} />
      </Route>

      {/* ถ้าเข้าหน้าอื่น ให้เด้งกลับหน้าหลัก */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;