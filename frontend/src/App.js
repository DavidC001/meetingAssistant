import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import MeetingsDashboard from './components/MeetingsDashboard';
import MeetingDetails from './components/MeetingDetails';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>Meeting Assistant</h1>
          </Link>
        </header>
        <main className="container">
          <Routes>
            <Route path="/" element={<MeetingsDashboard />} />
            <Route path="/meetings/:meetingId" element={<MeetingDetails />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
