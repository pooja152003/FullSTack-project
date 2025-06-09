const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

// This line allows your server to read JSON in requests
app.use(express.json());

// Import your user management router (adjust the filename if needed)
const ManageUsersRouter = require('./ManageUsers'); // or './manageuser' if that's your filename

const ManageStaffRouter = require('./ManageStaff');
app.use('/api/staff', ManageStaffRouter);

// Use the router for /api/users endpoints
app.use('/api/users', ManageUsersRouter);

const DoctorScheduleRouter = require('./DoctorSchedule');
app.use('/api/doctor-schedule', DoctorScheduleRouter);

const OtScheduleRouter = require('./OtSchedule');
app.use('/api/ot-schedule', OtScheduleRouter);

const OperationChartRouter = require('./OperationChart');
app.use('/api/operation-chart', OperationChartRouter);
// Serve your frontend files (adjust the path if needed)
const StaffStatusRouter = require('./StaffStatus');
app.use('/api/staff-status', StaffStatusRouter);

const LeaveRequestsRouter = require('./LeaveRequests');
app.use('/api/leave-requests', LeaveRequestsRouter);

const path = require('path');
app.use(express.static(path.join(__dirname, '../FS Hospital Website/frontend')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
app.post('/api/patient/login', (req, res) => {
  // Replace with real user lookup
  const user = { username: req.body.username, name: req.body.username }; // Or fetch real name
  const token = jwt.sign({ username: user.username, name: user.name }, 'your_jwt_secret');
  res.json({ token });
});

// Example: Get current patient info
app.get('/api/patient/me', authenticateToken, (req, res) => {
  // req.user will have info from JWT, e.g. { username: 'patient1', name: 'Ravi Kumar' }
  res.json({ name: req.user.name });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});