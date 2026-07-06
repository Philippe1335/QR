import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ClientPayment from './pages/ClientPayment.jsx';
import RestaurantDashboard from './pages/RestaurantDashboard.jsx';
import TableManage from './pages/TableManage.jsx';
import QRCodesPage from './pages/QRCodesPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pay" element={<ClientPayment />} />
      <Route path="/admin" element={<RestaurantDashboard />} />
      <Route path="/admin/table/:id" element={<TableManage />} />
      <Route path="/admin/qr" element={<QRCodesPage />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
