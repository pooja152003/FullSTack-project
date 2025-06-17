document.addEventListener('DOMContentLoaded', () => {
  const registrationForm = document.getElementById('registrationForm');

  if (registrationForm) {
    registrationForm.addEventListener('submit', async function(event) {
      event.preventDefault();

      // Show loading state
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering...';

      const name = document.getElementById('name').value.trim();
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value.trim();
      const confirmPassword = document.getElementById('confirmPassword').value.trim();
      const role = document.getElementById('role').value.trim();

      // Client-side validation
      if (!name || !username || !email || !phone || !password || !role) {
        showError('Please fill in all required fields');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        return;
      }

      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showError('Invalid email format');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        return;
      }

      if (phone.length !== 10 || !/^[0-9]{10}$/.test(phone)) {
        showError('Phone number must be 10 digits');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords don't match");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        return;
      }

      // Prepare data for server (exclude confirmPassword)
      const data = { name, username, email, phone, password, role };

      try {
        const response = await fetch('http://localhost:3000/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log('Registration response:', result); // Log response

        if (!response.ok) {
          throw new Error(result.error || 'Registration failed');
        }

        // Registration successful
        showSuccess('Registration successful! Redirecting...');
        let redirectUrl = 'total-login.html'; // default
        if (role === 'admin') {
          redirectUrl = 'admin.html';
        } else if (role === 'doctor') {
          redirectUrl = 'doctors.html';
        } else if (role === 'patient') {
          redirectUrl = 'patientdashboard.html';
        }

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);
      } catch (error) {
        showError(error.message);
        console.error('Registration error:', error);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
      }
    });
  }

  function showError(message) {
    const existingMsg = document.querySelector('#form-message');
    if (existingMsg) existingMsg.textContent = '';

    const errorElement = document.getElementById('form-message');
    errorElement.className = 'form-message error';
    errorElement.textContent = message;
  }

  function showSuccess(message) {
    const existingMsg = document.querySelector('#form-message');
    if (existingMsg) existingMsg.textContent = '';

    const successElement = document.getElementById('form-message');
    successElement.className = 'form-message success';
    successElement.textContent = message;
  }
});