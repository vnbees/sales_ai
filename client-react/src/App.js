import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SellerChat from './pages/SellerChat';
import BuyerChat from './pages/BuyerChat';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/seller" element={<SellerChat />} />
        <Route path="/buyer/:productId" element={<BuyerChat />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
