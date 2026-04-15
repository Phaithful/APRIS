import { createContext, useContext, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authMe, authLogout } from '../services/api.js';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  loading: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'LOGOUT':
      return { ...state, user: null, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await authMe();
        dispatch({ type: 'SET_USER', payload: response.data.user || response.data });
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch({ type: 'LOGOUT' });
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  const login = (userData) => {
    dispatch({ type: 'SET_USER', payload: userData });
  };

  const logout = async () => {
    try {
      await authLogout();
    } catch {
      // ignore error on logout
    }
    dispatch({ type: 'LOGOUT' });
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user: state.user, loading: state.loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
