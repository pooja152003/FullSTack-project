document.addEventListener('DOMContentLoaded', async function() {
  // Check if user is logged in
  const userData = JSON.parse(localStorage.getItem('user'));
  if (!userData || !userData.id) {
    window.location.href = '../index.html';
    return;
  }

  // Initialize elements
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');
  
  // Set user info in sidebar
  document.getElementById('sidebarUserName').textContent = userData.name || 'Patient';
  document.getElementById('welcomeMsg').textContent = `Welcome back, ${userData.name || 'Patient'}`;
  
  // Set last login time
  const lastLogin = new Date().toLocaleString();
  document.getElementById('lastLogin').textContent = `Last login: ${lastLogin}`;

  // Fetch additional user data from database
  try {
    const response = await fetch(`http://localhost:3000/api/users?id=${userData.id}`);
    if (!response.ok) throw new Error('Failed to fetch user data');
    
    const user = await response.json();
    updateDashboard(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    showError('Failed to load dashboard data. Please refresh the page.');
  }

  // Logout functionality
  logoutBtn.addEventListener('click', () => {
    logoutModal.style.display = 'flex';
  });

  cancelLogout.addEventListener('click', () => {
    logoutModal.style.display = 'none';
  });

  confirmLogout.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '../index.html';
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === logoutModal) {
      logoutModal.style.display = 'none';
    }
  });

  // New appointment button
  document.getElementById('newAppointmentBtn').addEventListener('click', () => {
    window.location.href = 'appoint_history.html';
  });
});

function updateDashboard(user) {
  // Update next appointment
  if (user.nextAppointment) {
    const apptElement = document.getElementById('nextAppointment');
    apptElement.innerHTML = `
      <p><strong>${user.nextAppointment.date}</strong></p>
      <p>With Dr. ${user.nextAppointment.doctor}</p>
      <p>${user.nextAppointment.location || ''}</p>
    `;
  }

  // Update recent reports
  if (user.recentReports && user.recentReports.length > 0) {
    const reportElement = document.getElementById('recentReport');
    reportElement.innerHTML = `
      <p><strong>${user.recentReports[0].type}</strong></p>
      <p>Uploaded on ${user.recentReports[0].date}</p>
      <p>Status: ${user.recentReports[0].status}</p>
    `;
  }

  // Update prescriptions
  if (user.prescriptions && user.prescriptions.length > 0) {
    const activePrescriptions = user.prescriptions.filter(p => p.status === 'active');
    const prescriptionsElement = document.getElementById('prescriptions');
    prescriptionsElement.innerHTML = `
      <p>${activePrescriptions.length} active prescriptions</p>
      ${activePrescriptions.slice(0, 2).map(p => `
        <p><strong>${p.medication}</strong> - ${p.dosage}</p>
      `).join('')}
    `;
  }

  // Update pending bills
  if (user.pendingBills && user.pendingBills.length > 0) {
    const totalDue = user.pendingBills.reduce((sum, bill) => sum + bill.amount, 0);
    const billsElement = document.getElementById('pendingBills');
    billsElement.innerHTML = `
      <p>Total due: ₹${totalDue.toLocaleString()}</p>
      <p>${user.pendingBills.length} unpaid bill(s)</p>
    `;
  }

  // Update recent activity
  if (user.recentActivity && user.recentActivity.length > 0) {
    const activityElement = document.getElementById('recentActivity');
    activityElement.innerHTML = user.recentActivity.map(activity => `
      <div class="activity-item">
        <div class="activity-content">
          <p><strong>${activity.type}</strong> - ${activity.date}</p>
          <p>${activity.description}</p>
        </div>
      </div>
    `).join('');
  }
}

function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.innerHTML = `
    <i class="fas fa-exclamation-circle"></i> ${message}
  `;
  document.querySelector('main').prepend(errorElement);
  
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}