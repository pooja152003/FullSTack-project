console.log('DoctorSchedule router loaded');
const express = require('express');
const router = express.Router();

let schedule = [
  { id: '001', doctor: 'Dr. Rao', department: 'General', time: '10:00 AM - 1:00 PM' }
];

router.get('/', (req, res) => {
  res.json(schedule);
});

router.post('/', (req, res) => {
  const { doctor, department, time } = req.body;
  const id = String(Date.now());
  schedule.push({ id, doctor, department, time });
  res.status(201).json({ message: 'Schedule added' });
});

router.delete('/:id', (req, res) => {
  schedule = schedule.filter(s => s.id !== req.params.id);
  res.json({ message: 'Schedule deleted' });
});

module.exports = router;