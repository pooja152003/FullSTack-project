const express = require('express');
const router = express.Router();

// In-memory leave requests array for demo
let leaveRequests = [
  { id: '001', name: 'Anjali', reason: 'Personal', status: 'Pending' }
];

// Get all leave requests
router.get('/', (req, res) => {
  res.json(leaveRequests);
});

// Add a leave request
router.post('/', (req, res) => {
  const { name, reason, status } = req.body;
  const id = String(Date.now());
  leaveRequests.push({ id, name, reason, status });
  res.status(201).json({ message: 'Leave request added' });
});

// Delete a leave request
router.delete('/:id', (req, res) => {
  leaveRequests = leaveRequests.filter(lr => lr.id !== req.params.id);
  res.json({ message: 'Leave request deleted' });
});

module.exports = router;