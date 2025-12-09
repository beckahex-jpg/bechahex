import { useAuth } from '../contexts/AuthContext';

export function useAuthGuard() {
  const { user, openAuthModal, setPendingAction } = useAuth();

  const requireAuth = (action: () => void, message?: string): boolean => {
    if (!user) {
      setPendingAction(() => action);
      openAuthModal(message || 'Please sign in to continue');
      return false;
    }
    return true;
  };

  const protectedAction = (action: () => void, message?: string) => {
    if (requireAuth(action, message)) {
      action();
    }
  };

  return { requireAuth, protectedAction, isAuthenticated: !!user };
}
