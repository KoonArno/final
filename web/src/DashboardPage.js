// File: face-attendance-system/web/src/DashboardPage.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { removeToken, api } from './auth'; // ใช้ 'api' ที่มี Token
import UserManagement from './UserManagement';
import GeofenceManagement from './GeofenceManagement'; // 👈 Import

const dashboardStyle = { padding: '20px', maxWidth: '1200px', margin: '20px auto', fontFamily: 'Arial' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px' };
const logoutStyle = { padding: '8px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const testSectionStyle = { background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '5px', padding: '15px', marginTop: '20px' };

function DashboardPage() {
  const navigate = useNavigate();
  const [dbStatus, setDbStatus] = useState('...not tested...');

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const testDB = async () => {
    try {
      setDbStatus('Testing...');
      const response = await api.get('/test-db'); // ใช้ 'api'
      setDbStatus(`✅ ${response.data.message}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setDbStatus(`❌ FAILED: ${msg}`);
    }
  };

  return (
    <div style={dashboardStyle}>
      <div style={headerStyle}>
        <h1>🖥️ Admin Dashboard</h1>
        <button onClick={handleLogout} style={logoutStyle}>
          Logout
        </button>
      </div>
      
      <hr style={{ margin: '20px 0' }} />
      
      {/* ⭐️ Component จัดการ Geofence (มี Edit) ⭐️ */}
      <GeofenceManagement /> 

      <hr style={{ margin: '20px 0' }} />
      
      {/* ⭐️ Component จัดการ User (มี Edit, ไม่มี Upload) ⭐️ */}
      <UserManagement />

      <hr style={{ margin: '20px 0' }} />

      {/* ⭐️ ปุ่มทดสอบการเชื่อมต่อ (ยังเก็บไว้) ⭐️ */}
      <div style={testSectionStyle}>
        <h2>System Connection Tests</h2>
        <div>
          <button onClick={testDB}>Test DB Connection</button>
          <p style={{ display: 'inline', marginLeft: '10px' }}>Status: {dbStatus}</p>
        </div>
        {/* (เราลบปุ่ม Test AI ออก เพราะ Endpoint /checkin เก่าถูกลบไปแล้ว)
          (การทดสอบ AI ตอนนี้ทำผ่านการ Upload Face ใน UserManagement) 
        */}
      </div>
    </div>
  );
}

export default DashboardPage;