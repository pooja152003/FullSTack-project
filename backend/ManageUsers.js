const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

module.exports = (db) => {
  // Initialize users table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        fullname TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'patient',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating users table:', err);
    });
  });

  // Register User Route
  router.post('/register', async (req, res) => {
    try {
      const { fullname, username, email, phone, password, confirmPassword, role = 'patient' } = req.body;

      // Validate input
      if (!fullname || !username || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: "All fields are required!" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords don't match!" });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format!" });
      }

      // Validate password strength (min 8 chars, 1 number, 1 special char)
      if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(password)) {
        return res.status(400).json({ 
          error: "Password must be at least 8 characters with 1 number and 1 special character!" 
        });
      }

      // Check if user exists
      db.get(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [email, username],
        async (err, row) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal server error" });
          }

          if (row) {
            return res.status(400).json({ error: "Email or username already in use!" });
          }

          try {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            const newUser = {
              id: uuidv4(),
              fullname,
              username,
              email,
              phone,
              password: hashedPassword,
              role,
              status: 'active'
            };

            db.run(
              `INSERT INTO users 
              (id, fullname, username, email, phone, password, role, status) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newUser.id,
                newUser.fullname,
                newUser.username,
                newUser.email,
                newUser.phone,
                newUser.password,
                newUser.role,
                newUser.status
              ],
              (err) => {
                if (err) {
                  console.error("Database error:", err);
                  return res.status(500).json({ error: "Failed to register user" });
                }
                res.status(201).json({ 
                  success: true,
                  message: "User registered successfully!",
                  user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role
                  }
                });
              }
            );
          } catch (hashError) {
            console.error("Password hashing error:", hashError);
            res.status(500).json({ error: "Internal server error" });
          }
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router; 
};