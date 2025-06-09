const express = require('express');
const router = express.Router();

// In-memory operation chart array for demo
let operationChart = [
  { id: '001', patient: 'Ravi', procedure: 'Appendectomy', doctor: 'Dr. Rao', date: '2025-06-15' }
];

// Get all operations
router.get('/', (req, res) => {
  res.json(operationChart);
});

// Add an operation
router.post('/', (req, res) => {
  const { patient, procedure, doctor, date } = req.body;
  const id = String(Date.now());
  operationChart.push({ id, patient, procedure, doctor, date });
  res.status(201).json({ message: 'Operation added' });
});

// Delete an operation
router.delete('/:id', (req, res) => {
  operationChart = operationChart.filter(op => op.id !== req.params.id);
  res.json({ message: 'Operation deleted' });
});

module.exports = router;