const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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
    // Users table (Unified table for all system users: Patients, Doctors, Admins)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating users table:', err.message);
    });

    // Doctor Profiles table (Stores doctor-specific attributes, linked to users table)
    db.run(`CREATE TABLE IF NOT EXISTS doctor_profiles (
        user_id TEXT PRIMARY KEY, -- This is the foreign key to users.id and also the PK
        specialty TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating doctor_profiles table:', err.message);
    });


    // Doctor Schedules table
    db.run(`CREATE TABLE IF NOT EXISTS doctor_schedules (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL, -- This is the user_id of the doctor from the users table
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(doctor_id) REFERENCES doctor_profiles(user_id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating doctor_schedules table:', err.message);
    });

    // Appointments table
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        schedule_id TEXT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(doctor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(schedule_id) REFERENCES doctor_schedules(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating appointments table:', err.message);
    });

    // Medical reports table
    db.run(`CREATE TABLE IF NOT EXISTS medical_reports (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        report_type TEXT NOT NULL,
        report_date DATE NOT NULL,
        file_path TEXT NOT NULL,
        doctor_id TEXT, -- References users.id (role: doctor) - Can be NULL if doctor account deleted
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
    )`, (err) => {
        if (err) console.error('Error creating medical_reports table:', err.message);
    });

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
        status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled', 'discontinued')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating prescriptions table:', err.message);
    });

    // Bills table
    db.run(`CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        amount REAL NOT NULL,
        date_issued DATE NOT NULL,
        due_date DATE NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue', 'partially_paid', 'refunded')),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating bills table:', err.message);
    });

    // Activity log table
    db.run(`CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating activity_log table:', err.message);
    });

    // Staff status table
    db.run(`CREATE TABLE IF NOT EXISTS staff_status (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        department TEXT NOT NULL,
        current_status TEXT NOT NULL CHECK(current_status IN ('active', 'on_leave', 'absent', 'training')),
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        extra_notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating staff_status table:', err.message);
    });

    // Leave requests table
    db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )`, (err) => {
        if (err) console.error('Error creating leave_requests table:', err.message);
    });
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
function dbRun(query, params) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

//API Endpoints
// Get complete patient dashboard data
// Get complete patient dashboard data
app.get('/api/patient/dashboard/:id', async (req, res) => {
    try {
        const patientId = req.params.id;

        // Verify patient exists and has the 'patient' role
        const patient = await dbGet('SELECT id, name, email, phone FROM users WHERE id = ? AND role = "patient"', [patientId]);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found or not a patient user' });
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
        console.error('Patient dashboard error:', error);
        res.status(500).json({ error: 'Failed to load patient dashboard data' });
    }
});

// Helper functions for patient dashboard data
async function getNextAppointment(patientId) {
    // JOIN users for doctor's name, and doctor_profiles for specialty
    const appointment = await dbGet(
        `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.notes,
                dp.specialty, u.name as doctor_name
         FROM appointments a
         JOIN users u ON a.doctor_id = u.id
         LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
         WHERE a.patient_id = ?
           AND (a.appointment_date > date('now') OR (a.appointment_date = date('now') AND a.appointment_time > strftime('%H:%M', 'now')))
           AND a.status = 'pending' -- Changed from 'scheduled' to 'pending' as per schema default
         ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 1`,
        [patientId]
    );

    return appointment ? {
        id: appointment.id,
        date: appointment.appointment_date, // Keep as date string
        time: appointment.appointment_time, // Keep as time string
        doctor: appointment.doctor_name,
        specialty: appointment.specialty,
        status: appointment.status,
        notes: appointment.notes
    } : null;
}

