import React from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const summaryData = {
    patients: 156,
    upcomingAppointments: 23,
    pendingVaccinations: 18,
    developmentalScreenings: 12,
    activePlans: 143
  };

  return (
    <div className="dashboard">
      <h2>Pediatric Care Dashboard</h2>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Patients</h3>
          <p className="summary-value">{summaryData.patients}</p>
          <Link to="/patients">View all patients</Link>
        </div>

        <div className="summary-card">
          <h3>Upcoming Appointments</h3>
          <p className="summary-value">{summaryData.upcomingAppointments}</p>
          <Link to="/appointments">Manage appointments</Link>
        </div>

        <div className="summary-card">
          <h3>Pending Vaccinations</h3>
          <p className="summary-value">{summaryData.pendingVaccinations}</p>
          <Link to="/vaccinations">View vaccination schedule</Link>
        </div>

        <div className="summary-card">
          <h3>Developmental Screenings Due</h3>
          <p className="summary-value">{summaryData.developmentalScreenings}</p>
          <Link to="/screenings">View screening schedule</Link>
        </div>

        <div className="summary-card">
          <h3>Active Care Plans</h3>
          <p className="summary-value">{summaryData.activePlans}</p>
          <Link to="/care-plans">Manage care plans</Link>
        </div>
      </div>

      <div className="dashboard-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <Link to="/plan-definitions/create" className="action-button">Create New Protocol</Link>
          <Link to="/patients/create" className="action-button">Add New Patient</Link>
          <Link to="/care-plans/create" className="action-button">Generate Care Plan</Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;