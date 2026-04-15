import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AprisChickenIcon from '../components/ui/AprisChickenIcon';
import toast from 'react-hot-toast';
import { authLogin } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await authLogin(data);
      const userData = res.data.user || res.data;
      login(userData);
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'AI-powered disease risk assessment',
    'Real-time image analysis via CNN',
    'Environmental factor monitoring',
    'Personalised mitigation plans',
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Branding panel — compact on mobile, full height on desktop */}
      <div
        className="flex flex-col items-center justify-center px-8 py-10 lg:w-1/2 lg:p-12"
        style={{ backgroundColor: '#1A2332' }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#2E7D52] flex items-center justify-center shadow-lg">
              <AprisChickenIcon size={32} />
            </div>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2 tracking-tight">APRIS</h1>
          <p className="text-[#94A3B8] text-base font-medium">Adaptive Poultry Risk</p>
          <p className="text-[#94A3B8] text-base font-medium">Intelligent System</p>
          {/* Feature list — desktop only */}
          <div className="hidden lg:block mt-12 space-y-4 text-left">
            {features.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#2E7D52] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[#94A3B8] text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center bg-white px-6 py-10 lg:p-8">
        <div className="w-full max-w-[400px]">
          <h2 className="text-2xl font-bold text-[#1A2332] mb-1">Sign in</h2>
          <p className="text-[#6B7280] text-sm mb-8">Access your poultry monitoring dashboard</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                autoComplete="email"
                className={`form-input ${errors.email ? 'border-red-400' : ''}`}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`form-input pr-11 ${errors.password ? 'border-red-400' : ''}`}
                  placeholder="Your password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={16} />
                  Sign in
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#6B7280] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#2E7D52] font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
