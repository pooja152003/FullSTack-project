document.getElementById("doctorLoginForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const doctorId = this.doctorId.value.trim();
  const password = this.password.value.trim();

  if (!doctorId || !password) {
    alert("Please fill in both fields");
    return;
  }

  // Placeholder for actual login logic
  window.location.href = 'admin.html';

  // TODO: Implement authentication & redirect
});
