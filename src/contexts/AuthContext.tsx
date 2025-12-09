import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthModalOpen: boolean;
  authMessage: string;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  openAuthModal: (message?: string) => void;
  closeAuthModal: () => void;
  setPendingAction: (action: (() => void) | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [pendingAction, setPendingActionState] = useState<(() => void) | null>(null);
  const { showSuccess } = useToast();

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      console.log('🔍 Admin check in AuthContext:', {
        userId,
        data,
        error,
        role: data?.role,
        isAdmin: data?.role === 'admin'
      });

      const adminStatus = data?.role === 'admin';
      setIsAdmin(adminStatus);
      console.log('✅ Admin status set to:', adminStatus);
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (session) {
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt && expiresAt < now) {
          console.log('Session expired, signing out...');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await checkAdminStatus(session.user.id);
          }
        }
      } else {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await checkAdminStatus(session.user.id);
          }
        }
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setPendingActionState(null);
        } else if (event === 'SIGNED_IN') {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await checkAdminStatus(session.user.id);
          }

          setTimeout(() => {
            if (pendingAction) {
              pendingAction();
              setPendingActionState(null);
            }
            setIsAuthModalOpen(false);
          }, 100);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: undefined,
        },
      });

      if (error) throw error;

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        if (data.user) {
          await checkAdminStatus(data.user.id);
        }
      }

      if (data.user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          const welcomeEmailUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
          await fetch(welcomeEmailUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: data.user.id,
              email: email,
              fullName: fullName,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPendingActionState(null);
    showSuccess('You have been signed out successfully');
  };

  const openAuthModal = (message: string = 'Please sign in to continue') => {
    setAuthMessage(message);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthMessage('');
    setPendingActionState(null);
  };

  const setPendingAction = (action: (() => void) | null) => {
    setPendingActionState(() => action);
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    isAuthModalOpen,
    authMessage,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    openAuthModal,
    closeAuthModal,
    setPendingAction,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
