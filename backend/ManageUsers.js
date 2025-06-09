const express = require('express');
const router = express.Router();

// In-memory users array for demo; replace with DB in production
let users = [
  { id: '001', name: 'John Doe', role: 'Admin', status: 'Active' },
  { id: '002', name: 'Jane Smith', role: 'Doctor', status: 'Inactive' }
];

// Get all users
router.get('/', (req, res) => {
  res.json(users);
});

// Add a user
router.post('/', (req, res) => {
  const { name, role } = req.body;
  const id = String(Date.now());
  users.push({ id, name, role, status: 'Active' });
  res.status(201).json({ message: 'User added' });
});

// Delete a user
router.delete('/:id', (req, res) => {
  users = users.filter(u => u.id !== req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;