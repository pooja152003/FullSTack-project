document.getElementById("adminLoginForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const username = this.username.value.trim();
  const password = this.password.value.trim();

  // Simple frontend validation
  if (!username || !password) {
    alert("Please fill in both fields");
    return;
  }


  window.location.href = 'admin.html';
  // TODO: Send login data to backend, handle response, redirect on success
});