async function getRecentReports(patientId) {
    // JOIN users for doctor's name
    const reports = await dbAll(
        `SELECT r.id, r.report_type, r.report_date, r.file_path,
                u.name as doctor_name
         FROM medical_reports r
         LEFT JOIN users u ON r.doctor_id = u.id -- doctor_id now references users.id
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
    // JOIN users for doctor's name
    const prescriptions = await dbAll(
        `SELECT p.id, p.medication, p.dosage, p.frequency,
                p.start_date, p.end_date, p.status,
                u.name as doctor_name
         FROM prescriptions p
         JOIN users u ON p.doctor_id = u.id -- doctor_id now references users.id
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
    console.log('Admin login attempt:', { username });

    db.get(
        `SELECT id, username, password, role FROM users WHERE username = ? AND role = 'admin'`, // Select only necessary fields
        [username],
        (err, row) => {
            if (err) {
                console.error('Database error during admin login:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                console.log('Admin user not found or not an admin:', username);
                return res.status(401).json({ error: 'Invalid credentials or not an admin' });
            }

            // Compare hashed password
            bcrypt.compare(password, row.password, (compareErr, isMatch) => {
                if (compareErr) {
                    console.error('Error comparing passwords:', compareErr);
                    return res.status(500).json({ error: 'Error during authentication' });
                }
                if (!isMatch) {
                    console.log('Invalid password for admin:', username);
                    return res.status(401).json({ error: 'Invalid credentials or not an admin' });
                }
                // Assuming `req.session` is configured
                req.session.user = { id: row.id, username: row.username, role: row.role };
                console.log('Admin logged in:', { id: row.id, username: row.username });
                res.json({ message: 'Admin login successful', user: { id: row.id, username: row.username, role: row.role } });
            });
        }
    );
});

// --- User Registration ---
app.post('/api/users/register', (req, res) => {
    const { name, username, email, phone, password, role = 'patient' } = req.body; // Default role is 'patient'
    console.log('Register request:', { name, username, email, phone, role, password: '***' });

    // Validation
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!username) missingFields.push('username');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!['patient', 'doctor', 'admin'].includes(role)) missingFields.push('invalid_role'); // Validate role

    if (missingFields.length > 0) {
        console.error('Missing or invalid fields:', missingFields.join(', '));
        return res.status(400).json({ error: `Missing or invalid required fields: ${missingFields.join(', ')}` });
    }

    // Email and password validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format!" });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
        return res.status(400).json({
            error: "Password must be at least 8 characters, contain a letter, a number, and a special character."
        });
    }

    db.get(
        `SELECT id FROM users WHERE username = ? OR email = ?`,
        [username, email],
        async (err, row) => {
            if (err) {
                console.error('Duplicate check error:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                console.error('Duplicate found:', { username, email });
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const id = crypto.randomUUID(); // Use crypto.randomUUID()

                db.run(
                    `INSERT INTO users (id, name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, name, username, email, phone || null, hashedPassword, role],
                    function (err) {
                        if (err) {
                            console.error('Insert user error:', err.message);
                            return res.status(500).json({ error: 'Failed to register user: ' + err.message });
                        }
                        console.log('User registered:', { id, username, role });

                        // If the registered user is a doctor, create a doctor_profiles entry
                        if (role === 'doctor') {
                          const { specialty } = req.body;
                          db.run(
                            `INSERT INTO doctor_profiles (user_id, specialty) VALUES (?, ?)`,
                            [id, specialty || null],
                            function (profileErr) {
                              // handle error
                            }
                          );
                        } else {
                            res.status(201).json({
                                message: 'User registered successfully',
                                user: { id, name, username, email, role }
                            });
                        }
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
        `SELECT id, username, password, role FROM users WHERE username = ? AND role = 'patient'`,
        [username],
        (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                console.log('Patient user not found or not a patient:', username);
                return res.status(401).json({
                    error: 'Invalid credentials or user is not a patient. Please register first if you are a new patient.',
                    unregistered: true
                });
            }

            bcrypt.compare(password, row.password, (compareErr, isMatch) => {
                if (compareErr) {
                    console.error('Error comparing passwords:', compareErr);
                    return res.status(500).json({ error: 'Error during authentication' });
                }
                if (!isMatch) {
                    console.log('Invalid password for patient:', username);
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                req.session.user = { id: row.id, username: row.username, role: row.role }; // Assuming session handling
                console.log('Patient logged in:', { id: row.id, username: row.username });
                res.json({ message: 'Login successful', user: { id: row.id, username: row.username, role: row.role } });
            });
        }
    );
});

// --- Doctor Login --- (New endpoint for explicit doctor login, similar to patient/admin)
app.post('/api/doctor/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Doctor login attempt:', { username });

    db.get(
        `SELECT id, username, password, role FROM users WHERE username = ? AND role = 'doctor'`,
        [username],
        (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                console.log('Doctor user not found or not a doctor:', username);
                return res.status(401).json({ error: 'Invalid credentials or not a doctor' });
            }

            bcrypt.compare(password, row.password, (compareErr, isMatch) => {
                if (compareErr) {
                    console.error('Error comparing passwords:', compareErr);
                    return res.status(500).json({ error: 'Error during authentication' });
                }
                if (!isMatch) {
                    console.log('Invalid password for doctor:', username);
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                req.session.user = { id: row.id, username: row.username, role: row.role };
                console.log('Doctor logged in:', { id: row.id, username: row.username });
                res.json({ message: 'Login successful', user: { id: row.id, username: row.username, role: row.role } });
            });
        }
    );
});


// --- Get All Users --- (Still valid, fetches all users regardless of role)
app.get('/api/users', (req, res) => {
  const { role, username } = req.query;
  let query = `SELECT * FROM users`;
  let params = [];
  if (role && username) {
    query += ` WHERE role = ? AND username = ?`;
    params.push(role, username);
  } else if (role) {
    query += ` WHERE role = ?`;
    params.push(role);
  } else if (username) {
    query += ` WHERE username = ?`;
    params.push(username);
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Doctor Schedules Management ---
// Note: Changed from '/api/schedules' to '/api/doctor-schedules' for clarity and to avoid conflict
// if other types of schedules are introduced. Original schema named it 'doctor_schedules'.

// Get all doctor schedules (now includes doctor's name and specialty)
app.get('/api/doctor-schedules', async (req, res) => {
    try {
        const schedules = await dbAll(
            `SELECT ds.id, ds.day_of_week, ds.start_time, ds.end_time, ds.duration_minutes,
                    u.name as doctor_name, dp.specialty
             FROM doctor_schedules ds
             JOIN doctor_profiles dp ON ds.doctor_id = dp.user_id
             JOIN users u ON dp.user_id = u.id
             ORDER BY ds.day_of_week, ds.start_time`
        );
        res.json(schedules);
    } catch (error) {
        console.error('Failed to fetch doctor schedules:', error);
        res.status(500).json({ error: 'Failed to fetch doctor schedules' });
    }
});

// Create new doctor schedule
app.post('/api/doctor-schedules', async (req, res) => {
    const { doctor_id, day_of_week, start_time, end_time, duration_minutes } = req.body;
    if (!doctor_id || !day_of_week || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields: doctor_id, day_of_week, start_time, end_time' });
    }
    if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(day_of_week)) {
        return res.status(400).json({ error: 'Invalid day of week' });
    }
    // Basic time format validation (e.g., 'HH:MM')
    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
        return res.status(400).json({ error: 'Time format must be HH:MM' });
    }

    try {
        // Verify doctor_id belongs to an actual doctor
        const doctorExists = await dbGet('SELECT 1 FROM doctor_profiles WHERE user_id = ?', [doctor_id]);
        if (!doctorExists) {
            return res.status(404).json({ error: 'Doctor not found or not a valid doctor user' });
        }

        const id = crypto.randomUUID();
        const result = await dbRun(
            'INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
            [id, doctor_id, day_of_week, start_time, end_time, duration_minutes || 30]
        );
        res.status(201).json({ id, doctor_id, day_of_week, start_time, end_time, duration_minutes: duration_minutes || 30 });
    } catch (error) {
        console.error('Failed to create doctor schedule:', error);
        res.status(500).json({ error: 'Failed to create doctor schedule: ' + error.message });
    }
});

// Get doctor schedules by doctor_id (not by department as there's no department column in doctor_schedules)
app.get('/api/doctor-schedules/doctor/:doctorId', async (req, res) => {
    const { doctorId } = req.params;
    try {
        const schedules = await dbAll(
            `SELECT ds.id, ds.day_of_week, ds.start_time, ds.end_time, ds.duration_minutes,
                    u.name as doctor_name, dp.specialty
             FROM doctor_schedules ds
             JOIN doctor_profiles dp ON ds.doctor_id = dp.user_id
             JOIN users u ON dp.user_id = u.id
             WHERE ds.doctor_id = ?
             ORDER BY ds.day_of_week, ds.start_time`,
            [doctorId]
        );
        if (schedules.length === 0) {
            return res.status(404).json({ message: 'No schedules found for this doctor.' });
        }
        res.json(schedules);
    } catch (error) {
        console.error('Failed to fetch doctor schedules by doctor ID:', error);
        res.status(500).json({ error: 'Failed to fetch doctor schedules by doctor ID' });
    }
});

// Update doctor schedule
app.put('/api/doctor-schedules/:id', async (req, res) => {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, duration_minutes } = req.body;

    if (!day_of_week || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields: day_of_week, start_time, end_time' });
    }
    if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(day_of_week)) {
        return res.status(400).json({ error: 'Invalid day of week' });
    }
    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
        return res.status(400).json({ error: 'Time format must be HH:MM' });
    }

    try {
        const result = await dbRun(
            `UPDATE doctor_schedules SET day_of_week = ?, start_time = ?, end_time = ?, duration_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [day_of_week, start_time, end_time, duration_minutes || 30, id]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Doctor schedule not found' });
        }
        const updatedSchedule = await dbGet(`SELECT ds.id, ds.day_of_week, ds.start_time, ds.end_time, ds.duration_minutes, u.name as doctor_name, dp.specialty FROM doctor_schedules ds JOIN doctor_profiles dp ON ds.doctor_id = dp.user_id JOIN users u ON dp.user_id = u.id WHERE ds.id = ?`, [id]);
        res.json({ message: 'Doctor schedule updated', schedule: updatedSchedule });
    } catch (error) {
        console.error('Failed to update doctor schedule:', error);
        res.status(500).json({ error: 'Failed to update doctor schedule: ' + error.message });
    }
});

// Delete doctor schedule
app.delete('/api/doctor-schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await dbRun('DELETE FROM doctor_schedules WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Doctor schedule not found' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete doctor schedule:', error);
        res.status(500).json({ error: 'Failed to delete doctor schedule: ' + error.message });
    }
});


