import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
  Tooltip,
  Snackbar,
  Alert,
  Fade,
  Dialog,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { supabase } from './lib/supabaseClient';
import FindlyAvatar from './components/common/FindlyAvatar';
import { IosHeader, IosSearchField, IosTabBar } from './components/ios/IosKit';
import Findline from './features/chats/Findline';
import ChatList from './features/chats/ChatList';
import ChatWindow from './features/chats/ChatWindow';
import FriendsList from './features/friends/FriendsList';
import MailCenter from './features/friends/MailCenter';
import CreateChatDialog from './features/groups/CreateChatDialog';
import SettingsTab from './features/settings/SettingsTab';
import IosSettings from './features/settings/IosSettings';
import ProfileTab from './features/profile/ProfileTab';
import { registerBackButton, useBackHandler } from './native';

import Stack from './components/common/Stack';
const CHAT_FIELDS = 'id, type, title, avatar_url, description, slow_mode_seconds, comments_enabled';

const NAV_ITEMS = [
  { label: 'Чаты', icon: <ChatBubbleRoundedIcon /> },
  { label: 'Друзья', icon: <GroupRoundedIcon /> },
  { label: 'Настройки', icon: <SettingsRoundedIcon /> },
  { label: 'Профиль', icon: <PersonRoundedIcon /> },
];

const IOS_TABS = [
  { label: 'Чаты', icon: <ChatBubbleOutlineRoundedIcon />, activeIcon: <ChatBubbleRoundedIcon /> },
  { label: 'Друзья', icon: <PeopleOutlineRoundedIcon />, activeIcon: <GroupRoundedIcon /> },
  { label: 'Настройки', icon: <SettingsOutlinedIcon />, activeIcon: <SettingsRoundedIcon /> },
  { label: 'Профиль', icon: <PersonOutlineRoundedIcon />, activeIcon: <PersonRoundedIcon /> },
];

