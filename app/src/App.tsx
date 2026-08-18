import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './i18n';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LiveChat from '@/components/chat/LiveChat';
import HomePage from '@/pages/HomePage';
import ShippingPage from '@/pages/ShippingPage';
import TrackingPage from '@/pages/TrackingPage';
import DesignPrintPage from '@/pages/DesignPrintPage';
import LocationsPage from '@/pages/LocationsPage';
import SupportPage from '@/pages/SupportPage';
import LoginPage from '@/pages/LoginPage';
import RateCalculator from '@/pages/RateCalculator';
import AdminSettings from '@/pages/AdminSettings';
import AdminLogin from '@/pages/AdminLogin';
import ShipmentWizard from '@/components/wizard/ShipmentWizard';
import UserDashboard from '@/components/dashboard/UserDashboard';
import SuppliesStore from '@/components/store/SuppliesStore';
import ReturnsPortal from '@/components/returns/ReturnsPortal';
import './App.css';

// Create Shipment Page wrapper
function CreateShipmentPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-fedex-gray py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8 text-center">{t('shipment.title')}</h1>
        <ShipmentWizard />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              fontFamily: 'Arial, Helvetica, sans-serif',
            },
          }}
        />
        <Header />
        
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/shipping/create" element={<CreateShipmentPage />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/design-print" element={<DesignPrintPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/rate-calculator" element={<RateCalculator />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/store" element={<SuppliesStore />} />
            <Route path="/returns" element={<ReturnsPortal />} />
          </Routes>
        </main>
        
        <Footer />
        <LiveChat />
      </div>
    </Router>
  );
}

export default App;