// --- Staff Status Management ---
// Get all staff statuses (now joins with users table for name)
app.get('/api/staff-status', async (req, res) => {
    try {
        const statuses = await dbAll(
            `SELECT ss.id, ss.user_id, u.name, ss.department, ss.current_status, ss.extra_notes, ss.last_update
             FROM staff_status ss
             JOIN users u ON ss.user_id = u.id
             ORDER BY u.name ASC`
        );
        res.json(statuses);
    } catch (error) {
        console.error('Failed to fetch staff statuses:', error);
        res.status(500).json({ error: 'Failed to fetch staff statuses' });
    }
});

// Update staff status (by staff_status ID or user ID)
app.put('/api/staff-status/:userId', async (req, res) => { // Changed to use userId
    const { userId } = req.params;
    const { current_status, extra_notes, department } = req.body; // Added department for potential update

    if (!current_status) {
        return res.status(400).json({ error: 'Missing required field: current_status' });
    }
    if (!['active', 'on_leave', 'absent', 'training'].includes(current_status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
        const existingStatus = await dbGet('SELECT * FROM staff_status WHERE user_id = ?', [userId]);

        if (existingStatus) {
            const result = await dbRun(
                `UPDATE staff_status SET current_status = ?, extra_notes = ?, department = COALESCE(?, department), last_update = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [current_status, extra_notes || null, department || null, userId]
            );
            if (result.changes === 0) {
                return res.status(200).json({ message: 'No changes detected for staff status.' });
            }
        } else {
            // If no existing staff_status, create one (e.g., if a new doctor/admin is added and then their status is set)
            const staffStatusId = crypto.randomUUID();
            await dbRun(
                `INSERT INTO staff_status (id, user_id, department, current_status, extra_notes) VALUES (?, ?, ?, ?, ?)`,
                [staffStatusId, userId, department || 'General', current_status, extra_notes || null]
            );
        }

        const updatedStatus = await dbGet(`SELECT ss.id, ss.user_id, u.name, ss.department, ss.current_status, ss.extra_notes, ss.last_update FROM staff_status ss JOIN users u ON ss.user_id = u.id WHERE ss.user_id = ?`, [userId]);
        res.json({ message: 'Staff status updated successfully', status: updatedStatus });
    } catch (error) {
        console.error('Failed to update staff status:', error);
        res.status(500).json({ error: 'Failed to update staff status: ' + error.message });
    }
});


// Get status by department (now joins with users for name)
app.get('/api/staff-status/department/:dept', async (req, res) => {
    const { dept } = req.params;
    try {
        const statuses = await dbAll(
            `SELECT ss.id, ss.user_id, u.name, ss.department, ss.current_status, ss.extra_notes, ss.last_update
             FROM staff_status ss
             JOIN users u ON ss.user_id = u.id
             WHERE ss.department = ?
             ORDER BY u.name ASC`,
            [dept]
        );
        res.json(statuses);
    } catch (error) {
        console.error('Failed to fetch staff statuses by department:', error);
        res.status(500).json({ error: 'Failed to fetch staff statuses by department' });
    }
});


// --- Leave Requests Management ---
// Get all leave requests (now joins with users for applicant's name and approver's name)
app.get('/api/leave-requests', async (req, res) => {
    try {
        const requests = await dbAll(
            `SELECT lr.id, lr.user_id, u.name AS applicant_name, lr.start_date, lr.end_date, lr.reason, lr.status, lr.requested_at,
                    au.name AS approved_by_name
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN users au ON lr.approved_by = au.id -- LEFT JOIN because approved_by can be NULL
             ORDER BY lr.requested_at DESC`
        );
        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
});

// Create new leave request
app.post('/api/leave-requests', async (req, res) => {
    const { user_id, start_date, end_date, reason } = req.body; // Changed 'name' to 'user_id'
    if (!user_id || !start_date || !end_date || !reason) {
        return res.status(400).json({ error: 'Missing required fields: user_id, start_date, end_date, reason' });
    }

    try {
        // Verify user_id exists and is a staff member (doctor or admin)
        const requestingUser = await dbGet('SELECT id, name, role FROM users WHERE id = ? AND role IN ("doctor", "admin")', [user_id]);
        if (!requestingUser) {
            return res.status(404).json({ error: 'User not found or not authorized to request leave (must be doctor or admin).' });
        }

        const id = crypto.randomUUID();
        await dbRun(
            `INSERT INTO leave_requests (id, user_id, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, user_id, start_date, end_date, reason, 'pending']
        );
        res.status(201).json({ id, user_id, applicant_name: requestingUser.name, start_date, end_date, reason, status: 'pending' });
    } catch (error) {
        console.error('Failed to create leave request:', error);
        res.status(500).json({ error: 'Failed to create leave request: ' + error.message });
    }
});

// Update leave request status
app.put('/api/leave-requests/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, approved_by_user_id } = req.body; // Added approved_by_user_id

    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const updateFields = ['status = ?'];
        const updateParams = [status];

        // If status is approved/rejected, approved_by should be set
        if ((status === 'approved' || status === 'rejected') && approved_by_user_id) {
            // Verify approver is an admin
            const approver = await dbGet('SELECT id FROM users WHERE id = ? AND role = "admin"', [approved_by_user_id]);
            if (!approver) {
                return res.status(403).json({ error: 'Only administrators can approve/reject leave requests.' });
            }
            updateFields.push('approved_by = ?');
            updateParams.push(approved_by_user_id);
        } else if (status === 'pending') {
            // If setting back to pending, clear approved_by
            updateFields.push('approved_by = NULL');
        }

        updateParams.push(id);

        const result = await dbRun(
            `UPDATE leave_requests SET ${updateFields.join(', ')} WHERE id = ?`,
            updateParams
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Leave request not found or no change in status' });
        }

        // Fetch updated request with names
        const updatedRequest = await dbGet(
            `SELECT lr.id, lr.user_id, u.name AS applicant_name, lr.start_date, lr.end_date, lr.reason, lr.status, lr.requested_at,
                    au.name AS approved_by_name
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN users au ON lr.approved_by = au.id
             WHERE lr.id = ?`,
            [id]
        );

        res.json({ message: 'Leave request updated successfully', request: updatedRequest });
    } catch (error) {
        console.error('Failed to update leave request:', error);
        res.status(500).json({ error: 'Failed to update leave request: ' + error.message });
    }
});


