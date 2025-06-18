document.addEventListener('DOMContentLoaded', function() {
  const availabilityForm = document.getElementById('availabilityForm');
  const checkBtn = document.getElementById('checkBtn');
  const resultContainer = document.getElementById('availabilityResult');
  const appointmentDate = document.getElementById('appointmentDate');
  
  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];
  appointmentDate.setAttribute('min', today);
  
  // Form submission handler
  availabilityForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const department = document.getElementById('department').value;
      const date = appointmentDate.value;
      const time = document.getElementById('appointmentTime').value;
      
      if (!department || !date || !time) {
          alert('Please fill all fields');
          return;
      }
      
      checkBtn.disabled = true;
      checkBtn.textContent = 'Checking...';
      
      // Simulate API call with timeout
      setTimeout(() => {
          checkAvailability(department, date, time);
          checkBtn.disabled = false;
          checkBtn.textContent = 'Check Availability';
      }, 800);
  });
  
  // Check availability (simulated)
  function checkAvailability(department, date, time) {
      // In a real app, this would be an API call
      const isAvailable = Math.random() > 0.3; // 70% chance of being available
      
      resultContainer.style.display = 'block';
      resultContainer.className = isAvailable ? 'result-container available' : 'result-container not-available';
      
      if (isAvailable) {
          resultContainer.innerHTML = `
              <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" class="result-icon" alt="Available">
              <strong>Slot Available!</strong><br>
              ${department} consultation on ${formatDate(date)} at ${formatTime(time)} is available.
              <div style="margin-top: 10px;">
                  <button type="button" id="bookNowBtn" style="background-color: #28a745;">Book Now</button>
              </div>
          `;
          
          document.getElementById('bookNowBtn').addEventListener('click', function() {
              alert(`Booking confirmed for ${department} on ${formatDate(date)} at ${formatTime(time)}`);
              availabilityForm.reset();
              resultContainer.style.display = 'none';
          });
      } else {
          resultContainer.innerHTML = `
              <img src="https://cdn-icons-png.flaticon.com/512/1828/1828843.png" class="result-icon" alt="Not available">
              <strong>Slot Not Available</strong><br>
              ${department} consultation on ${formatDate(date)} at ${formatTime(time)} is not available.
              Please try another time or date.
          `;
      }
  }
  
  // Helper functions for formatting
  function formatDate(dateString) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString('en-US', options);
  }
  
  function formatTime(timeString) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
  }
});

