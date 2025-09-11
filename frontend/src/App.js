import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import MeetingsDashboard from './components/MeetingsDashboard';
import MeetingDetails from './components/MeetingDetails';
import Settings from './components/Settings';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h1>Meeting Assistant</h1>
            </Link>
            <nav className="header-nav">
              <Link to="/" className="nav-link">Dashboard</Link>
              <Link to="/settings" className="nav-link">Settings</Link>
            </nav>
          </div>
        </header>
        <main className="container">
          <Routes>
            <Route path="/" element={<MeetingsDashboard />} />
            <Route path="/meetings/:meetingId" element={<MeetingDetails />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
