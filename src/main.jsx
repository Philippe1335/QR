import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/Home.jsx';
import TableHome from './pages/TableHome.jsx';
import MenuView from './pages/MenuView.jsx';
import CallServer from './pages/CallServer.jsx';
import Checkout from './pages/Checkout.jsx';
import Feedback from './pages/Feedback.jsx';
import ServerView from './pages/ServerView.jsx';
import Dashboard from './pages/Dashboard.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table" element={<TableHome />} />
        <Route path="/menu" element={<MenuView />} />
        <Route path="/call-server" element={<CallServer />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/server-view" element={<ServerView />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