// --- Doctor Dashboard Data ---
app.get('/api/doctor/dashboard/:userId', async (req, res) => { // Changed doctorId to userId
    try {
        const userId = req.params.userId;

        // Verify user exists and has the 'doctor' role
        const doctor = await dbGet(
            `SELECT u.id, u.name, u.email, dp.specialty
             FROM users u
             JOIN doctor_profiles dp ON u.id = dp.user_id
             WHERE u.id = ? AND u.role = 'doctor'`,
            [userId]
        );

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found or not a doctor user' });
        }

        // Get all dashboard data in parallel
        const [
            todayAppointmentsCount, // Renamed to avoid conflict with `todaysAppointments`
            totalPatientsCount,
            pendingReportsCount,
            activePrescriptionsCount,
            todaysAppointments,
            recentPatients
        ] = await Promise.all([
            getTodayAppointmentsCount(userId),
            getTotalPatientsCount(userId),
            getPendingReportsCount(userId),
            getActivePrescriptionsCount(userId),
            getTodaysAppointments(userId),
            getRecentPatients(userId)
        ]);

        res.json({
            doctor: {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
                specialty: doctor.specialty
            },
            todayAppointmentsCount,
            totalPatientsCount,
            pendingReportsCount,
            activePrescriptionsCount,
            todaysAppointments,
            recentPatients
        });

    } catch (error) {
        console.error('Doctor dashboard error:', error);
        res.status(500).json({ error: 'Failed to load doctor dashboard data' });
    }
});

