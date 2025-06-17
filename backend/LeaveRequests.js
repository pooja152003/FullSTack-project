const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Initialize leave_requests table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected'))
      )
    `, (err) => {
      if (err) console.error('Error creating leave_requests table:', err.message);
    });
  });

  // Get all leave requests
  router.get('/', (req, res) => {
    db.all('SELECT * FROM leave_requests', [], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      res.json(rows);
    });
  });

  // Add a new leave request
  router.post('/', (req, res) => {
    const { name, reason, status = 'pending' } = req.body;
    if (!name || !reason) {
      return res.status(400).json({ message: 'Name and reason are required' });
    }
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be pending, approved, or rejected' });
    }

    const id = String(Date.now());
    db.run(
      'INSERT INTO leave_requests (id, name, reason, status) VALUES (?, ?, ?, ?)',
      [id, name, reason, status],
      function (err) {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        res.status(201).json({ 
          message: 'Leave request added', 
          data: { id, name, reason, status } 
        });
      }
    );
  });

  // Delete a leave request
  router.delete('/:id', (req, res) => {
    db.get('SELECT id FROM leave_requests WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!row) return res.status(404).json({ message: 'Leave request not found' });
      
      db.run('DELETE FROM leave_requests WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        res.json({ message: 'Leave request deleted' });
      });
    });
  });

  return router;
};