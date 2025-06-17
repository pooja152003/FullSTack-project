// Check if admin is logged in
document.addEventListener('DOMContentLoaded', function() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'admin') {
    alert('Access denied. Admins only.');
    window.location.href = 'adminlogin.html';
  }
});

document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('login-message'); // Fixed reference
  try {
    const res = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = "Login successful!";
      msg.className = "success";
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      // Redirect to admin.html
      window.location.href = 'admin.html';
    } else {
      msg.textContent = data.error || "Login failed";
      msg.className = "error";
    }
  } catch (err) {
    console.error('Client-side error:', err);
    msg.textContent = "Network error: " + err.message;
    msg.className = "error";
  }
});



const session = require('express-session');

// Session Middleware
app.use(session({
  secret: 'your-secret-key', // Replace with a strong secret
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true in production with HTTPS
}));

// Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Admin login request:', { username });
  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ? AND role = 'admin'`,
    [username, password],
    (err, row) => {
      if (err) {
        console.error('Database error during admin login:', err.message);
        return res.status(500).json({ error: err.message });
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

// Middleware to Protect Admin Routes
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Access denied. Admins only.' });
}

// Protect Admin Routes
app.get('/api/users', ensureAdmin, (req, res) => {
  db.all(`SELECT * FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users/register', ensureAdmin, (req, res) => {
  const { name, username, email, password, role } = req.body;
  console.log('Register request:', { name, username, email, role });
  if (!name || !username || !email || !password || !role) {
    console.error('Missing fields in registration request');
    return res.status(400).json({ error: 'All fields required' });
  }
  const id = Date.now().toString();
  db.run(
    `INSERT INTO users (id, name, username, email, password, role) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, username, email, password, role],
    function (err) {
      if (err) {
        console.error('Database error during registration:', err.message);
        return res.status(400).json({ error: err.message });
      }
      console.log('User registered successfully:', { id, username });
      res.json({ message: 'User registered', id });
    }
  );
});

app.get('/api/doctor-schedule', ensureAdmin, (req, res) => {
  db.all(`SELECT * FROM schedule`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/doctor-schedule', ensureAdmin, (req, res) => {
  const { doctor, department, schedule_time } = req.body;
  console.log('Doctor schedule request:', { doctor, department, schedule_time });
  if (!doctor || !department || !schedule_time) {
    console.error('Missing fields in doctor schedule request');
    return res.status(400).json({ error: 'All fields required' });
  }
  const id = Date.now().toString();
  db.run(
    `INSERT INTO schedule (id, doctor, department, schedule_time) VALUES (?, ?, ?, ?)`,
    [id, doctor, department, schedule_time],
    function (err) {
      if (err) {
        console.error('Database error during schedule insertion:', err.message);
        return res.status(400).json({ error: err.message });
      }
      console.log('Doctor schedule added successfully:', { id, doctor });
      res.json({ message: 'Schedule added', id });
    }
  );
});
