document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerPrompt = document.getElementById('registerPrompt');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Disable button during request
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            // Client-side validation
            if (!username || !password) {
                showError('Please enter both username and password.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/patient/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                // Check if the response was NOT ok (e.g., 400, 401, 500)
                if (!response.ok) {
                    const errorData = await response.json(); // Parse error JSON
                    console.log('Login error response data:', errorData);

                    // Special handling for unregistered users
                    if (errorData.unregistered) {
                        showError(errorData.error);
                        if (registerPrompt) registerPrompt.style.display = 'block';
                        return;
                    }
                    // For other non-OK responses (e.g., Invalid credentials)
                    throw new Error(errorData.error || `Login failed with status: ${response.status}`);
                }

                // If response.ok is true, then it's a successful login
                const result = await response.json(); // Parse successful JSON
                console.log('Login successful response:', result);

                // Successful login
                localStorage.setItem('user', JSON.stringify(result.user));
                showSuccess('Login successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'patientdashboard.html';
                }, 1500);

            } catch (error) {
                // This catch block handles network errors or errors thrown explicitly above
                showError(error.message || 'An unexpected error occurred during login');
                console.error('Login error:', error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });
    }

    function showError(message) {
        const messageElement = document.getElementById('form-message');
        if (messageElement) {
            messageElement.className = 'form-message error';
            messageElement.textContent = message;
            messageElement.style.display = 'block';
        }
    }

    function showSuccess(message) {
        const messageElement = document.getElementById('form-message');
        if (messageElement) {
            messageElement.className = 'form-message success';
            messageElement.textContent = message;
            messageElement.style.display = 'block';
        }
    }
});