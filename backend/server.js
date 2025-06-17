const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key-12345', // Stronger secret
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true in production with HTTPS
}));

// SQLite DB setup
const db = new sqlite3.Database('./hospital.db', (err) => {
  if (err) return console.error('DB connection error:', err.message);
  console.log('Connected to SQLite database');
});

// Create tables if not exist
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Doctors table
  db.run(`CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    specialization TEXT NOT NULL,
    qualification TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  // Appointments table
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    datetime DATETIME NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('scheduled', 'completed', 'cancelled')),
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
  )`);
  // Medical reports table
  db.run(`CREATE TABLE IF NOT EXISTS medical_reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    report_date DATE NOT NULL,
    file_path TEXT NOT NULL,
    doctor_id TEXT,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
  )`);
  // Prescriptions table
  db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    medication TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled')),
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
  )`);
  // Bills table
  db.run(`CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date_issued DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue')),
    description TEXT,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Activity log table
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_date DATETIME NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  // Staff table
  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dept TEXT,
    role TEXT,
    date TEXT
  )`);
  // Doctor schedule table
  db.run(`CREATE TABLE IF NOT EXISTS schedule (
    id TEXT PRIMARY KEY,
    doctor TEXT NOT NULL,
    department TEXT NOT NULL,
    schedule_time TEXT NOT NULL
  )`);
    // OT schedule table
  db.run(`CREATE TABLE IF NOT EXISTS ot_schedule (
    id TEXT PRIMARY KEY,
    ot_name TEXT NOT NULL,
    department TEXT NOT NULL,
    schedule_time TEXT NOT NULL
  )`);
  // Operation chart table
  db.run(`CREATE TABLE IF NOT EXISTS operation_chart (
    id TEXT PRIMARY KEY,
    patient TEXT NOT NULL,
    doctor TEXT NOT NULL,
    operation TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
  // Staff status table
  db.run(`CREATE TABLE IF NOT EXISTS staff_status (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL,
    extra TEXT
  )`);
  // Leave requests table
  db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL
  )`);
});

// Middleware to protect admin routes
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  console.error('Unauthorized access attempt to protected route');
  res.status(403).json({ error: 'Access denied. Admins only.' });
}
app.use(express.json());

// Helper function to promisify db operations
function dbGet(query, params) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function dbAll(query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
//API Endpoints
// Get complete patient dashboard data
app.get('/api/patient/dashboard/:id', async (req, res) => {
  try {
    const patientId = req.params.id;
    
    // Verify patient exists
    const patient = await dbGet('SELECT * FROM users WHERE id = ? AND role = "patient"', [patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Fetch all dashboard data in parallel
    const [
      nextAppointment,
      recentReports,
      activePrescriptions,
      pendingBills,
      recentActivity
    ] = await Promise.all([
      getNextAppointment(patientId),
      getRecentReports(patientId),
      getActivePrescriptions(patientId),
      getPendingBills(patientId),
      getRecentActivity(patientId)
    ]);

    res.json({
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone
      },
      nextAppointment,
      recentReports,
      activePrescriptions,
      pendingBills,
      recentActivity
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Helper functions for dashboard data
async function getNextAppointment(patientId) {
  const appointment = await dbGet(
    `SELECT a.id, a.datetime, a.status, a.notes, 
     d.specialization, u.name as doctor_name
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     JOIN users u ON d.user_id = u.id
     WHERE a.patient_id = ? AND a.datetime > datetime('now') 
     AND a.status = 'scheduled'
     ORDER BY a.datetime ASC LIMIT 1`,
    [patientId]
  );
  
  return appointment ? {
    id: appointment.id,
    date: new Date(appointment.datetime).toLocaleString(),
    doctor: appointment.doctor_name,
    specialization: appointment.specialization,
    status: appointment.status,
    notes: appointment.notes
  } : null;
}

async function getRecentReports(patientId) {
  const reports = await dbAll(
    `SELECT r.id, r.report_type, r.report_date, r.file_path, 
     u.name as doctor_name
     FROM medical_reports r
     LEFT JOIN doctors d ON r.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     WHERE r.patient_id = ?
     ORDER BY r.report_date DESC LIMIT 3`,
    [patientId]
  );
  
  return reports.map(report => ({
    id: report.id,
    type: report.report_type,
    date: report.report_date,
    doctor: report.doctor_name,
    filePath: report.file_path
  }));
}

async function getActivePrescriptions(patientId) {
  const prescriptions = await dbAll(
    `SELECT p.id, p.medication, p.dosage, p.frequency, 
     p.start_date, p.end_date, p.status,
     u.name as doctor_name
     FROM prescriptions p
     JOIN doctors d ON p.doctor_id = d.id
     JOIN users u ON d.user_id = u.id
     WHERE p.patient_id = ? AND p.status = 'active'
     ORDER BY p.start_date DESC`,
    [patientId]
  );
  
  return prescriptions.map(p => ({
    id: p.id,
    medication: p.medication,
    dosage: p.dosage,
    frequency: p.frequency,
    startDate: p.start_date,
    endDate: p.end_date,
    doctor: p.doctor_name,
    status: p.status
  }));
}

async function getPendingBills(patientId) {
  const bills = await dbAll(
    `SELECT id, amount, date_issued, due_date, status, description
     FROM bills
     WHERE patient_id = ? AND status = 'pending'
     ORDER BY due_date ASC`,
    [patientId]
  );
  
  return bills.map(bill => ({
    id: bill.id,
    amount: bill.amount,
    issuedDate: bill.date_issued,
    dueDate: bill.due_date,
    status: bill.status,
    description: bill.description
  }));
}

async function getRecentActivity(patientId) {
  const activities = await dbAll(
    `SELECT id, activity_type, activity_date, description
     FROM activity_log
     WHERE user_id = ?
     ORDER BY activity_date DESC LIMIT 5`,
    [patientId]
  );
  
  return activities.map(activity => ({
    id: activity.id,
    type: activity.activity_type,
    date: activity.activity_date,
    description: activity.description
  }));
}

// --- Admin Login ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Admin login:', { username });
  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ? AND role = 'admin'`,
    [username, password],
    (err, row) => {
      if (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        console.error('Invalid admin credentials');
        return res.status(401).json({ error: 'Invalid credentials or not an admin' });
      }
      req.session.user = { id: row.id, username: row.username, role: row.role };
      console.log('Admin logged in:', { id: row.id, username: row.username });
      res.json({ message: 'Admin login successful', user: { id: row.id, username: row.username, role: row.role } });
    }
  );
});

