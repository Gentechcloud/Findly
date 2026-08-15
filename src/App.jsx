import { useState, useEffect } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Paper, Stack,
  Button, Card, CardContent, Switch, FormControlLabel, Divider,
  BottomNavigation, BottomNavigationAction, useMediaQuery, Tooltip,
  CircularProgress, Snackbar, Alert, Fade, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { supabase } from './lib/supabaseClient';
import AuthPage from './features/auth/AuthPage';
import OnboardingPage from './features/profile/OnboardingPage';
import FindlyAvatar from './components/common/FindlyAvatar';
import { useColorMode } from './theme/ThemeProvider';
import { accentPresets } from './theme/accentPresets';
import Findline from './features/chats/Findline';
import ChatList from './features/chats/ChatList';
import ChatWindow from './features/chats/ChatWindow';
import FriendsList from './features/friends/FriendsList';
import MailCenter from './features/friends/MailCenter';

const NAV_ITEMS = [
  { label: 'Чаты', icon: <ChatBubbleRoundedIcon /> },
  { label: 'Друзья', icon: <GroupRoundedIcon /> },
  { label: 'Настройки', icon: <SettingsRoundedIcon /> },
  { label: 'Профиль', icon: <PersonRoundedIcon /> },
];

function NavRail({ value, onChange }) {
  return (
    <Stack
      component="nav"
      sx={{
        width: 88, flexShrink: 0, py: 3, gap: 1, alignItems: 'center',
        borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
      }}
    >
      {NAV_ITEMS.map((item, i) => (
        <Tooltip title={item.label} placement="right" key={item.label}>
          <Stack
            onClick={() => onChange(i)}
            alignItems="center" spacing={0.5}
            sx={{
              cursor: 'pointer', px: 2, py: 1, borderRadius: 999,
              bgcolor: value === i ? 'primary.container' : 'transparent',
              color: value === i ? 'primary.onContainer' : 'text.secondary',
              transition: 'background-color .15s ease, transform .15s ease',
              '&:hover': { bgcolor: value === i ? 'primary.container' : 'action.hover' },
              '&:active': { transform: 'scale(0.94)' },
            }}
          >
            {item.icon}
          </Stack>
        </Tooltip>
      ))}
    </Stack>
  );
}

