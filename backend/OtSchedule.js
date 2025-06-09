const express = require('express');
const router = express.Router();

// In-memory OT schedule array for demo
let otSchedule = [
  { id: '001', room: 'OT1', time: '9:00 AM', procedure: 'Heart Bypass' }
];

// Get all OT schedules
router.get('/', (req, res) => {
  res.json(otSchedule);
});

// Add an OT schedule
router.post('/', (req, res) => {
  const { room, time, procedure } = req.body;
  const id = String(Date.now());
  otSchedule.push({ id, room, time, procedure });
  res.status(201).json({ message: 'OT schedule added' });
});

// Delete an OT schedule
router.delete('/:id', (req, res) => {
  otSchedule = otSchedule.filter(s => s.id !== req.params.id);
  res.json({ message: 'OT schedule deleted' });
});

module.exports = router;