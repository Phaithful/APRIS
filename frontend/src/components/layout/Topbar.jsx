import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, User, LogOut, Menu } from 'lucide-react';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Topbar({ title, user, onLogout, unreadAlerts, onMenuClick }) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 md:left-60 z-20 h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 md:px-6">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-[#6B7280]" />
        </button>
        <h1 className="text-lg font-semibold text-[#1A2332]">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Alerts"
        >
          <Bell size={20} className="text-[#6B7280]" />
          {unreadAlerts > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
              {unreadAlerts > 99 ? '99+' : unreadAlerts}
            </span>
          )}
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#2E7D52] flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {getInitials(user?.name || user?.full_name)}
              </span>
            </div>
            <span className="text-sm font-medium text-[#1A2332] hidden sm:block">
              {user?.name || user?.full_name || 'User'}
            </span>
            <ChevronDown size={14} className="text-[#6B7280]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 z-50">
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#374151] hover:bg-gray-50"
              >
                <User size={14} />
                Profile
              </button>
              <div className="border-t border-[#E5E7EB] my-1" />
              <button
                onClick={() => { setDropdownOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
