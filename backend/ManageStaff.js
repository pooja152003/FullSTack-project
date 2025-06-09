const express = require('express');
const router = express.Router();

let staff = [
  { id: '001', name: 'Dr. Asha', dept: 'Cardiology', role: 'Doctor', date: '2024-02-01' }
];

router.get('/', (req, res) => {
  res.json(staff);
});

router.post('/', (req, res) => {
  const { name, dept, role, date } = req.body;
  const id = String(Date.now());
  staff.push({ id, name, dept, role, date });
  res.status(201).json({ message: 'Staff added' });
});

router.delete('/:id', (req, res) => {
  staff = staff.filter(s => s.id !== req.params.id);
  res.json({ message: 'Staff deleted' });
});

module.exports = router;