// File: api/server.js
// (เวอร์ชันเต็ม อัปเดต 3 endpoints)

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key-change-this-in-prod';

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// --- Middleware: Authenticate Admin Token ---
const authenticateAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err || !payload || payload.type !== 'admin') {
      console.log('Admin Auth Failed:', err || 'Invalid token type');
      return res.sendStatus(403);
    }
    req.admin = payload;
    next();
  });
};

// --- Middleware: Authenticate User Token ---
const authenticateUserToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err || !payload || payload.type !== 'user') {
      console.log('User Auth Failed:', err || 'Invalid token type');
      return res.sendStatus(403);
    }
    req.user = payload;
    next();
  });
};

// --- 1. Admin Auth Endpoints ---
app.post('/admin/register', async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const { email, password, fullName } = req.body;
    if (!email || !password) { return res.status(400).json({ error: 'Email and password are required' }); }
    if (password.length < 6) { return res.status(400).json({ error: 'Password must be at least 6 characters long'}); }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await prisma.admins.create({ data: { email: email.toLowerCase(), password_hash: hashedPassword, full_name: fullName, } });
        res.status(201).json({ message: 'Admin created', admin_id: admin.admin_id });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { return res.status(409).json({ error: 'Email already exists' }); }
        console.error("Admin registration error:", e);
        res.status(500).json({ error: 'Failed to create admin' });
    }
});
app.post('/admin/login', async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const { email, password } = req.body;
    if (!email || !password) { return res.status(400).json({ error: 'Email and password are required' }); }
    try {
        const admin = await prisma.admins.findUnique({ where: { email: email.toLowerCase() } });
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) { return res.status(401).json({ error: 'Invalid credentials' }); }
        const token = jwt.sign({ admin_id: admin.admin_id, email: admin.email, type: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Admin login successful', token });
    } catch (e) {
        console.error("Admin login error:", e);
        res.status(500).json({ error: 'Login failed' });
    }
});


