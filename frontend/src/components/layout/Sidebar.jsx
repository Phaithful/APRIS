import { useNavigate, useLocation } from 'react-router-dom';
import AprisChickenIcon from '../ui/AprisChickenIcon';
import { X } from 'lucide-react';
import {
  LayoutDashboard,
  Camera,
  BarChart2,
  Building2,
  Bell,
  BookOpen,
  Shield,
  LogOut,
  Bot,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Image Analysis', icon: Camera, path: '/image-analysis' },
  { label: 'Analytics', icon: BarChart2, path: '/analytics' },
  { label: 'Farm Manager', icon: Building2, path: '/farms' },
  { label: 'Alerts', icon: Bell, path: '/alerts', badge: true },
  { label: 'AI Assistant', icon: Bot, path: '/ai-chat' },
  { label: 'Disease Encyclopedia', icon: BookOpen, path: '/encyclopedia' },
];

const adminItem = { label: 'Admin Panel', icon: Shield, path: '/admin' };

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar({ user, onLogout, selectedFarm, unreadAlerts, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = user?.role === 'admin' ? [...navItems, adminItem] : navItems;

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 w-60 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      style={{ backgroundColor: '#1A2332' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2E7D52] flex items-center justify-center flex-shrink-0">
              <AprisChickenIcon size={16} />
            </div>
            <span className="text-white font-bold text-xl tracking-wide">APRIS</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 px-1">
          <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-medium">Current Farm</p>
          <p className="text-[#94A3B8] text-sm font-medium truncate mt-0.5">
            {selectedFarm?.name || 'No farm selected'}
          </p>
        </div>
      </div>

      <div className="mx-4 border-t border-white/10 mb-2" />

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150 text-left relative ${
                active
                  ? 'text-white'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
              style={
                active
                  ? {
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderLeft: '4px solid #2E7D52',
                    }
                  : { borderLeft: '4px solid transparent' }
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && unreadAlerts > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadAlerts > 99 ? '99+' : unreadAlerts}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-white/10 mt-2" />

      {/* User footer */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#2E7D52] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{getInitials(user?.name || user?.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name || user?.full_name || 'User'}</p>
            <p className="text-[#64748B] text-xs capitalize truncate">{user?.role || 'farmer'}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all duration-150 text-sm"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}