// Helper functions for doctor dashboard
async function getTodayAppointmentsCount(doctorId) { // Still refers to doctor's user_id
    const result = await dbGet(
        `SELECT COUNT(*) as count
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = date('now')
           AND status IN ('pending', 'confirmed')`, // Only count active appointments
        [doctorId]
    );
    return result.count;
}

async function getTotalPatientsCount(doctorId) { // Still refers to doctor's user_id
    const result = await dbGet(
        `SELECT COUNT(DISTINCT patient_id) as count
         FROM appointments
         WHERE doctor_id = ?`,
        [doctorId]
    );
    return result.count;
}

async function getPendingReportsCount(doctorId) { // Still refers to doctor's user_id
    // There is no 'status' column in medical_reports table from your DDL.
    // Assuming 'pending' means a report that has not yet been reviewed or processed
    // If you need a status, you would need to add it to medical_reports table.
    // For now, I'll count all reports associated with the doctor that might need action.
    const result = await dbGet(
        `SELECT COUNT(*) as count
         FROM medical_reports
         WHERE doctor_id = ?`,
        [doctorId]
    );
    return result.count;
}

async function getActivePrescriptionsCount(doctorId) { // Still refers to doctor's user_id
    const result = await dbGet(
        `SELECT COUNT(*) as count
         FROM prescriptions
         WHERE doctor_id = ? AND status = 'active'`,
        [doctorId]
    );
    return result.count;
}

