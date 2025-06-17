const express = require('express');
const router = express.Router();

module.exports = (db) => {
 console.log('DoctorSchedule router loaded');

 // Get all doctor schedules
router.get('/', (req, res) => {
  db.all('SELECT * FROM schedule', [], (err, rows) => {
 if (err) return res.status(500).json({ message: 'Database error', error: err.message });
   res.json(rows);
 });
 });

 // Add a doctor schedule
 router.post('/', (req, res) => {
 const { doctor, department, schedule_time } = req.body;
 if (!doctor || !department || !schedule_time) {
 return res.status(400).json({ message: 'Doctor, department, and schedule_time are required' });
 }
const id = require('crypto').randomUUID();
   db.run( 'INSERT INTO schedule (id, doctor, department, schedule_time) VALUES (?, ?, ?, ?)',
 [id, doctor, department, schedule_time],
 function (err) {
if (err) return res.status(500).json({ message: 'Database error', error: err.message });
 res.status(201).json({ 
 message: 'Schedule added', 
 data: { id, doctor, department, schedule_time } 
 });
 }
 );
 });

 // Delete a doctor schedule - FIXED THE ROUTE PARAMETER (as you mentioned, this was the likely fix)
router.delete('/:id', (req, res) => {
 db.get('SELECT id FROM schedule WHERE id = ?', [req.params.id], (err, row) => {
 if (err) return res.status(500).json({ message: 'Database error', error: err.message });
 if (!row) return res.status(404).json({ message: 'Schedule not found' });
db.run('DELETE FROM schedule WHERE id = ?', [req.params.id], (err) => {
 if (err) return res.status(500).json({ message: 'Database error', error: err.message });
res.json({ message: 'Schedule deleted' });
 });
 });
 });

 // Initialize schedule table (This part should ideally be in server.js's initializeDatabase function
 // to ensure it runs only once during app startup, but keeping it here as per your request "without changing anything other than error")
 db.serialize(() => {
 db.run(`
 CREATE TABLE IF NOT EXISTS schedule (
 id TEXT PRIMARY KEY,
 doctor TEXT NOT NULL,
 department TEXT NOT NULL,
 schedule_time TEXT NOT NULL
 )
 `);
 });

 return router;
};