// --- 2. User (Employee/Student) CRUD (Admin Protected) ---
app.get('/users', authenticateAdminToken, async (req, res) => {
    // ⭐️ [แก้ไข] ให้ include วิชาที่ user ลงทะเบียนไว้ด้วย
    try {
      const users = await prisma.users.findMany({
        orderBy: { created_at: 'desc' },
        select: { 
          user_id: true, 
          username: true, 
          full_name: true, 
          face_embedding: true, 
          is_active: true, 
          created_at: true, 
          created_by_admin_id: true,
          subjects: { // ⭐️⭐️ เพิ่ม
            select: {
              subject_id: true,
              code: true,
              name: true
            }
          }
        }
      });
      
      const usersWithFaceStatus = users.map(u => ({
        ...u, 
        face_registered: !!u.face_embedding
      }));
      res.json(usersWithFaceStatus);
      
  } catch (e) {
      console.error("Fetch users error:", e);
      res.status(500).json({ error: 'Failed to fetch users' });
  }
});
app.post('/users', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) { return res.status(400).json({ error: 'Username, password, and full name are required' }); }
    if (password.length < 6) { return res.status(400).json({ error: 'Password must be at least 6 characters long'}); }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.users.create({
          data: { username: username, full_name: fullName, password_hash: hashedPassword, created_by_admin_id: req.admin.admin_id },
          select: { user_id: true, username: true, full_name: true, is_active: true, created_at: true }
        });
        res.status(201).json(user);
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { res.status(409).json({ error: 'Username already exists' }); }
        else { console.error("Create user error:", e); res.status(500).json({ error: 'Failed to create user' }); }
    }
});
app.put('/users/:id', authenticateAdminToken, async (req, res) => {
    // ⭐️ [แก้ไข] ให้รับ subjectIds array เพื่ออัปเดต m-n
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    
    // ⭐️ รับ subjectIds จาก body
    const { username, fullName, isActive, password, subjectIds } = req.body;
    
    if (username === undefined && fullName === undefined && isActive === undefined && password === undefined && subjectIds === undefined) {
       return res.status(400).json({ error: 'No fields provided for update' });
    }
    
    try {
      const current = await prisma.users.findUnique({ where: { user_id: userId } });
      if (!current) return res.status(404).json({ error: 'User not found' });
      
      if (username && username !== current.username) {
        const dup = await prisma.users.findUnique({ where: { username } });
        if (dup) return res.status(409).json({ error: 'Username already exists' });
      }
      
      const data = {};
      if (username !== undefined) data.username = username;
      if (fullName !== undefined) data.full_name = fullName;
      if (isActive !== undefined) data.is_active = Boolean(isActive);
      if (password) {
        if (password.length < 6) { return res.status(400).json({ error: 'Password must be at least 6 characters long' }); }
        data.password_hash = await bcrypt.hash(password, 10);
      }
      
      // ⭐️⭐️ [เพิ่ม] Logic การอัปเดตวิชา
      if (subjectIds && Array.isArray(subjectIds)) {
        data.subjects = {
          // 'set' จะลบของเก่าทั้งหมด แล้วเชื่อมกับ id ใหม่ใน array
          set: subjectIds.map(id => ({ subject_id: parseInt(id) }))
        };
      }
      // ⭐️⭐️ สิ้นสุดส่วนที่เพิ่ม
      
      const updated = await prisma.users.update({
        where: { user_id: userId }, 
        data,
        // ⭐️ [แก้ไข] ให้ include subjects ที่อัปเดตแล้วกลับไปด้วย
        include: {
           subjects: {
             select: { subject_id: true, code: true, name: true }
           }
        }
      });
      
      updated.face_registered = !!updated.face_embedding;
      delete updated.password_hash; // ลบ hash ออกก่อนส่งกลับ
      res.json(updated);
      
    } catch (e) {
      console.error("Update user error:", e);
      res.status(500).json({ error: 'Failed to update user' });
    }
});
app.delete('/users/:id', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) { return res.status(400).json({ error: 'Invalid user ID' }); }
    try {
      const user = await prisma.users.findUnique({ where: { user_id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      await prisma.users.delete({ where: { user_id: userId } });
      res.status(204).send();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        console.warn(`Attempted to delete user ${userId} with related attendance logs.`);
        return res.status(409).json({ error: 'Cannot delete user, related attendance records exist.' });
      }
      console.error("Delete user error:", e);
      res.status(500).json({ error: 'Failed to delete user' });
    }
});