async function getTodaysAppointments(doctorId) { // Still refers to doctor's user_id
    const appointments = await dbAll(
        `SELECT a.id AS appointment_id, a.appointment_time,
                u.name as patient_name, a.notes as reason, a.status
         FROM appointments a
         JOIN users u ON a.patient_id = u.id
         WHERE a.doctor_id = ? AND a.appointment_date = date('now')
         ORDER BY a.appointment_time`,
        [doctorId]
    );
    return appointments;
}

async function getRecentPatients(doctorId) { // Still refers to doctor's user_id
    // Removed `p.condition`, `p.status`, `p.age`, `p.avatar` as `patient_profiles` table is not in schema
    const patients = await dbAll(
        `SELECT DISTINCT u.id AS patient_id, u.name AS patient_name,
                MAX(a.appointment_date || ' ' || a.appointment_time) as last_visit
         FROM appointments a
         JOIN users u ON a.patient_id = u.id
         WHERE a.doctor_id = ?
         GROUP BY u.id, u.name
         ORDER BY last_visit DESC
         LIMIT 5`,
        [doctorId]
    );
    return patients.map(p => ({
        id: p.patient_id, // Consistent with patient_id
        name: p.patient_name, // Consistent with patient_name
        lastVisit: p.last_visit // Consistent with last_visit
    }));
}

// Doctor Patients
app.get('/api/doctor/patients/:userId', async (req, res) => { // Changed doctorId to userId
    try {
        const userId = req.params.userId;

        const patients = await dbAll(
            `SELECT DISTINCT u.id AS patient_id, u.name AS patient_name,
                    MAX(a.appointment_date || ' ' || a.appointment_time) as last_visit
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             WHERE a.doctor_id = ?
             GROUP BY u.id, u.name
             ORDER BY last_visit DESC`,
            [userId]
        );

        // Map to desired output format (patientId, patientName, lastVisit)
        const formattedPatients = patients.map(p => ({
            patientId: p.patient_id,
            patientName: p.patient_name,
            lastVisit: p.last_visit
        }));

        res.json({ patients: formattedPatients });

    } catch (error) {
        console.error('Doctor patients error:', error);
        res.status(500).json({ error: 'Failed to load doctor patients' });
    }
});