function SettingsTab({ resolvedMode, setMode, accent, setAccent, onLogout }) {
  return (
    <Stack spacing={3} sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="headlineSmall">Настройки</Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="titleMedium">Тема оформления</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={resolvedMode === 'dark'}
                  onChange={(e) => setMode(e.target.checked ? 'dark' : 'light')}
                  icon={<LightModeRoundedIcon sx={{ fontSize: 16, p: 0.2 }} />}
                  checkedIcon={<DarkModeRoundedIcon sx={{ fontSize: 16, p: 0.2 }} />}
                />
              }
              label={resolvedMode === 'dark' ? 'Тёмная' : 'Светлая'}
            />
          </Stack>
          <Typography variant="bodyMedium" color="text.secondary" gutterBottom>Акцентный цвет</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {accentPresets.map((p) => (
              <Tooltip title={p.name} key={p.name}>
                <Box
                  onClick={() => setAccent(p)}
                  sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: p.primary, cursor: 'pointer',
                    border: accent?.primary === p.primary ? '3px solid' : '2px solid transparent',
                    borderColor: accent?.primary === p.primary ? 'text.primary' : 'transparent',
                    transition: 'transform .1s ease', '&:hover': { transform: 'scale(1.08)' },
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="titleMedium" gutterBottom>Аккаунт</Typography>
          <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 2 }}>
            Смена пароля, ника, почты, приватность и ограничения чата появятся здесь на Этапе 8.
          </Typography>
          <Button variant="outlined" color="error" onClick={onLogout} sx={{ borderColor: 'error.main', color: 'error.main' }}>
            Выйти из аккаунта
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ProfileTab({ profile, username, onLogout }) {
  return (
    <Stack spacing={3} sx={{ maxWidth: 480, mx: 'auto', alignItems: 'center', textAlign: 'center' }}>
      <FindlyAvatar src={profile?.avatar_url} name={`${profile?.first_name || ''} ${profile?.last_name || ''}`} seed={username} size={96} />
      <Stack spacing={0.5}>
        <Typography variant="headlineSmall">{profile?.first_name} {profile?.last_name}</Typography>
        <Typography variant="bodyMedium" color="text.secondary">@{username}</Typography>
      </Stack>
      {profile?.bio && <Typography variant="bodyMedium">{profile.bio}</Typography>}
      <Typography variant="bodySmall" color="text.secondary">
        Редактирование профиля, публикация фото/видео и лента в стиле Instagram появятся на Этапе 9.
      </Typography>
      <Button variant="outlined" color="error" onClick={onLogout} sx={{ borderColor: 'error.main', color: 'error.main' }}>
        Выйти из аккаунта
      </Button>
    </Stack>
  );
}

function MainShell({ session, profile, onLogout }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const [nav, setNav] = useState(0);
  const { mode, setMode, resolvedMode, accent, setAccent } = useColorMode();
  const username = session?.user?.user_metadata?.username || session?.user?.email;
  const myId = session.user.id;

  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatProfile, setActiveChatProfile] = useState(null);
  const [chatListRefresh, setChatListRefresh] = useState(0);
  const [snackbar, setSnackbar] = useState('');
  const [mailAnchor, setMailAnchor] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  async function checkUnread() {
    const { count: c1 } = await supabase.from('friend_requests').select('id', { count: 'exact', head: true })
      .eq('to_user', myId).eq('status', 'pending').eq('seen_by_recipient', false);
    const { count: c2 } = await supabase.from('friend_requests').select('id', { count: 'exact', head: true })
      .eq('from_user', myId).eq('seen_by_sender', false).neq('status', 'pending');
    setHasUnread((c1 || 0) + (c2 || 0) > 0);
  }
  useEffect(() => { checkUnread(); }, [myId]);

  async function openChatById(chatId) {
    const { data } = await supabase
      .from('chat_participants')
      .select('profiles:user_id (id, username, first_name, last_name, avatar_url)')
      .eq('chat_id', chatId)
      .neq('user_id', myId)
      .maybeSingle();
    setActiveChatId(chatId);
    setActiveChatProfile(data?.profiles || null);
    setNav(0);
  }

  function openChatFromFindline(chatId, otherProfile) {
    if (otherProfile) {
      setActiveChatId(chatId);
      setActiveChatProfile(otherProfile);
      setNav(0);
    } else {
      openChatById(chatId);
    }
  }

  function openChatWithProfile(chatId, otherProfile) {
    setActiveChatId(chatId);
    setActiveChatProfile(otherProfile);
  }

  return (
    <Box sx={{ display: 'flex', height: '100dvh', bgcolor: 'background.default' }}>
      {isDesktop && <NavRail value={nav} onChange={setNav} />}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="static" elevation={0}>
          <Toolbar sx={{ gap: 1.5 }}>
            <Typography sx={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, mr: 1 }}>
              Findly
            </Typography>

            <Findline
              myId={myId}
              onOpenChat={openChatFromFindline}
              onFriendsChanged={() => { checkUnread(); setChatListRefresh((k) => k + 1); }}
              onError={setSnackbar}
            />

            <Box sx={{ flex: 1 }} />
            <Tooltip title="Создать группу или канал">
              <IconButton onClick={() => setComingSoonOpen(true)}><AddRoundedIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Mail — центр уведомлений">
              <IconButton onClick={(e) => { setMailAnchor(e.currentTarget); setHasUnread(false); }}>
                <Box sx={{ position: 'relative' }}>
                  <NotificationsRoundedIcon />
                  {hasUnread && <Box sx={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />}
                </Box>
              </IconButton>
            </Tooltip>
            <FindlyAvatar src={profile?.avatar_url} name={`${profile?.first_name || ''} ${profile?.last_name || ''}`} seed={username} size={36} sx={{ ml: 0.5 }} onClick={() => setNav(3)} style={{ cursor: 'pointer' }} />
            <Tooltip title="Выйти из аккаунта">
              <IconButton onClick={onLogout}><LogoutRoundedIcon /></IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <MailCenter myId={myId} anchorEl={mailAnchor} onClose={() => setMailAnchor(null)} onFriendsChanged={() => { checkUnread(); setChatListRefresh((k) => k + 1); }} />

        <Fade in key={nav} timeout={280}>
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflowY: nav === 0 ? 'visible' : 'auto' }}>
            {nav === 0 && (
              <>
                {(isDesktop || !activeChatId) && (
                  <Box sx={{ width: isDesktop ? 360 : '100%', flexShrink: 0, borderRight: isDesktop ? '1px solid' : 'none', borderColor: 'divider', overflowY: 'auto' }}>
                    <ChatList myId={myId} activeChatId={activeChatId} onOpenChat={openChatWithProfile} refreshKey={chatListRefresh} />
                  </Box>
                )}
                {(isDesktop || activeChatId) && (
                  activeChatId ? (
                    <ChatWindow key={activeChatId} chatId={activeChatId} otherProfile={activeChatProfile} myId={myId} isDesktop={isDesktop} onBack={() => setActiveChatId(null)} />
                  ) : (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="bodyMedium" color="text.secondary">Выберите чат слева или найдите пользователя через Findline</Typography>
                    </Box>
                  )
                )}
              </>
            )}
            {nav === 1 && (
              <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10 }}>
                <FriendsList myId={myId} onOpenChat={openChatWithProfile} refreshKey={chatListRefresh} />
              </Box>
            )}
            {nav === 2 && (
              <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10 }}>
                <SettingsTab resolvedMode={resolvedMode} setMode={setMode} accent={accent} setAccent={setAccent} onLogout={onLogout} />
              </Box>
            )}
            {nav === 3 && (
              <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <ProfileTab profile={profile} username={username} onLogout={onLogout} />
              </Box>
            )}
          </Box>
        </Fade>

        {!isDesktop && (
          <Box sx={{ position: 'relative', px: 2, pb: 1.5, pt: 0.5 }}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 999, border: '1px solid', borderColor: 'divider',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(30,28,40,0.75)' : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
              }}
            >
              <BottomNavigation
                value={nav} onChange={(e, v) => setNav(v)} showLabels
                sx={{
                  height: 62, bgcolor: 'transparent',
                  '& .MuiBottomNavigationAction-root': { minWidth: 0, transition: 'transform .25s cubic-bezier(0.34,1.56,0.64,1), color .2s ease' },
                  '& .Mui-selected': { transform: 'translateY(-2px) scale(1.05)' },
                }}
              >
                {NAV_ITEMS.map((item) => <BottomNavigationAction key={item.label} label={item.label} icon={item.icon} />)}
              </BottomNavigation>
            </Paper>
          </Box>
        )}
      </Box>

      <Dialog open={comingSoonOpen} onClose={() => setComingSoonOpen(false)} PaperProps={{ sx: { borderRadius: 5 } }}>
        <DialogTitle>Скоро</DialogTitle>
        <DialogContent>
          <Typography variant="bodyMedium">Создание групп и каналов появится на Этапе 6 — сейчас над этим работаем.</Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setComingSoonOpen(false)}>Понятно</Button></DialogActions>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSnackbar('')} sx={{ borderRadius: 4 }}>{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
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
    return <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
  }
  if (!session) return <AuthPage onAuthed={() => {}} />;
  if (profile && !profile.onboarding_completed) return <OnboardingPage session={session} onDone={() => loadProfile(session.user.id)} />;

  return <MainShell session={session} profile={profile} onLogout={() => supabase.auth.signOut()} />;
}
