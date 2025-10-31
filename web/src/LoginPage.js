// File: face-attendance-system/web/src/LoginPage.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, API_URL } from './auth';
import axios from 'axios'; // ใช้ axios ธรรมดา (ไม่มี Token) สำหรับ login/register

const containerStyle = { padding: '20px', maxWidth: '400px', margin: '50px auto', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const inputStyle = { width: '95%', padding: '10px', margin: '10px 0', border: '1px solid #ccc', borderRadius: '4px' };
const buttonStyle = { width: '100%', padding: '10px', margin: '10px 0', border: 'none', borderRadius: '4px', background: '#007bff', color: 'white', cursor: 'pointer', fontSize: '16px' };
const toggleStyle = { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', marginTop: '10px', padding: '0' };
const errorStyle = { color: 'red', marginTop: '10px' };


function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isRegister ? `${API_URL}/admin/register` : `${API_URL}/admin/login`;
    const payload = isRegister ? { email, password, fullName } : { email, password };

    try {
      const response = await axios.post(url, payload);

      if (isRegister) {
        alert('Registration successful! Please log in.');
        setIsRegister(false); // กลับไปหน้า Login
        setFullName('');
        setEmail('');
        setPassword('');
      } else {
        // Login สำเร็จ
        setToken(response.data.token);
        navigate('/'); // 👈 ไปหน้า Dashboard
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'An error occurred. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: 'center' }}>{isRegister ? 'Register Admin' : 'Admin Login'}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          minLength={6}
          required
          disabled={loading}
        />
        {isRegister && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
            required
            disabled={loading}
          />
        )}
        <button type="submit" style={buttonStyle} disabled={loading}>
          {loading ? 'Loading...' : (isRegister ? 'Register' : 'Login')}
        </button>
      </form>
      {error && <p style={errorStyle}>{error}</p>}
      <button
        onClick={() => { setIsRegister(!isRegister); setError(''); }}
        style={toggleStyle}
        disabled={loading}
      >
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}

export default LoginPage;