// --- 3. Geofence CRUD (Admin Protected) ---
app.get('/geofences', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    try { const geofences = await prisma.geofences.findMany({ orderBy: { created_at: 'desc' } }); res.json(geofences); }
    catch (e) { console.error("Fetch geofences error:", e); res.status(500).json({ error: 'Failed to fetch geofences' }); }
});
app.post('/geofences', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const { name, latitude, longitude, radius, description, isActive } = req.body;
    if (!name || latitude === undefined || longitude === undefined || radius === undefined) { return res.status(400).json({ error: 'Name, latitude, longitude, and radius are required'}); }
    const lat = parseFloat(latitude); const lng = parseFloat(longitude); const rad = parseFloat(radius);
    if (isNaN(lat) || isNaN(lng) || isNaN(rad) || rad <= 0) { return res.status(400).json({ error: 'Invalid coordinates or radius (must be > 0)'}); }
    try {
        const geofence = await prisma.geofences.create({ data: { name: name, description: description || null, center_latitude: lat, center_longitude: lng, radius_meters: rad, created_by_admin_id: req.admin.admin_id, is_active: typeof isActive === 'boolean' ? isActive : true, } });
        res.status(201).json(geofence);
    } catch (e) { console.error("Create geofence error:", e); res.status(500).json({ error: 'Failed to create geofence' }); }
});
app.put('/geofences/:id', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const geofenceId = parseInt(req.params.id);
    if (isNaN(geofenceId)) { return res.status(400).json({ error: 'Invalid geofence ID' }); }
    const { name, latitude, longitude, radius, description, isActive } = req.body;
    if (name === undefined && latitude === undefined && longitude === undefined && radius === undefined && description === undefined && isActive === undefined) { return res.status(400).json({ error: 'No fields provided for update' }); }
    const lat = latitude !== undefined ? parseFloat(latitude) : undefined;
    const lng = longitude !== undefined ? parseFloat(longitude) : undefined;
    const rad = radius !== undefined ? parseFloat(radius) : undefined;
    if ((latitude !== undefined && isNaN(lat)) || (longitude !== undefined && isNaN(lng)) || (radius !== undefined && (isNaN(rad) || rad <= 0))) { return res.status(400).json({ error: 'Invalid coordinates or radius (must be > 0)' }); }
    try {
        const data = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (lat !== undefined) data.center_latitude = lat;
        if (lng !== undefined) data.center_longitude = lng;
        if (rad !== undefined) data.radius_meters = rad;
        if (isActive !== undefined) data.is_active = Boolean(isActive);
        const updated = await prisma.geofences.update({ where: { geofence_id: geofenceId }, data, });
        res.json(updated);
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') { return res.status(404).json({ error: 'Geofence not found' }); }
        console.error("Update geofence error:", e);
        res.status(500).json({ error: 'Failed to update geofence' });
    }
});
app.delete('/geofences/:id', authenticateAdminToken, async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    const geofenceId = parseInt(req.params.id);
    if (isNaN(geofenceId)) { return res.status(400).json({ error: 'Invalid geofence ID' }); }
    try {
        const geofence = await prisma.geofences.findUnique({ where: { geofence_id: geofenceId } });
        if (!geofence) return res.status(404).json({ error: 'Geofence not found' });
        await prisma.geofences.delete({ where: { geofence_id: geofenceId } });
        res.status(204).send();
    } catch (e) { console.error("Delete geofence error:", e); res.status(500).json({ error: 'Failed to delete geofence' }); }
});


// --- ⭐️ 4. Subject CRUD (Admin Protected) - (เพิ่มใหม่) ⭐️ ---

