import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import './i18n';
import { Toaster } from 'sonner';
import Header from '@/components/Header';
import WorkspaceProvider from '@/components/workspace/WorkspaceProvider';
import ProtectedWorkspace from '@/components/workspace/ProtectedWorkspace';
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
import PickupPage from '@/pages/PickupPage';
import { ServiceNotice } from '@/components/ServiceLayout';
import AdminSettings from '@/pages/AdminSettings';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminLogin from '@/pages/AdminLogin';
import AdminAccessGate from '@/components/workspace/AdminAccessGate';
import UserDashboard from '@/components/dashboard/UserDashboard';
import AccountRecovery from '@/components/workspace/AccountRecovery';
import ShipmentWizard from '@/components/wizard/ShipmentWizard';
import SuppliesStore from '@/components/store/SuppliesStore';
import ReturnsPortal from '@/components/returns/ReturnsPortal';
import './App.css';
import './service-pages.css';

function CreateShipmentPage() {
  return (
    <div className="min-h-screen bg-fedex-gray py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8 text-center">
          Create a shipment plan
        </h1>
        <div className="max-w-4xl mx-auto mb-7">
          <ServiceNotice title="Planning brief">
            Prepare a plan and download the brief. Labels, bookings, and payment are handled with
            the carrier.
          </ServiceNotice>
        </div>
        <ShipmentWizard />
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="site-container py-20 text-center">
      <h1 className="text-4xl font-light mb-5">We couldn’t find that page</h1>
      <p className="text-gray-600 mb-8">Let’s get you back to shipping, tracking, and more.</p>
      <Link to="/" className="brand-button brand-button-outline">
        Back to home
      </Link>
    </div>
  );
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <WorkspaceProvider>
          <ScrollToTop />
          <div className="min-h-screen bg-white">
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{ style: { fontFamily: 'Roboto, Arial, Helvetica, sans-serif' } }}
            />
            <Header />
            <main id="main-content" className="site-main" tabIndex={-1}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/en-us/home.html" element={<HomePage />} />
                <Route path="/shipping" element={<ShippingPage />} />
                <Route path="/shipping/create" element={<CreateShipmentPage />} />
                <Route path="/shipping/pickup" element={<PickupPage />} />
                <Route path="/tracking" element={<TrackingPage />} />
                <Route path="/design-print" element={<DesignPrintPage />} />
                <Route path="/locations" element={<LocationsPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/account-recovery" element={<AccountRecovery />} />
                <Route path="/rate-calculator" element={<RateCalculator />} />
                <Route
                  path="/admin"
                  element={
                    <AdminAccessGate>
                      <ProtectedWorkspace admin>
                        <AdminDashboard />
                      </ProtectedWorkspace>
                    </AdminAccessGate>
                  }
                />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminAccessGate>
                      <ProtectedWorkspace admin>
                        <AdminSettings />
                      </ProtectedWorkspace>
                    </AdminAccessGate>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedWorkspace>
                      <UserDashboard />
                    </ProtectedWorkspace>
                  }
                />
                <Route path="/store" element={<SuppliesStore />} />
                <Route path="/returns" element={<ReturnsPortal />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
            <LiveChat />
          </div>
        </WorkspaceProvider>
      </Router>
    </MotionConfig>
  );
}

export default App;
