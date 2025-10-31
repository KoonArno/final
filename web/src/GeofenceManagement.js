// File: web/src/GeofenceManagement.js
// (เวอร์ชัน MUI: ใช้ DataGrid)

import React, { useState, useEffect } from 'react';
import { api } from './auth';
import { 
  Box, Typography, Card, CardContent, Grid, TextField, Button, 
  CircularProgress, Alert, Switch, FormControlLabel // 👈 เพิ่ม FormControlLabel และลบตัวที่ไม่ใช้ออก
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

function GeofenceManagement() {
  const [geofences, setGeofences] = useState([]);
  // State for adding
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [description, setDescription] = useState('');
  const [isActiveAdd, setIsActiveAdd] = useState(true);
  // General state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State for editing in DataGrid
  const [rowModesModel, setRowModesModel] = React.useState({});

  useEffect(() => { fetchGeofences(); }, []);

  const fetchGeofences = async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/geofences'); setGeofences(response.data); }
    catch (err) { setError('Failed to fetch geofences'); }
    finally { setLoading(false); }
  };

  const handleAddGeofence = async (e) => {
    e.preventDefault(); setError('');
    const lat = parseFloat(latitude); const lng = parseFloat(longitude); const rad = parseFloat(radius);
    if (isNaN(lat) || isNaN(lng) || isNaN(rad) || rad <= 0) { setError('Invalid coordinates or radius (must be > 0)'); return; }
    setLoading(true);
    try {
      await api.post('/geofences', { name, description, latitude: lat, longitude: lng, radius: rad, isActive: isActiveAdd });
      setName(''); setLatitude(''); setLongitude(''); setRadius(''); setDescription(''); setIsActiveAdd(true);
      fetchGeofences();
    } catch (err) { setError(err.response?.data?.error || 'Failed to add geofence'); }
    finally { setLoading(false); }
  };

  const handleDeleteGeofence = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete zone "${name}"?`)) {
      setError(''); setLoading(true);
      try { await api.delete(`/geofences/${id}`); fetchGeofences(); }
      catch (err) { setError(err.response?.data?.error || 'Failed to delete geofence'); }
      finally { setLoading(false); }
    }
  };
  
  // --- Logic การ Edit ของ DataGrid ---
  const handleEditClick = (id) => () => {
    setError('');
    setRowModesModel({ ...rowModesModel, [id]: { mode: 'edit' } });
  };

  const handleSaveClick = (id) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: 'view' } });
  };
  
  const handleCancelClick = (id) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: 'view', ignoreModifications: true } });
  };
  
  // เมื่อกด Save ในแถว
  const processRowUpdate = async (newRow) => {
    setError('');
    const lat = parseFloat(newRow.center_latitude);
    const lng = parseFloat(newRow.center_longitude);
    const rad = parseFloat(newRow.radius_meters);
    if (isNaN(lat) || isNaN(lng) || isNaN(rad) || rad <= 0) {
      setError('Invalid coordinates or radius (must be > 0) in edit form');
      throw new Error('Invalid coordinates or radius'); // บอก DataGrid ว่ามี Error
    }
    
    setLoading(true);
    try {
      const response = await api.put(`/geofences/${newRow.geofence_id}`, {
         name: newRow.name,
         description: newRow.description,
         latitude: lat,
         longitude: lng,
         radius: rad,
         isActive: newRow.is_active,
      });
      setLoading(false);
      fetchGeofences(); // ดึงข้อมูลใหม่หลัง Save (หรือจะอัปเดต state เองก็ได้)
      return response.data; // คืนค่าแถวที่อัปเดตแล้ว
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update geofence');
      setLoading(false);
      throw err; // บอก DataGrid ว่ามี Error
    }
  };

  const columns = [
    { field: 'geofence_id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 150, editable: true },
    { field: 'description', headerName: 'Description', width: 200, editable: true },
    { field: 'center_latitude', headerName: 'Latitude', width: 130, editable: true, type: 'number' },
    { field: 'center_longitude', headerName: 'Longitude', width: 130, editable: true, type: 'number' },
    { field: 'radius_meters', headerName: 'Radius (m)', width: 110, editable: true, type: 'number' },
    { field: 'is_active', headerName: 'Active?', width: 90, editable: true, type: 'boolean' },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      getActions: ({ id }) => {
        const isInEditMode = rowModesModel[id]?.mode === 'edit';
        if (isInEditMode) {
          return [
            <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={handleSaveClick(id)} color="primary" />,
            <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={handleCancelClick(id)} />,
          ];
        }
        return [
          <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={handleEditClick(id)} disabled={loading} />,
          <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteGeofence(id, geofences.find(r => r.geofence_id === id)?.name)} disabled={loading} color="error" />,
        ];
      },
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>Geofence Management</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* --- Add Geofence Form --- */}
        <Box component="form" onSubmit={handleAddGeofence} sx={{ mb: 2, p: 2, border: '1px dashed #ddd', borderRadius: '8px' }}>
          <Typography variant="h6" gutterBottom>Add New Zone</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item><TextField label="Zone Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} size="small" /></Grid>
            <Grid item><TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} size="small" /></Grid>
            <Grid item><TextField label="Latitude" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} required disabled={loading} size="small" /></Grid>
            <Grid item><TextField label="Longitude" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} required disabled={loading} size="small" /></Grid>
            <Grid item><TextField label="Radius (m)" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} required disabled={loading} size="small" /></Grid>
            <Grid item><FormControlLabel control={<Switch checked={isActiveAdd} onChange={(e) => setIsActiveAdd(e.target.checked)} disabled={loading} />} label="Active" /></Grid>
            <Grid item><Button type="submit" variant="contained" disabled={loading}>{loading ? <CircularProgress size={24} /> : 'Add Zone'}</Button></Grid>
          </Grid>
        </Box>
        
        {/* --- Geofences Table (DataGrid) --- */}
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={geofences}
            columns={columns}
            getRowId={(row) => row.geofence_id}
            loading={loading}
            editMode="row"
            rowModesModel={rowModesModel}
            onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(err) => setError(err.message)} // แสดง Error ถ้า Save ไม่ผ่าน
            initialState={{
              pagination: { paginationModel: { pageSize: 5 } },
            }}
            pageSizeOptions={[5, 10]}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default GeofenceManagement;