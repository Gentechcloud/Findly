import { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { supabase } from './lib/supabaseClient';
import AuthPage from './features/auth/AuthPage';
import OnboardingPage from './features/profile/OnboardingPage';
import MainShell from './MainShell';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ещё загружается
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data || null);
  }

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(undefined); return; }
    loadProfile(session.user.id);
  }, [session]);

  if (session === undefined || (session && profile === undefined)) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!session) return <AuthPage onAuthed={() => {}} />;
  if (profile && !profile.onboarding_completed) {
    return <OnboardingPage session={session} onDone={() => loadProfile(session.user.id)} />;
  }

  return (
    <MainShell
      session={session} profile={profile}
      onLogout={() => supabase.auth.signOut()}
      onProfileRefresh={() => loadProfile(session.user.id)}
    />
  );
}
