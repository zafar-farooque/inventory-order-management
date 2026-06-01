import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Navbar      from './components/Navbar';
import Dashboard   from './pages/Dashboard.jsx';
import Products    from './pages/Products.jsx';
import Customers   from './pages/Customers.jsx';
import Orders      from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Navbar />
        <main className="page-content">
          <Routes>
            <Route path="/"           element={<Dashboard />}   />
            <Route path="/products"   element={<Products />}    />
            <Route path="/customers"  element={<Customers />}   />
            <Route path="/orders"     element={<Orders />}      />
            <Route path="/orders/:id" element={<OrderDetail />} />

            {/* Fallback — redirect unknown paths to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
