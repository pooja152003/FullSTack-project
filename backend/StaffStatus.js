const express = require('express');
const router = express.Router();

// In-memory staff status array for demo
let staffStatus = [
  { id: '001', name: 'Sita', department: 'Emergency', status: 'On Duty', extra: 'Night' },
  { id: '002', name: 'Ravi', department: 'Radiology', status: 'On Leave', extra: '2025-05-02 to 2025-05-05' }
];

// Get all staff status
router.get('/', (req, res) => {
  res.json(staffStatus);
});

// Add a staff status
router.post('/', (req, res) => {
  const { name, department, status, extra } = req.body;
  const id = String(Date.now());
  staffStatus.push({ id, name, department, status, extra });
  res.status(201).json({ message: 'Staff status added' });
});

// Delete a staff status
router.delete('/:id', (req, res) => {
  staffStatus = staffStatus.filter(s => s.id !== req.params.id);
  res.json({ message: 'Staff status deleted' });
});

module.exports = router;