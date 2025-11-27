import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthRedirect() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const publicRoutes = ['/', '/product'];
      const isPublicRoute = publicRoutes.some(route =>
        location.pathname === route || location.pathname.startsWith(route + '/')
      );

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
