import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { authUpdateProfile, authChangePassword } from '../services/api.js';

const profileSchema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password:     z.string().min(8, 'New password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export default function Profile() {
  const { user, login } = useAuth();
  const [profileSaved, setProfileSaved]     = useState(false);
  const [showCurrent,  setShowCurrent]      = useState(false);
  const [showNew,      setShowNew]          = useState(false);
  const [showConfirm,  setShowConfirm]      = useState(false);

  // ── Profile form ──────────────────────────────────────────────────────────
  const {
    register: regP,
    handleSubmit: handleP,
    formState: { errors: errP, isSubmitting: savingP },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:  user?.name || user?.full_name || '',
      email: user?.email || '',
    },
  });

  const onSaveProfile = async (data) => {
    try {
      const res = await authUpdateProfile(data);
      const updated = res.data.user;
      login(updated);          // update auth context so name/email refresh everywhere
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    }
  };

  // ── Password form ─────────────────────────────────────────────────────────
  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    formState: { errors: errPw, isSubmitting: savingPw },
  } = useForm({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (data) => {
    try {
      await authChangePassword({
        current_password: data.current_password,
        new_password:     data.new_password,
      });
      toast.success('Password changed successfully');
      resetPw();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    }
  };

  const initials = (user?.name || user?.full_name || '?')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar header */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#2E7D52] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-2xl font-bold">{initials}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1A2332]">
            {user?.name || user?.full_name || 'Your Profile'}
          </h2>
          <p className="text-sm text-[#6B7280]">{user?.email}</p>
          <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#2E7D52] capitalize">
            {user?.role || 'farmer'}
          </span>
        </div>
      </div>

      {/* Personal info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] flex items-center justify-center">
            <User size={16} className="text-[#2E7D52]" />
          </div>
          <h3 className="text-base font-semibold text-[#1A2332]">Personal Information</h3>
        </div>

        <form onSubmit={handleP(onSaveProfile)} className="space-y-4">
          <div>
            <label className="form-label">Full name</label>
            <input
              {...regP('name')}
              className={`form-input ${errP.name ? 'border-red-400' : ''}`}
              placeholder="Your full name"
            />
            {errP.name && <p className="text-red-500 text-xs mt-1">{errP.name.message}</p>}
          </div>

          <div>
            <label className="form-label">Email address</label>
            <input
              {...regP('email')}
              type="email"
              className={`form-input ${errP.email ? 'border-red-400' : ''}`}
              placeholder="you@example.com"
            />
            {errP.email && <p className="text-red-500 text-xs mt-1">{errP.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={savingP}
            className="btn-primary"
          >
            {savingP ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : profileSaved ? (
              <>
                <CheckCircle2 size={16} />
                Saved
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] flex items-center justify-center">
            <Lock size={16} className="text-[#2E7D52]" />
          </div>
          <h3 className="text-base font-semibold text-[#1A2332]">Change Password</h3>
        </div>

        <form onSubmit={handlePw(onChangePassword)} className="space-y-4">
          {[
            { key: 'current_password', label: 'Current password',  show: showCurrent, toggle: () => setShowCurrent(v => !v) },
            { key: 'new_password',     label: 'New password',      show: showNew,     toggle: () => setShowNew(v => !v)     },
            { key: 'confirm_password', label: 'Confirm new password', show: showConfirm, toggle: () => setShowConfirm(v => !v) },
          ].map(({ key, label, show, toggle }) => (
            <div key={key}>
              <label className="form-label">{label}</label>
              <div className="relative">
                <input
                  {...regPw(key)}
                  type={show ? 'text' : 'password'}
                  className={`form-input pr-11 ${errPw[key] ? 'border-red-400' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errPw[key] && <p className="text-red-500 text-xs mt-1">{errPw[key].message}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={savingPw}
            className="btn-primary"
          >
            {savingPw ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
