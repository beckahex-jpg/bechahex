import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveAuthReturnTo } from '../utils/authReturnTo';

export function useProtectedRoute(
  message = 'Please sign in to continue',
  fallbackPath = '/'
) {
  const { user, loading: authLoading, openAuthModal, setPendingAction } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || user) return;

    const returnTo = `${location.pathname}${location.search}`;
    saveAuthReturnTo(returnTo);
    setPendingAction(() => {
      navigate(returnTo, { replace: true });
    });
    openAuthModal(message);

    if (returnTo !== fallbackPath) {
      navigate(fallbackPath, { replace: true });
    }
  }, [
    authLoading,
    fallbackPath,
    location.pathname,
    location.search,
    message,
    navigate,
    openAuthModal,
    setPendingAction,
    user,
  ]);

  return { user, authLoading };
}