// Get all appointments, with optional status filter
app.get('/api/appointments', (req, res) => {
  db.all(`SELECT * FROM appointments`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update appointment status
app.put('/api/appointments/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }
    try {
        const result = await dbRun(
            `UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, id]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json({ message: 'Appointment status updated successfully' });
    } catch (error) {
        console.error('Failed to update appointment status:', error);
        res.status(500).json({ error: 'Failed to update appointment status' });
    }
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  });
});

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Logout endpoint (for session-based auth)
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid'); // Optional: clear session cookie
    res.json({ message: 'Logged out successfully' });
  });
});

// --- Specialties Endpoint --- (New)
// Get all available specialties (distinct values from doctor_profiles)
app.get('/api/specialties', async (req, res) => {
    try {
        const specialties = await dbAll(`SELECT DISTINCT specialty FROM doctor_profiles WHERE specialty IS NOT NULL`);
        res.json(specialties);
    } catch (error) {
        console.error('Failed to fetch specialties:', error);
        res.status(500).json({ error: 'Failed to fetch specialties' });
    }
});

// --- User Profile Endpoint --- (New)
// Get user profile by ID (public info, no sensitive data like password)
app.get('/api/users/profile/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await dbGet(`SELECT id, name, username, email, phone, role FROM users WHERE id = ?`, [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// --- Update User Profile Endpoint --- (New)
// Update user profile (name, email, phone) - password update handled separately
app.put('/api/users/profile/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    // Basic validation
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
        // Update user profile
        await dbRun(
            `UPDATE users SET name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [name, email, phone || null, id]
        );

        // Fetch and return updated profile
        const updatedUser = await dbGet(`SELECT id, name, username, email, phone, role FROM users WHERE id = ?`, [id]);
        res.json(updatedUser);
    } catch (error) {
        console.error('Failed to update user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});

// --- Update Password Endpoint --- (New)
// Update user password (requires old password confirmation)
app.put('/api/users/password/:id', async (req, res) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    // Basic validation
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old password and new password are required' });
    }

    try {
        // Get user by ID
        const user = await dbGet(`SELECT id, password FROM users WHERE id = ?`, [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if old password matches
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Old password is incorrect' });
        }

        // Hash new password and update
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await dbRun(
            `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [hashedNewPassword, id]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Failed to update password:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// --- Patient Registration --- (Modified)
// Patients can register themselves
app.post('/api/patients/register', (req, res) => {
    const { name, username, email, phone, password } = req.body;
    console.log('Patient registration attempt:', { name, username, email, phone });

    // Basic validation
    if (!name || !username || !email || !password) {
        return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }

    // Email and password validation (reuse existing logic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format!" });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
        return res.status(400).json({
            error: "Password must be at least 8 characters, contain a letter, a number, and a special character."
        });
    }

    // Check if username or email already exists
    db.get(
        `SELECT id FROM users WHERE username = ? OR email = ?`,
        [username, email],
        async (err, row) => {
            if (err) {
                console.error('Error checking duplicates:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const id = crypto.randomUUID();

                // Insert new user (role: patient)
                await dbRun(
                    `INSERT INTO users (id, name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, 'patient')`,
                    [id, name, username, email, phone || null, hashedPassword]
                );

                res.status(201).json({ message: 'Patient registered successfully' });
            } catch (error) {
                console.error('Error registering patient:', error);
                res.status(500).json({ error: 'Failed to register patient' });
            }
        }
    );
});

// --- Admin Routes ---
// Get all admin users
app.get('/api/admins', (req, res) => {
    db.all(`SELECT id, name, username, email, phone FROM users WHERE role = 'admin'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new admin user
app.post('/api/admins', async (req, res) => {
    const { name, username, email, phone, password } = req.body;
    console.log('Admin creation attempt:', { name, username, email, phone });

    // Basic validation
    if (!name || !username || !email || !password) {
        return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }

    // Email and password validation (reuse existing logic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format!" });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
        return res.status(400).json({
            error: "Password must be at least 8 characters, contain a letter, a number, and a special character."
        });
    }

    // Check if username or email already exists
    db.get(
        `SELECT id FROM users WHERE username = ? OR email = ?`,
        [username, email],
        async (err, row) => {
            if (err) {
                console.error('Error checking duplicates:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const id = crypto.randomUUID();

                // Insert new admin user
                await dbRun(
                    `INSERT INTO users (id, name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, 'admin')`,
                    [id, name, username, email, phone || null, hashedPassword]
                );

                res.status(201).json({ message: 'Admin user created successfully' });
            } catch (error) {
                console.error('Error creating admin user:', error);
                res.status(500).json({ error: 'Failed to create admin user' });
            }
        }
    );
});

// --- Doctor Availability ---
// Get doctor's available time slots for a specific date
app.get('/api/doctors/:doctorId/availability', async (req, res) => {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    try {
        // Fetch doctor's scheduled appointments for the date
        const appointments = await dbAll(
            `SELECT a.id, a.appointment_time, a.duration_minutes, a.status, u.name as patient_name
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             WHERE a.doctor_id = ? AND a.appointment_date = ?
             ORDER BY a.appointment_time`,
            [doctorId, date]
        );

        // Fetch doctor's available schedule slots
        const schedule = await dbAll(
            `SELECT ds.start_time, ds.end_time, ds.duration_minutes
             FROM doctor_schedules ds
             WHERE ds.doctor_id = ? AND ds.day_of_week = strftime('%w', ?)`, // %w: day of week (0-6)
            [doctorId, date]
        );

        // Filter out booked slots
        const availableSlots = schedule.filter(slot => {
            const slotStart = `${date} ${slot.start_time}`;
            const slotEnd = `${date} ${slot.end_time}`;
            const isBooked = appointments.some(appointment => {
                const appointmentStart = `${date} ${appointment.appointment_time}`;
                const appointmentEnd = new Date(new Date(appointmentStart).getTime() + appointment.duration_minutes * 60000);
                return new Date(slotStart) < appointmentEnd && new Date(slotEnd) > new Date(appointmentStart);
            });
            return !isBooked;
        });

        res.json({ date, doctorId, appointments, availableSlots });
    } catch (error) {
        console.error('Failed to fetch doctor availability:', error);
        res.status(500).json({ error: 'Failed to fetch doctor availability' });
    }
});

// Book an appointment (patient-initiated)
app.post('/api/appointments/book', async (req, res) => {
    const { patient_id, doctor_id, schedule_id, appointment_date, appointment_time, notes } = req.body;

    // Basic validation
    if (!patient_id || !doctor_id || !schedule_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const id = crypto.randomUUID();

        // Create new appointment
        await dbRun(
            `INSERT INTO appointments (id, patient_id, doctor_id, schedule_id, appointment_date, appointment_time, status, notes) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [id, patient_id, doctor_id, schedule_id, appointment_date, appointment_time, notes || null]
        );

        res.status(201).json({ message: 'Appointment booked successfully', appointmentId: id });
    } catch (error) {
        console.error('Failed to book appointment:', error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

// --- Patient Medical History ---
// Get patient's medical history (reports and prescriptions)
app.get('/api/patients/:patientId/medical-history', async (req, res) => {
    const { patientId } = req.params;

    try {
        // Fetch medical reports and prescriptions in parallel
        const [reports, prescriptions] = await Promise.all([
            dbAll(
                `SELECT r.id, r.report_type, r.report_date, r.file_path, u.name as doctor_name
                 FROM medical_reports r
                 LEFT JOIN users u ON r.doctor_id = u.id
                 WHERE r.patient_id = ?
                 ORDER BY r.report_date DESC`,
                [patientId]
            ),
            dbAll(
                `SELECT p.id, p.medication, p.dosage, p.frequency, p.start_date, p.end_date, u.name as doctor_name
                 FROM prescriptions p
                 JOIN users u ON p.doctor_id = u.id
                 WHERE p.patient_id = ?
                 ORDER BY p.start_date DESC`,
                [patientId]
            )
        ]);

        res.json({ reports, prescriptions });
    } catch (error) {
        console.error('Failed to fetch medical history:', error);
        res.status(500).json({ error: 'Failed to fetch medical history' });
    }
});

// --- Admin Dashboard Data --- (New)
// Get admin dashboard data (e.g., stats, recent activities)
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        // Example: Get total counts for users, doctors, patients, appointments
        const [userCount, doctorCount, patientCount, appointmentCount] = await Promise.all([
            dbGet(`SELECT COUNT(*) as count FROM users`),
            dbGet(`SELECT COUNT(*) as count FROM doctor_profiles`),
            dbGet(`SELECT COUNT(*) as count FROM users WHERE role = 'patient'`),
            dbGet(`SELECT COUNT(*) as count FROM appointments`)
        ]);

        // Example: Get recent activities (last 5)
        const recentActivities = await dbAll(
            `SELECT a.id, a.activity_type, a.activity_date, a.description, u.name as user_name
             FROM activity_log a
             JOIN users u ON a.user_id = u.id
             ORDER BY a.activity_date DESC
             LIMIT 5`
        );

        res.json({
            userCount: userCount.count,
            doctorCount: doctorCount.count,
            patientCount: patientCount.count,
            appointmentCount: appointmentCount.count,
            recentActivities
        });
    } catch (error) {
        console.error('Failed to fetch admin dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
    }
});
// --- Appointment Booking --- (Modified)
// Book an appointment (patient-initiated)
app.post('/api/appointments', async (req, res) => {
  let { patient_id, patient_name, patient_email, patient_phone, doctor_id, schedule_id, appointment_date, appointment_time, notes } = req.body;
  if (!doctor_id || !schedule_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // If patient_id is not provided, create/find patient by email
    if (!patient_id) {
      if (!patient_email || !patient_name) {
        return res.status(400).json({ error: 'Patient name and email are required.' });
      }
      // Check if patient exists
      let patient = await dbGet('SELECT id FROM users WHERE email = ? AND role = "patient"', [patient_email]);
      if (!patient) {
        // Create new patient user
        const newPatientId = crypto.randomUUID();
        await dbRun(
          `INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)",
          [newPatientId, patient_name, patient_email, patient_phone || null, '', 'patient']`
        );
        patient_id = newPatientId;
      } else {
        patient_id = patient.id;
      }
    }

    // Check doctor's availability for the given date and time
    const schedule = await dbGet(
      `SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ?`,
      [schedule_id, doctor_id]
    );
    if (!schedule) {
      return res.status(400).json({ error: 'Selected time slot is not available for this doctor.' });
    }

    // Check if doctor already has an appointment at this date/time
    const conflict = await dbGet(
      `SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('pending', 'confirmed')`,
      [doctor_id, appointment_date, appointment_time]
    );
    if (conflict) {
      return res.status(400).json({ error: 'Doctor is not available at the selected time.' });
    }

    // Book the appointment
    const id = crypto.randomUUID();
    await dbRun(
      `INSERT INTO appointments (id, patient_id, doctor_id, schedule_id, appointment_date, appointment_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, patient_id, doctor_id, schedule_id, appointment_date, appointment_time, notes || null]
    );
    res.status(201).json({ message: 'Appointment booked', id });
  } catch (error) {
    console.error('Failed to book appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment: ' + error.message });
  }
});
app.get('/api/doctor-schedules/:id', async (req, res) => {
  try {
    const schedule = await dbGet('SELECT * FROM doctor_schedules WHERE id = ?', [req.params.id]);
    if (!schedule) return res.status(404).json({ error: 'Slot not found' });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Error Handling Middleware --- (New)
// Catch 404 errors
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not found' });
});

// General error handler
app.use((err, req, res, next) => {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
});



