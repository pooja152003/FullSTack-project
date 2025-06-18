document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication
  const userData = JSON.parse(localStorage.getItem('doctor'));
  if (!userData || !userData.id) {
    window.location.href = 'index.html';
    return;
  }

  // Initialize elements
  const sidebarLinks = document.querySelectorAll('.sidebar-nav li');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');
  const closeModal = document.querySelector('.close-modal');
  const currentTimeElement = document.getElementById('currentTime');
  
  // Set doctor info
  document.getElementById('doctorName').textContent = userData.name || 'Dr. User';
  document.getElementById('doctorSpecialization').textContent = userData.specialization || 'General Physician';
  
  // Update current time
  function updateCurrentTime() {
    const now = new Date();
    currentTimeElement.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  updateCurrentTime();
  setInterval(updateCurrentTime, 60000);
  
  // Navigation
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function() {
      const sectionId = this.getAttribute('data-section');
      showSection(sectionId);
      
      // Update active state
      sidebarLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });
  
  function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.style.display = 'none';
    });
    
    // Show selected section
    const section = document.getElementById(`${sectionId}Section`);
    if (section) {
      section.style.display = 'block';
      document.getElementById('contentTitle').textContent = this.getAttribute('data-section');
      
      // Load section data
      loadSectionData(sectionId);
    }
  }
  
  // Load section data
  async function loadSectionData(sectionId) {
    try {
      showLoading(true);
      
      switch(sectionId) {
        case 'dashboard':
          await loadDashboardData();
          break;
        case 'patients':
          await loadPatientsData();
          break;
        case 'appointments':
          await loadAppointmentsData();
          break;
        case 'prescriptions':
          await loadPrescriptionsData();
          break;
        case 'schedule':
          await loadScheduleData();
          break;
        case 'reports':
          await loadReportsData();
          break;
      }
    } catch (error) {
      console.error(`Error loading ${sectionId} data:`, error);
      showError(`Failed to load ${sectionId} data`);
    } finally {
      showLoading(false);
    }
  }
  
  // Dashboard data
  async function loadDashboardData() {
    // In a real app, you would fetch this from your API
    const response = await fetch(`/api/doctor/dashboard/${userData.id}`);
    const data = await response.json();
    
    // Update stats
    document.getElementById('todayAppointments').textContent = data.todayAppointments || 0;
    document.getElementById('totalPatients').textContent = data.totalPatients || 0;
    document.getElementById('pendingReports').textContent = data.pendingReports || 0;
    document.getElementById('activePrescriptions').textContent = data.activePrescriptions || 0;
    
    // Update today's appointments
    const appointmentsList = document.getElementById('todayAppointmentsList');
    if (data.todaysAppointments && data.todaysAppointments.length > 0) {
      appointmentsList.innerHTML = data.todaysAppointments.map(appt => `
        <div class="appointment-item">
          <div class="appointment-time">${appt.time}</div>
          <div class="appointment-details">
            <div class="appointment-patient">${appt.patientName}</div>
            <div class="appointment-reason">${appt.reason}</div>
          </div>
          <div class="appointment-status status-${appt.status}">${appt.status}</div>
        </div>
      `).join('');
    } else {
      appointmentsList.innerHTML = '<p>No appointments scheduled for today</p>';
    }
    
    // Update recent patients
    const patientsList = document.getElementById('recentPatientsList');
    if (data.recentPatients && data.recentPatients.length > 0) {
      patientsList.innerHTML = data.recentPatients.map(patient => `
        <div class="patient-item">
          <img src="${patient.avatar || 'images/patient-avatar.png'}" alt="${patient.name}" class="patient-avatar">
          <div class="patient-details">
            <div class="patient-name">${patient.name}</div>
            <div class="patient-condition">${patient.condition}</div>
          </div>
          <div class="patient-status status-${patient.status.toLowerCase()}">${patient.status}</div>
        </div>
      `).join('');
    } else {
      patientsList.innerHTML = '<p>No recent patients</p>';
    }
  }
  
  // Patients data
  async function loadPatientsData() {
    const response = await fetch(`/api/doctor/patients/${userData.id}`);
    const data = await response.json();
    
    const tableBody = document.querySelector('#patientsTable tbody');
    tableBody.innerHTML = data.patients.map(patient => `
      <tr>
        <td>${patient.id}</td>
        <td>${patient.name}</td>
        <td>${patient.age}</td>
        <td>${patient.condition}</td>
        <td>${patient.lastVisit}</td>
        <td><span class="status-badge status-${patient.status.toLowerCase()}">${patient.status}</span></td>
        <td class="table-actions">
          <button class="btn outline" data-action="view" data-id="${patient.id}">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn outline" data-action="edit" data-id="${patient.id}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  // Other data loading functions would be similar
  async function loadAppointmentsData() {
    // Implementation would fetch and display appointments
  }
  
  async function loadPrescriptionsData() {
    // Implementation would fetch and display prescriptions
  }
  
  async function loadScheduleData() {
    // Implementation would fetch and display schedule
  }
  
  async function loadReportsData() {
    // Implementation would fetch and display reports
  }
  
  // Logout functionality
  logoutBtn.addEventListener('click', () => {
    logoutModal.style.display = 'flex';
  });
  
  cancelLogout.addEventListener('click', () => {
    logoutModal.style.display = 'none';
  });
  
  confirmLogout.addEventListener('click', () => {
    localStorage.removeItem('doctor');
    window.location.href = 'index.html';
  });
  
  closeModal.addEventListener('click', () => {
    logoutModal.style.display = 'none';
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === logoutModal) {
      logoutModal.style.display = 'none';
    }
  });
  
  // Helper functions
  function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
  }
  
  function showError(message) {
    // You could implement a more sophisticated error display
    alert(message);
  }
  
  // Initialize with dashboard
  showSection('dashboard');
});