// --- User Registration ---
app.post('/api/users/register', (req, res) => {
  const { name, username, email, phone, password, role = 'patient' } = req.body; // Changed 'name' to 'name' to match DB schema and added default role
  console.log('Register request:', { name, username, email, phone, role, password: '***' });

  // Detailed validation
  const missingFields = [];
  if (!name) missingFields.push('name'); // Use name here
  if (!username) missingFields.push('username');
  if (!email) missingFields.push('email');
  if (!password) missingFields.push('password');
  // Role can have a default, so it might not always be required in the request body if the default is acceptable.
  // If role is strictly required from input:
  // if (!role) missingFields.push('role'); 

  if (missingFields.length > 0) {
    console.error('Missing fields:', missingFields.join(', '));
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
  }

  // Basic email format validation (optional, but good practice)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format!" });
  }

  // Password strength validation (optional, but good practice)
  // Example: minimum 8 characters, at least one letter, one number, one special character
  if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
    return res.status(400).json({ 
      error: "Password must be at least 8 characters, contain a letter, a number, and a special character." 
    });
  }

  db.get(
    `SELECT id FROM users WHERE username = ? OR email = ?`,
    [username, email],
    async (err, row) => { // <-- Made this an async function because bcrypt.hash is async
      if (err) {
        console.error('Duplicate check error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (row) {
        console.error('Duplicate found:', { username, email });
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      try {
        // HASH THE PASSWORD BEFORE STORING IT!
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is a good salt rounds value

        const id = require('crypto').randomUUID(); // Use UUID for better IDs than Date.now()
        db.run(
          `INSERT INTO users (id, name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)`, // Use name here
          [id, name, username, email, phone || null, hashedPassword, role], // <-- Store the HASHTED password
          function (err) {
            if (err) {
              console.error('Insert error:', err.message);
              return res.status(500).json({ error: 'Failed to register user: ' + err.message }); // More generic error for client
            }
            console.log('User registered:', { id, username });
            res.status(201).json({ 
                message: 'User registered successfully', 
                user: { id, username, email, role } // Send back non-sensitive user info
            });
          }
        );
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        res.status(500).json({ error: 'Internal server error during password hashing' });
      }
    }
  );
});
// --- Patient Login ---
app.post('/api/patient/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Patient login attempt:', { username });

  db.get(
    `SELECT * FROM users WHERE username = ? AND role = 'patient'`, // Ensure role is patient
    [username],
    (err, row) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        console.log('Unregistered user attempt:', username);
        return res.status(401).json({ 
          error: 'User not registered. Please register first.',
          unregistered: true // Flag to identify unregistered users
        });
      }

      if (!bcrypt.compareSync(password, row.password)) {
        console.log('Invalid password for:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('Successful login:', username);
      res.json({ message: 'Login successful', user: row });
    }
  );
});

