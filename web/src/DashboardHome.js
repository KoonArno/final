// File: web/src/DashboardHome.js
// (แก้ไขใหม่ทั้งหมด: แสดง Subject Cards)

import React, { useState, useEffect } from 'react';
import { api } from './auth';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActionArea, 
  CircularProgress, 
  Alert,
  Avatar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ClassIcon from '@mui/icons-material/Class';
import PeopleIcon from '@mui/icons-material/People';

export default function DashboardHome() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/admin/subjects') // ⭐️ เรียก API ที่เราแก้ไข (มี _count.users)
      .then(response => {
        // กรองเอาเฉพาะวิชาที่ Active
        setSubjects(response.data.filter(s => s.is_active));
      })
      .catch(err => {
        setError('Failed to load subjects: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleCardClick = (subjectId) => {
    // ⭐️ นำทางไปยังหน้ารายชื่อ User ของวิชานั้นๆ
    navigate(`/subjects/${subjectId}/users`);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Subject Dashboard
      </Typography>

      <Grid container spacing={3}>
        {subjects.length === 0 && (
          <Grid item xs={12}>
            <Typography sx={{ p: 3, textAlign: 'center' }}>
              No active subjects found. Go to 'Subject Management' to add one.
            </Typography>
          </Grid>
        )}

        {subjects.map((subject) => (
          <Grid item xs={12} sm={6} md={4} key={subject.subject_id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardActionArea 
                onClick={() => handleCardClick(subject.subject_id)}
                sx={{ flexGrow: 1 }}
              >
                <CardContent>
                  <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>
                    <ClassIcon />
                  </Avatar>
                  <Typography variant="h6" component="div" gutterBottom noWrap>
                    {subject.name}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    {subject.code}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, color: 'text.secondary' }}>
                    <PeopleIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                    <Typography variant="body2">
                      {subject._count.users} Enrolled User(s)
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}