app.get('/admin/subjects', authenticateAdminToken, async (req, res) => {
    try {
        const subjects = await prisma.subjects.findMany({ orderBy: { name: 'asc' } });
        res.json(subjects);
    } catch (e) {
        console.error("Fetch subjects error:", e);
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

app.post('/admin/subjects', authenticateAdminToken, async (req, res) => {
    const { code, name, description, isActive } = req.body;
    if (!code || !name) { return res.status(400).json({ error: 'Subject code and name are required' }); }
    try {
        const subject = await prisma.subjects.create({
            data: {
                code: code,
                name: name,
                description: description || null,
                is_active: typeof isActive === 'boolean' ? isActive : true,
            }
        });
        res.status(201).json(subject);
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return res.status(409).json({ error: 'Subject code already exists' });
        }
        console.error("Create subject error:", e);
        res.status(500).json({ error: 'Failed to create subject' });
    }
});

app.put('/admin/subjects/:id', authenticateAdminToken, async (req, res) => {
    const subjectId = parseInt(req.params.id);
    if (isNaN(subjectId)) { return res.status(400).json({ error: 'Invalid subject ID' }); }

    const { code, name, description, isActive } = req.body;
    if (code === undefined && name === undefined && description === undefined && isActive === undefined) {
        return res.status(400).json({ error: 'No fields provided for update' });
    }

    try {
        const data = {};
        if (code !== undefined) data.code = code;
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (isActive !== undefined) data.is_active = Boolean(isActive);

        // ตรวจสอบว่า Code ซ้ำกับคนอื่นหรือไม่
        if (code) {
             const existing = await prisma.subjects.findUnique({ where: { code } });
             if (existing && existing.subject_id !== subjectId) {
                 return res.status(409).json({ error: 'Subject code already exists' });
             }
        }

        const updated = await prisma.subjects.update({
            where: { subject_id: subjectId },
            data: data,
        });
        res.json(updated);
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
            return res.status(404).json({ error: 'Subject not found' });
        } else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
             return res.status(409).json({ error: 'Subject code already exists' });
        }
        console.error("Update subject error:", e);
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

app.delete('/admin/subjects/:id', authenticateAdminToken, async (req, res) => {
    const subjectId = parseInt(req.params.id);
    if (isNaN(subjectId)) { return res.status(400).json({ error: 'Invalid subject ID' }); }
    try {
        await prisma.subjects.delete({ where: { subject_id: subjectId } });
        res.status(204).send();
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
            // (Foreign key constraint fail - P2003)
            return res.status(409).json({ error: 'Cannot delete subject, it is linked to attendance logs.' });
        }
        console.error("Delete subject error:", e);
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});


// --- ⭐️ 5. Attendance Log Endpoint (Admin Protected) - (เพิ่มใหม่) ⭐️ ---

app.get('/admin/attendance-logs', authenticateAdminToken, async (req, res) => {
    try {
        const logs = await prisma.attendance_logs.findMany({
            orderBy: { check_in_time: 'desc' },
            include: {
                users: { // ⭐️ Join ตาราง users
                    select: { 
                        full_name: true,
                        username: true
                    }
                },
                subjects: { // ⭐️ Join ตาราง subjects
                    select: {
                        name: true,
                        code: true
                    }
                }
            }
        });
        res.json(logs);
    } catch (e) {
        console.error("Fetch attendance logs error:", e);
        res.status(500).json({ error: 'Failed to fetch attendance logs' });
    }
});


// --- 6. MOBILE APP ENDPOINTS --- (ย้ายลำดับ)

// GET /check-geofence (สำหรับ Mobile App ตรวจสอบตำแหน่ง)
app.get('/check-geofence', authenticateUserToken, async (req, res) => {
  // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
  const userId = req.user.user_id;
  const { latitude, longitude } = req.query;
  console.log(`API: Received geofence check from user ${userId} at (${latitude}, ${longitude})`);
  if (latitude === undefined || longitude === undefined) { return res.status(400).json({ error: 'Missing latitude or longitude query parameters' }); }
  const userLat = parseFloat(latitude);
  const userLng = parseFloat(longitude);
  if (isNaN(userLat) || isNaN(userLng)) { return res.status(400).json({ error: 'Invalid latitude or longitude format' }); }
  try {
    const activeGeofences = await prisma.geofences.findMany({ where: { is_active: true } });
    let isInGeofence = false;
    let distanceToCenter = Infinity;
    console.log(`API: Checking against ${activeGeofences.length} active geofences for user ${userId}.`);
    for (const zone of activeGeofences) {
        if (zone.center_latitude == null || zone.center_longitude == null || isNaN(zone.center_latitude) || isNaN(zone.center_longitude)) {
            console.warn(`API: Skipping geofence ID ${zone.geofence_id} (${zone.name}) due to invalid coordinates.`);
            continue;
        }
        const distance = haversineDistance(userLat, userLng, zone.center_latitude, zone.center_longitude);
        distanceToCenter = Math.min(distanceToCenter, distance);
        if (distance <= zone.radius_meters) {
            isInGeofence = true;
            break;
        }
    }
    const closestDistStr = isFinite(distanceToCenter) ? `${distanceToCenter.toFixed(1)}m` : 'N/A';
    console.log(`API: Geofence check result for user ${userId}: isInGeofence=${isInGeofence}, ClosestDistance=${closestDistStr}`);
    res.json({ isInGeofence: isInGeofence });
  } catch (e) {
    console.error(`API Error during geofence check for user ${userId}:`, e);
    res.status(500).json({ error: 'Failed to check geofence status' });
  }
});

// GET /courses (สำหรับ Mobile App ดึงรายวิชา)
app.get('/courses', authenticateUserToken, async (req, res) => {
  // ⭐️ [แก้ไข] เปลี่ยนจากการดึงวิชาทั้งหมด เป็นการดึงเฉพาะวิชาของ user
  
  const userId = req.user.user_id;
  console.log(`API: User ${userId} fetching THEIR courses.`);
  
  try {
    const userWithSubjects = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { 
        subjects: { // ⭐️ ดึงเฉพาะวิชาที่ user คนนี้ลงทะเบียน
          where: { is_active: true }, // ⭐️ และต้องเป็นวิชาที่ active
          orderBy: { name: 'asc' }
        } 
      }
    });

    if (!userWithSubjects) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(userWithSubjects.subjects); // ⭐️ ส่งกลับไปแค่ array ของวิชา
    
  } catch (e) {
    console.error(`API Error during /courses for user ${userId}:`, e);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});


// POST /login (สำหรับ User)
app.post('/login', async (req, res) => {
  // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const user = await prisma.users.findUnique({ where: { username } });
    if (!user) {
      console.log(`Login attempt failed: User not found - ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log(`Login attempt failed: Incorrect password - ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      console.log(`Login attempt failed: User inactive - ${username}`);
      return res.status(403).json({ error: 'User account is disabled' });
    }
    const isFaceRegistered = user.face_embedding != null && user.face_embedding.length > 2;
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, type: 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log(`User login successful: ${username}`);
    res.json({
      message: 'Login successful',
      token,
      user: {
        fullName: user.full_name,
        isFaceRegistered: isFaceRegistered
      }
    });
  } catch (e) {
    console.error(`Login error for ${username}:`, e);
    res.status(500).json({ error: 'Login failed due to server error' });
  }
});

// POST /register-my-face (User Face Registration via Mobile)
app.post('/register-my-face', authenticateUserToken, upload.single('image'), async (req, res) => {
  // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
  const userId = req.user.user_id;
  console.log(`API: Received face registration from user ${userId} (${req.user.username})`);
  const AI_REGISTER_URL = process.env.AI_API_URL + '/register-face';
  if (!req.file) { return res.status(400).json({ error: 'No image file uploaded' }); }
  try {
    const existingUser = await prisma.users.findUnique({ where: { user_id: userId }, select: { face_embedding: true } });
    if (!existingUser) { return res.status(404).json({ error: 'User not found' }); }
    if (existingUser.face_embedding && existingUser.face_embedding.length > 2) {
      console.log(`API: User ${userId} attempted to re-register face.`);
      return res.status(409).json({ error: 'Face already registered' });
    }
    const form = new FormData();
    form.append('image', req.file.buffer, {
      filename: `user_${userId}_register.jpg`,
      contentType: req.file.mimetype
    });
    console.log(`API: Sending face registration to AI for user ${userId}...`);
    const aiResponse = await axios.post(AI_REGISTER_URL, form, {
      headers: form.getHeaders(),
      timeout: 30000 
    });
    const { embedding } = aiResponse.data;
    if (!embedding || !Array.isArray(embedding)) {
      console.error(`API: AI service returned invalid embedding for user ${userId}`);
      return res.status(500).json({ error: "AI service returned invalid data" });
    }
    const embeddingString = JSON.stringify(embedding);
    await prisma.users.update({
      where: { user_id: userId },
      data: { face_embedding: embeddingString },
    });
    console.log(`API: Face registered successfully for user ${userId}`);
    res.json({ message: 'Face registered successfully' });
  } catch (e) {
    if (e.response && e.response.data && e.response.data.error) {
      console.error(`API: AI Error during face registration for user ${userId}: ${e.response.data.error}`);
      return res.status(400).json({ error: `AI Error: ${e.response.data.error}`});
    }
    if (axios.isAxiosError(e) && e.code === 'ECONNABORTED') {
      console.error(`API: AI call timed out for user ${userId} during registration`);
      return res.status(504).json({ error: 'AI service timed out. Please try again.' });
    }
    console.error(`API Error in /register-my-face for user ${userId}:`, e);
    res.status(500).json({ error: 'Failed to register face due to server error' });
  }
});


// POST /check-in (Main Mobile Endpoint - อัปเดตแล้ว)
app.post('/check-in', authenticateUserToken, upload.single('image'), async (req, res) => {
    // (โค้ดที่อัปเดตจากคำตอบก่อนหน้า)
    const userId = req.user.user_id;
    
    // --- ⭐️ รับ subject_id ที่เพิ่มเข้ามา ⭐️ ---
    const { latitude, longitude, subject_id } = req.body;
    console.log(`API: Received check-in attempt from user ${userId} for subject ${subject_id}`);

    if (!req.file || latitude === undefined || longitude === undefined || subject_id === undefined) { 
        return res.status(400).json({ error: 'Missing image, latitude, longitude, or subject_id' }); 
    }
    
    const userLat = parseFloat(latitude); 
    const userLng = parseFloat(longitude);
    const parsedSubjectId = parseInt(subject_id); 

    if (isNaN(userLat) || isNaN(userLng) || isNaN(parsedSubjectId)) { 
        return res.status(400).json({ error: 'Invalid latitude, longitude, or subject_id format' }); 
    }

    try {
        // ----- ⭐️ ขั้นตอนที่ 1: ตรวจสอบ Geofence (ก่อน) ⭐️ -----
        const activeGeofences = await prisma.geofences.findMany({ where: { is_active: true } });
        let isInGeofence = false;
        let distanceToCenter = Infinity;
        console.log(`API: Checking against ${activeGeofences.length} active geofences.`);
        
        for (const zone of activeGeofences) {
            if (zone.center_latitude == null || zone.center_longitude == null || isNaN(zone.center_latitude) || isNaN(zone.center_longitude)) {
                console.warn(`API: Skipping geofence ID ${zone.geofence_id} (${zone.name}) due to invalid coordinates.`);
                continue;
            }
            const distance = haversineDistance(userLat, userLng, zone.center_latitude, zone.center_longitude);
            distanceToCenter = Math.min(distanceToCenter, distance);
            if (distance <= zone.radius_meters) {
                isInGeofence = true;
                console.log(`API: User ${userId} is INSIDE zone ${zone.geofence_id}`);
                break;
            }
        }
        
        if (!isInGeofence) {
            const closestDistStr = isFinite(distanceToCenter) ? `${distanceToCenter.toFixed(1)}m` : 'N/A';
            console.log(`API: User ${userId} check-in failed (Out of Geofence). Closest: ${closestDistStr}`);
            return res.status(403).json({ error: 'Check-in failed: You are not within an authorized area.' });
        }

        // ----- ⭐️ ขั้นตอนที่ 2: ตรวจสอบใบหน้า (ส่งรูปใน Memory) ⭐️ -----
        const user = await prisma.users.findUnique({ where: { user_id: userId }, select: { face_embedding: true } });
        if (!user) { return res.status(404).json({ error: 'User not found during check-in.' }); }
        if (!user.face_embedding || user.face_embedding.length < 2) {
            console.log(`API: User ${userId} check-in failed (Face not registered).`);
             return res.status(400).json({ error: 'Face not registered. Please complete face scan setup.' });
        }
        
        const AI_VERIFY_URL = process.env.AI_API_URL + '/verify-face';
        const form = new FormData();
        form.append('image', req.file.buffer, { 
            filename: req.file.originalname || 'checkin.jpg',
            contentType: req.file.mimetype
        });
        form.append('embedding', user.face_embedding);
        
        console.log(`API: Sending face verification to AI for user ${userId}...`);
        const aiResponse = await axios.post(AI_VERIFY_URL, form, { headers: form.getHeaders(), timeout: 30000 });
        
        const { match, distance } = aiResponse.data;

        if (!match) {
            console.log(`API: User ${userId} check-in failed (Face mismatch). Distance: ${distance?.toFixed(4) ?? 'N/A'}`);
            return res.status(403).json({ error: 'Check-in failed: Face does not match.' });
        }

        // ----- ⭐️ ขั้นตอนที่ 3: บันทึกรูปภาพ (เมื่อผ่านทุกอย่าง) ⭐️ -----
        console.log("API: Saving check-in image (SUCCESS)...");
        const timestamp = Date.now();
        const filename = `user_${userId}_checkin_${timestamp}${path.extname(req.file.originalname || '.jpg')}`;
        const savedImagePath = path.join(__dirname, 'uploads', filename);
        let imageUrl = `/uploads/${filename}`; // ⭐️ ใช้ let
        
        const uploadDir = path.join(__dirname, 'uploads');
        try {
            if (!fs.existsSync(uploadDir)){ fs.mkdirSync(uploadDir, { recursive: true }); }
            fs.writeFileSync(savedImagePath, req.file.buffer);
            console.log(`API: Check-in image saved to ${savedImagePath}`);
        } catch (writeError) {
            console.error(`API: CRITICAL - Error writing check-in file for user ${userId}:`, writeError);
            imageUrl = null; // ถ้าเซฟรูปไม่สำเร็จ ให้ Log เป็น null
        }

        // ----- ⭐️ ขั้นตอนที่ 4: บันทึก Log สำเร็จ ⭐️ -----
        await prisma.attendance_logs.create({
            data: {
                user_id: userId,
                subject_id: parsedSubjectId, // ⭐️ บันทึก subject_id
                latitude: userLat,
                longitude: userLng,
                is_in_geofence: true,
                face_match_distance: distance,
                image_url: imageUrl
            }
        });
        
        console.log(`API: User ${userId} check-in SUCCESS. Distance: ${distance?.toFixed(4) ?? 'N/A'}`);
        res.json({ message: 'Check-in successful!', distance: distance });

    } catch (e) {
        console.error(`API Error in /check-in process for user ${userId}:`, e);
        if (e.response?.data?.error) { return res.status(400).json({ error: `AI Error: ${e.response.data.error}`}); }
        if (axios.isAxiosError(e) && e.code === 'ECONNABORTED') { return res.status(504).json({ error: 'AI service timed out.' }); }
        res.status(500).json({ error: 'Check-in process failed due to server error.' });
    }
});


// --- 7. Test Endpoint --- (ย้ายลำดับ)
app.get('/test-db', async (req, res) => {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    try { const adminCount = await prisma.admins.count(); const userCount = await prisma.users.count(); res.json({ status: 'OK', message: `DB Connection OK. Found ${adminCount} admin(s), ${userCount} user(s).`, }); }
    catch (err) { console.error("DB Test Error:", err); res.status(500).json({ error: 'DB connection test failed', details: err.message }); }
});

// --- 8. Helper Function --- (ย้ายลำดับ)
function haversineDistance(lat1, lon1, lat2, lon2) {
    // (โค้ดเดิม... ไม่เปลี่ยนแปลง)
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371000; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180; lat1 = lat1 * Math.PI / 180; lat2 = lat2 * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}

// --- Start Server & Graceful Shutdown ---
const server = app.listen(PORT, '0.0.0.0', () => { console.log(`☁️ API Server running on http://0.0.0.0:${PORT}`); });
const shutdown = async (signal) => { console.log(`${signal} received: closing server...`); server.close(async () => { await prisma.$disconnect(); console.log('Server closed.'); process.exit(0); }); };
process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGINT', () => shutdown('SIGINT'));