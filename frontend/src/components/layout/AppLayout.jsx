import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FarmProvider, useFarmContext } from '../../context/FarmContext.jsx';
import { getAlerts, markAllRead } from '../../services/alertService.js';
import { Bot } from 'lucide-react';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/image-analysis': 'Image Analysis',
  '/analytics': 'Analytics',
  '/farms': 'Farm Manager',
  '/alerts': 'Alerts',
  '/encyclopedia': 'Disease Encyclopedia',
  '/admin': 'Admin Panel',
  '/profile': 'My Profile',
  '/ai-chat': 'AI Assistant',
};

function AppLayoutInner() {
  const { user, logout } = useAuth();
  const { selectedFarm } = useFarmContext();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Mark all alerts as read when the user navigates AWAY from the Alerts page
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev === '/alerts' && location.pathname !== '/alerts') {
      markAllRead().then(() => setUnreadAlerts(0)).catch(() => {});
    }
  }, [location.pathname]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getAlerts({ unread_only: 'true', limit: 1 });
      setUnreadAlerts(data?.unread_count || 0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    // Refresh immediately when a detection fires an alert
    window.addEventListener('alerts:refresh', fetchUnreadCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener('alerts:refresh', fetchUnreadCount);
    };
  }, [fetchUnreadCount]);

  const pageTitle = pageTitles[location.pathname] || 'APRIS';

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <Sidebar
        user={user}
        onLogout={logout}
        selectedFarm={selectedFarm}
        unreadAlerts={unreadAlerts}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Topbar
        title={pageTitle}
        user={user}
        onLogout={logout}
        unreadAlerts={unreadAlerts}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <main className="min-h-screen p-4 md:p-6 md:ml-60 mt-16">
        <Outlet />
      </main>

      {/* Floating AI assistant button — hidden when already on the AI chat page */}
      {location.pathname !== '/ai-chat' && (
        <button
          onClick={() => navigate('/ai-chat')}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#2E7D52] text-white shadow-lg hover:bg-[#245F40] hover:scale-105 transition-all duration-200 flex items-center justify-center"
          title="APRIS AI Assistant"
          aria-label="Open AI Assistant"
        >
          <Bot size={24} />
        </button>
      )}
    </div>
  );
}

export default function AppLayout() {
  return (
    <FarmProvider>
      <AppLayoutInner />
    </FarmProvider>
  );
}
