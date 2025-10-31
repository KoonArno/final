// File: web/src/App.js
// (เพิ่ม 1 Route)
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import AdminLayout from './AdminLayout'; 
import DashboardHome from './DashboardHome'; 
import UserManagement from './UserManagement'; 
import GeofenceManagement from './GeofenceManagement'; 
import AttendanceLogPage from './AttendanceLogPage'; 
import SubjectManagement from './SubjectManagement'; 
import SubjectEnrollmentPage from './SubjectEnrollmentPage'; // ⭐️⭐️ IMPORT ใหม่ ⭐️⭐️
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
        <Route path="subjects" element={<SubjectManagement />} /> 
        <Route path="logs" element={<AttendanceLogPage />} />
        
        {/* ⭐️⭐️ ADD THIS LINE ⭐️⭐️ */}
        <Route path="subjects/:id/users" element={<SubjectEnrollmentPage />} />

      </Route>

      {/* ถ้าเข้าหน้าอื่น ให้เด้งกลับหน้าหลัก */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;