// --- Get All Users ---
app.get('/api/users', (req, res) => {
  const { username } = req.query;
  if (username) {
    db.all(`SELECT * FROM users WHERE username = ?`, [username], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    db.all(`SELECT * FROM users`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

// Get all staff
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await dbAll('SELECT * FROM staff');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Create new staff member
app.post('/api/staff', async (req, res) => {
  const { name, dept, role } = req.body;
  if (!name || !dept || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const id = Date.now().toString();
    await db.run(
      'INSERT INTO staff (id, name, dept, role, date) VALUES (?, ?, ?, ?, ?)',
      [id, name, dept, role, new Date().toISOString()]
    );
    res.status(201).json({ id, name, dept, role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create staff' });
  }
});

// Update staff member
app.put('/api/staff/:id', async (req, res) => {
  const { name, dept, role } = req.body;
  const { id } = req.params;

  try {
    await db.run(
      'UPDATE staff SET name = ?, dept = ?, role = ? WHERE id = ?',
      [name, dept, role, id]
    );
    res.json({ id, name, dept, role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// Delete staff member
app.delete('/api/staff/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM staff WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});
// Get all doctor schedules
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await dbAll('SELECT * FROM schedule');
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create new doctor schedule
app.post('/api/schedules', async (req, res) => {
  const { doctor, department, schedule_time } = req.body;
  if (!doctor || !department || !schedule_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const id = Date.now().toString();
    await db.run(
      'INSERT INTO schedule (id, doctor, department, schedule_time) VALUES (?, ?, ?, ?)',
      [id, doctor, department, schedule_time]
    );
    res.status(201).json({ id, doctor, department, schedule_time });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Get schedules by department
app.get('/api/schedules/department/:dept', async (req, res) => {
  const { dept } = req.params;
  try {
    const schedules = await dbAll(
      'SELECT * FROM schedule WHERE department = ?',
      [dept]
    );
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});
// Get all OT schedules
app.get('/api/ot-schedules', async (req, res) => {
  try {
    const schedules = await dbAll('SELECT * FROM ot_schedule');
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OT schedules' });
  }
});

// Create new OT schedule
app.post('/api/ot-schedules', async (req, res) => {
  const { ot_name, department, schedule_time } = req.body;
  if (!ot_name || !department || !schedule_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const id = Date.now().toString();
    await db.run(
      'INSERT INTO ot_schedule (id, ot_name, department, schedule_time) VALUES (?, ?, ?, ?)',
      [id, ot_name, department, schedule_time]
    );
    res.status(201).json({ id, ot_name, department, schedule_time });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create OT schedule' });
  }
});

// Get OT schedules by department
app.get('/api/ot-schedules/department/:dept', async (req, res) => {
  const { dept } = req.params;
  try {
    const schedules = await dbAll(
      'SELECT * FROM ot_schedule WHERE department = ?',
      [dept]
    );
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OT schedules' });
  }
});
// Get all staff statuses
app.get('/api/staff-status', async (req, res) => {
  try {
    const statuses = await dbAll('SELECT * FROM staff_status');
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff statuses' });
  }
});

// Update staff status
app.put('/api/staff-status/:id', async (req, res) => {
  const { id } = req.params;
  const { status, extra } = req.body;

  try {
    await db.run(
      'UPDATE staff_status SET status = ?, extra = ? WHERE id = ?',
      [status, extra, id]
    );
    res.json({ id, status, extra });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update staff status' });
  }
});

// Get status by department
app.get('/api/staff-status/department/:dept', async (req, res) => {
  const { dept } = req.params;
  try {
    const statuses = await dbAll(
      'SELECT * FROM staff_status WHERE department = ?',
      [dept]
    );
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff statuses' });
  }
});
// Get all leave requests
app.get('/api/leave-requests', async (req, res) => {
  try {
    const requests = await dbAll('SELECT * FROM leave_requests');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Create new leave request
app.post('/api/leave-requests', async (req, res) => {
  const { name, reason } = req.body;
  if (!name || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const id = Date.now().toString();
    await db.run(
      'INSERT INTO leave_requests (id, name, reason, status) VALUES (?, ?, ?, ?)',
      [id, name, reason, 'pending']
    );
    res.status(201).json({ id, name, reason, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// Update leave request status
app.put('/api/leave-requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await db.run(
      'UPDATE leave_requests SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ id, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave request' });
  }
});

// Doctor Dashboard Data
app.get('/api/doctor/dashboard/:doctorId', async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    
    // Get doctor details
    const doctor = await dbGet(
      `SELECT * FROM doctors WHERE id = ?`,
      [doctorId]
    );
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    // Get all dashboard data in parallel
    const [
      todayAppointments,
      totalPatients,
      pendingReports,
      activePrescriptions,
      todaysAppointments,
      recentPatients
    ] = await Promise.all([
      getTodayAppointmentsCount(doctorId),
      getTotalPatientsCount(doctorId),
      getPendingReportsCount(doctorId),
      getActivePrescriptionsCount(doctorId),
      getTodaysAppointments(doctorId),
      getRecentPatients(doctorId)
    ]);
    
    res.json({
      todayAppointments,
      totalPatients,
      pendingReports,
      activePrescriptions,
      todaysAppointments,
      recentPatients
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Helper functions for dashboard
async function getTodayAppointmentsCount(doctorId) {
  const result = await dbGet(
    `SELECT COUNT(*) as count FROM appointments 
     WHERE doctor_id = ? AND date(datetime) = date('now')`,
    [doctorId]
  );
  return result.count;
}

async function getTotalPatientsCount(doctorId) {
  const result = await dbGet(
    `SELECT COUNT(DISTINCT patient_id) as count FROM appointments 
     WHERE doctor_id = ?`,
    [doctorId]
  );
  return result.count;
}

async function getPendingReportsCount(doctorId) {
  const result = await dbGet(
    `SELECT COUNT(*) as count FROM medical_reports 
     WHERE doctor_id = ? AND status = 'pending'`,
    [doctorId]
  );
  return result.count;
}

async function getActivePrescriptionsCount(doctorId) {
  const result = await dbGet(
    `SELECT COUNT(*) as count FROM prescriptions 
     WHERE doctor_id = ? AND status = 'active'`,
    [doctorId]
  );
  return result.count;
}

async function getTodaysAppointments(doctorId) {
  const appointments = await dbAll(
    `SELECT a.id, strftime('%H:%M', a.datetime) as time, 
     u.name as patientName, a.reason, a.status
     FROM appointments a
     JOIN users u ON a.patient_id = u.id
     WHERE a.doctor_id = ? AND date(a.datetime) = date('now')
     ORDER BY a.datetime`,
    [doctorId]
  );
  return appointments;
}

async function getRecentPatients(doctorId) {
  const patients = await dbAll(
    `SELECT DISTINCT u.id, u.name, u.avatar, 
     p.condition, p.status, MAX(a.datetime) as lastVisit
     FROM appointments a
     JOIN users u ON a.patient_id = u.id
     JOIN patient_profiles p ON u.id = p.user_id
     WHERE a.doctor_id = ?
     GROUP BY u.id
     ORDER BY lastVisit DESC
     LIMIT 5`,
    [doctorId]
  );
  return patients;
}

// Doctor Patients
app.get('/api/doctor/patients/:doctorId', async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    
    const patients = await dbAll(
      `SELECT u.id, u.name, p.age, p.condition, 
       p.status, MAX(a.datetime) as lastVisit
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN patient_profiles p ON u.id = p.user_id
       WHERE a.doctor_id = ?
       GROUP BY u.id
       ORDER BY lastVisit DESC`,
      [doctorId]
    );
    
    res.json({ patients });
    
  } catch (error) {
    console.error('Patients error:', error);
    res.status(500).json({ error: 'Failed to load patients' });
  }
});

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../FS Hospital Website/frontend')));

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});