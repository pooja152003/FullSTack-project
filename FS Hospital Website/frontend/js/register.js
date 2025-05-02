document.getElementById("registrationForm").addEventListener("submit", function (e) {
    e.preventDefault();
  
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const message = document.getElementById("message");
  
    if (!username || !email || !password || !confirmPassword) {
      message.textContent = "Please fill in all fields.";
      return;
    }
  
    const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
    if (!emailPattern.test(email)) {
      message.textContent = "Please enter a valid email address.";
      return;
    }
  
    if (password !== confirmPassword) {
      message.textContent = "Passwords do not match.";
      return;
    }
  
    message.style.color = "green";
    message.textContent = "Registration successful!";
  });
  