function NavRail({ value, onChange }) {
  return (
    <Stack
      component="nav"
      sx={{ width: 88, flexShrink: 0, py: 3, gap: 1, alignItems: 'center', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      {NAV_ITEMS.map((item, i) => (
        <Tooltip title={item.label} placement="right" key={item.label}>
          <Stack
            onClick={() => onChange(i)} alignItems="center" spacing={0.5}
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

export default function MainShell({ session, profile, onLogout, onProfileRefresh }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const theme = useTheme();
  const iosMobile = theme.appearance.ios && !isDesktop;
  const myId = session.user.id;
  const username = profile?.username || session?.user?.user_metadata?.username || session?.user?.email;
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  const [nav, setNav] = useState(0);
  const [activeChat, setActiveChat] = useState(null);
  const [chatListRefresh, setChatListRefresh] = useState(0);
  const [friendsRefresh, setFriendsRefresh] = useState(0);
  const [snackbar, setSnackbar] = useState('');
  const [mailAnchor, setMailAnchor] = useState(null);
  const [plusAnchor, setPlusAnchor] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createKind, setCreateKind] = useState(null); // null | 'group' | 'channel'

  useBackHandler(searchOpen, () => setSearchOpen(false));

  // ---------- индикатор непрочитанного (Mail) ----------
  const checkUnread = useCallback(async () => {
    const head = { count: 'exact', head: true };
    const [a, b, c, d] = await Promise.all([
      supabase.from('friend_requests').select('id', head).eq('to_user', myId).eq('status', 'pending').eq('seen_by_recipient', false),
      supabase.from('friend_requests').select('id', head).eq('from_user', myId).eq('seen_by_sender', false).neq('status', 'pending'),
      supabase.from('notifications').select('id', head).eq('user_id', myId).eq('seen', false),
      supabase.from('chat_invites').select('id', head).eq('to_user', myId).eq('status', 'pending'),
    ]);
    setHasUnread(((a.count || 0) + (b.count || 0) + (c.count || 0) + (d.count || 0)) > 0);
  }, [myId]);

  useEffect(() => { checkUnread(); }, [checkUnread]);

  // Заявки, приглашения и уведомления приходят «вживую»
  useEffect(() => {
    const channel = supabase
      .channel(`mail:${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => { checkUnread(); setFriendsRefresh((k) => k + 1); setChatListRefresh((k) => k + 1); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_invites' }, () => checkUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => checkUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, checkUnread]);

  // ---------- открытие чатов ----------
  const openChat = useCallback((chat) => { setActiveChat(chat); setNav(0); }, []);

  async function openChatById(chatId) {
    const { data: c } = await supabase.from('chats').select(CHAT_FIELDS).eq('id', chatId).maybeSingle();
    if (!c) return;
    if (c.type !== 'direct') { openChat(c); return; }
    const { data: participant } = await supabase
      .from('chat_participants').select('user_id').eq('chat_id', chatId).neq('user_id', myId).maybeSingle();
    let other = null;
    if (participant?.user_id) {
      const { data: prof } = await supabase
        .from('profiles').select('id, username, first_name, last_name, avatar_url, restrict_voice, restrict_media')
        .eq('id', participant.user_id).maybeSingle();
      other = prof;
    }
    openChat({ id: chatId, type: 'direct', profile: other });
  }

  function openChatFromFindline(chatId, otherProfile) {
    if (otherProfile) openChat({ id: chatId, type: 'direct', profile: otherProfile });
    else openChatById(chatId);
  }

  const bumpChats = () => setChatListRefresh((k) => k + 1);
  const friendsChanged = () => { checkUnread(); bumpChats(); setFriendsRefresh((k) => k + 1); };

  // ---------- кнопка «Назад» (Android) ----------
  const backState = useRef({});
  backState.current = { activeChat, nav };
  useEffect(() => registerBackButton(() => {
    const s = backState.current;
    if (s.activeChat) { setActiveChat(null); return true; }
    if (s.nav !== 0) { setNav(0); return true; }
    return false;
  }), []);

  // ---------- общие элементы ----------
  const openMail = (e) => { setMailAnchor(e.currentTarget); setHasUnread(false); };

  const bell = (size) => (
    <IconButton onClick={openMail} aria-label="Mail">
      <Box sx={{ position: 'relative', display: 'flex' }}>
        {iosMobile ? <NotificationsNoneRoundedIcon sx={{ fontSize: size, color: 'primary.main' }} /> : <NotificationsRoundedIcon sx={{ fontSize: size }} />}
        {hasUnread && <Box sx={{ position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: '50%', bgcolor: 'error.main', border: '1.5px solid', borderColor: 'background.paper' }} />}
      </Box>
    </IconButton>
  );
  const plusButton = (
    <IconButton onClick={(e) => setPlusAnchor(e.currentTarget)} aria-label="Создать">
      <AddRoundedIcon sx={{ color: iosMobile ? 'primary.main' : undefined }} />
    </IconButton>
  );

  const chatListEl = (
    <ChatList myId={myId} activeChatId={activeChat?.id} onOpenChat={openChat} refreshKey={chatListRefresh} ios={iosMobile} />
  );
  const chatWindowEl = activeChat && (
    <ChatWindow
      key={activeChat.id} chat={activeChat} myId={myId} isDesktop={isDesktop}
      onBack={() => setActiveChat(null)} onChatsChanged={bumpChats}
      onLeft={() => { setActiveChat(null); bumpChats(); }}
    />
  );
  const friendsEl = (
    <FriendsList myId={myId} onOpenChat={openChat} refreshKey={friendsRefresh} ios={iosMobile} onError={setSnackbar} />
  );
  const profileEl = (
    <ProfileTab profile={profile} username={username} onLogout={onLogout} onProfileRefresh={onProfileRefresh} myId={myId} />
  );

  const dialogs = (
    <>
      <MailCenter myId={myId} anchorEl={mailAnchor} onClose={() => setMailAnchor(null)} onFriendsChanged={friendsChanged} />

      <Menu anchorEl={plusAnchor} open={!!plusAnchor} onClose={() => setPlusAnchor(null)}>
        <MenuItem onClick={() => { setPlusAnchor(null); setCreateKind('group'); }}>
          <ListItemIcon><GroupsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Создать группу</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setPlusAnchor(null); setCreateKind('channel'); }}>
          <ListItemIcon><CampaignRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Создать канал</ListItemText>
        </MenuItem>
      </Menu>

      <CreateChatDialog
        open={!!createKind} kind={createKind || 'group'} onClose={() => setCreateKind(null)} myId={myId}
        onCreated={(chatId) => { bumpChats(); openChatById(chatId); }}
      />

      <Dialog fullScreen open={searchOpen} onClose={() => setSearchOpen(false)}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, pt: 'calc(env(safe-area-inset-top, 0px) + 12px)', borderBottom: '0.5px solid', borderColor: 'divider' }}>
          <IconButton onClick={() => setSearchOpen(false)}><ArrowBackRoundedIcon /></IconButton>
          <Box sx={{ flex: 1 }}>
            <Findline
              myId={myId} autoFocus onError={setSnackbar} onFriendsChanged={friendsChanged}
              onOpenChat={(chatId, p) => { openChatFromFindline(chatId, p); setSearchOpen(false); }}
            />
          </Box>
        </Stack>
      </Dialog>

      <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSnackbar('')} sx={{ borderRadius: 4 }}>{snackbar}</Alert>
      </Snackbar>
    </>
  );

  const settingsEl = (
    <SettingsTab
      onLogout={onLogout} myId={myId} profile={profile} email={session.user.email}
      onProfileRefresh={onProfileRefresh} onOpenSearch={() => setSearchOpen(true)}
    />
  );

  // ======================= iOS-раскладка (телефон) =======================
  if (iosMobile) {
    const chatOpen = nav === 0 && !!activeChat;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: 'background.default' }}>
        {chatOpen ? chatWindowEl : (
          <>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {nav === 0 && (
                <>
                  <IosHeader title="Чаты" right={<>{plusButton}{bell(26)}</>} />
                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    <IosSearchField placeholder="Поиск" onClick={() => setSearchOpen(true)} />
                    {chatListEl}
                  </Box>
                </>
              )}
              {nav === 1 && (
                <>
                  <IosHeader title="Друзья" right={bell(26)} />
                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    <IosSearchField placeholder="Найти по @нику" onClick={() => setSearchOpen(true)} />
                    {friendsEl}
                  </Box>
                </>
              )}
              {nav === 2 && (
                <IosSettings
                  profile={profile} username={username} email={session.user.email} myId={myId}
                  onProfileRefresh={onProfileRefresh} onLogout={onLogout}
                  onOpenSearch={() => setSearchOpen(true)} onOpenProfile={() => setNav(3)}
                />
              )}
              {nav === 3 && (
                <>
                  <IosHeader title="Профиль" />
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: (t) => t.m3.groupedBg }}>{profileEl}</Box>
                </>
              )}
            </Box>
            <IosTabBar items={IOS_TABS.map((t, i) => (i === 0 && hasUnread ? { ...t, dot: true } : t))} value={nav} onChange={setNav} />
          </>
        )}
        {dialogs}
      </Box>
    );
  }

  // ======================= ПК и Material-раскладка =======================
  const hideBottomNav = !isDesktop && nav === 0 && !!activeChat;

  return (
    <Box sx={{ display: 'flex', height: '100dvh', bgcolor: 'background.default' }}>
      {isDesktop && <NavRail value={nav} onChange={setNav} />}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!(hideBottomNav) && (
          <AppBar position="static" elevation={0} sx={{ pt: isDesktop ? 0 : 'env(safe-area-inset-top, 0px)' }}>
            <Toolbar sx={{ gap: 1.5 }}>
              {isDesktop ? (
                <>
                  <Typography sx={{ fontFamily: theme.typography.fontFamily, fontWeight: 700, fontSize: 20, mr: 1 }}>Findly</Typography>
                  <Findline myId={myId} onOpenChat={openChatFromFindline} onFriendsChanged={friendsChanged} onError={setSnackbar} />
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Создать группу или канал">{plusButton}</Tooltip>
                  <Tooltip title="Mail — центр уведомлений">{bell(24)}</Tooltip>
                  <FindlyAvatar src={profile?.avatar_url} name={fullName} seed={username} size={36} sx={{ ml: 0.5, cursor: 'pointer' }} onClick={() => setNav(3)} />
                  <Tooltip title="Выйти из аккаунта"><IconButton onClick={onLogout}><LogoutRoundedIcon /></IconButton></Tooltip>
                </>
              ) : (
                <>
                  <Typography sx={{ fontFamily: theme.typography.fontFamily, fontWeight: 700, fontSize: 18 }}>Findly</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Findline — поиск"><IconButton onClick={() => setSearchOpen(true)}><SearchRoundedIcon /></IconButton></Tooltip>
                  <Tooltip title="Создать группу или канал">{plusButton}</Tooltip>
                  <Tooltip title="Mail — центр уведомлений">{bell(24)}</Tooltip>
                  <FindlyAvatar src={profile?.avatar_url} name={fullName} seed={username} size={32} sx={{ ml: 0.5, cursor: 'pointer' }} onClick={() => setNav(3)} />
                </>
              )}
            </Toolbar>
          </AppBar>
        )}

        <Fade in key={nav} timeout={280}>
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflowY: nav === 0 ? 'visible' : 'auto' }}>
            {nav === 0 && (
              <>
                {(isDesktop || !activeChat) && (
                  <Box sx={{ width: isDesktop ? 360 : '100%', flexShrink: 0, borderRight: isDesktop ? '1px solid' : 'none', borderColor: 'divider', overflowY: 'auto' }}>
                    {chatListEl}
                  </Box>
                )}
                {(isDesktop || activeChat) && (
                  activeChat ? chatWindowEl : (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="bodyMedium" color="text.secondary">Выберите чат слева или найдите пользователя через Findline</Typography>
                    </Box>
                  )
                )}
              </>
            )}
            {nav === 1 && <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10 }}>{friendsEl}</Box>}
            {nav === 2 && <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10 }}>{settingsEl}</Box>}
            {nav === 3 && (
              <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, pb: isDesktop ? 4 : 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                {profileEl}
              </Box>
            )}
          </Box>
        </Fade>

        {!isDesktop && !hideBottomNav && (
          <Box sx={{ position: 'relative', px: 2, pb: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', pt: 0.5 }}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 999, border: '1px solid', borderColor: 'divider',
                bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(30,28,40,0.75)' : 'rgba(255,255,255,0.75)'),
                backdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
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

      {dialogs}
    </Box>
  );
}
