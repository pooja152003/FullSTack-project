// Check if admin is logged in
document.addEventListener('DOMContentLoaded', function() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'admin') {
    alert('Access denied. Admins only.');
    window.location.href = 'adminlogin.html';
  }
});

document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('login-message'); // Fixed reference
  try {
    const res = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = "Login successful!";
      msg.className = "success";
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      // Redirect to admin.html
      window.location.href = 'admindashboard.html';
    } else {
      msg.textContent = data.error || "Login failed";
      msg.className = "error";
    }
  } catch (err) {
    console.error('Client-side error:', err);
    msg.textContent = "Network error: " + err.message;
    msg.className = "error";
  }
});
