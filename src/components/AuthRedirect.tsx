import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { takeAuthReturnTo } from '../utils/authReturnTo';

export default function AuthRedirect() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const returnTo = takeAuthReturnTo();
      if (returnTo && returnTo !== `${location.pathname}${location.search}`) {
        navigate(returnTo, { replace: true });
        return;
      }

      if (location.pathname === '/login' || location.pathname === '/signup') {
        if (isAdmin) {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    }
  }, [user, isAdmin, loading, navigate, location]);

  return null;
}
