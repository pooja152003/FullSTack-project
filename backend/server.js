const express = require('express');
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

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});