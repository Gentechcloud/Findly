import { useEffect, useState } from 'react';
import {
  Box, Stack, Typography, List, ListItemButton, CircularProgress, IconButton,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import ProfileViewDialog from '../../components/common/ProfileViewDialog';

export default function FriendsList({ myId, onOpenChat, refreshKey }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(null); // { anchorEl, friend }
  const [viewingProfile, setViewingProfile] = useState(null);

  async function load() {
    setLoading(true);
    const { data: rels, error } = await supabase
      .from('friend_requests')
      .select('from_user, to_user')
      .eq('status', 'accepted')
      .or(`from_user.eq.${myId},to_user.eq.${myId}`);

    if (error) console.error('FriendsList error:', error);

    const friendIds = (rels || []).map((r) => (r.from_user === myId ? r.to_user : r.from_user));
    if (friendIds.length === 0) { setFriends([]); setLoading(false); return; }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, avatar_url, bio, restrict_voice, restrict_media')
      .in('id', friendIds);

    setFriends(profs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [myId, refreshKey]);

  async function openChat(friendProfile) {
    const { data, error } = await supabase.rpc('start_direct_chat', { other_username: friendProfile.username });
    if (!error) onOpenChat(data, friendProfile);
  }

  async function handleRemove() {
    const friend = menu.friend;
    setMenu(null);
    const { error } = await supabase.rpc('remove_friend', { target_username: friend.username });
    if (!error) setFriends((prev) => prev.filter((f) => f.id !== friend.id));
  }

  async function handleBlock() {
    const friend = menu.friend;
    setMenu(null);
    await supabase.from('blocked_users').insert({ blocker_id: myId, blocked_id: friend.id });
    // Блокировка молча разрывает дружбу — собеседник не получает об этом уведомления.
    await supabase.from('friend_requests').delete()
      .eq('status', 'accepted')
      .or(`and(from_user.eq.${myId},to_user.eq.${friend.id}),and(from_user.eq.${friend.id},to_user.eq.${myId})`);
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
  }

  if (loading) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;
  }

  if (friends.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
        <Typography variant="titleMedium" gutterBottom>Пока нет друзей</Typography>
        <Typography variant="bodyMedium" color="text.secondary">
          Найдите человека через Findline (введите @ник в поиске наверху) и нажмите «Добавить в друзья».
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List disablePadding sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 560, mx: 'auto' }}>
        {friends.map((f) => (
          <ListItemButton key={f.id} onClick={() => openChat(f)} sx={{ py: 1.25, px: 1.5, gap: 1.5, borderRadius: 4 }}>
            <FindlyAvatar src={f.avatar_url} name={`${f.first_name || ''} ${f.last_name || ''}`} seed={f.username} size={48} />
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="titleSmall" noWrap>{f.first_name} {f.last_name}</Typography>
              <Typography variant="bodyMedium" color="text.secondary" noWrap>@{f.username}</Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setMenu({ anchorEl: e.currentTarget, friend: f }); }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>

      <Menu anchorEl={menu?.anchorEl} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setViewingProfile(menu.friend); setMenu(null); }}>
          <ListItemIcon><PersonRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Просмотреть профиль</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleRemove}>
          <ListItemIcon><PersonRemoveRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Удалить из друзей</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleBlock} sx={{ color: 'error.main' }}>
          <ListItemIcon><BlockRoundedIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Заблокировать</ListItemText>
        </MenuItem>
      </Menu>

      <ProfileViewDialog open={!!viewingProfile} onClose={() => setViewingProfile(null)} profile={viewingProfile} />
    </>
  );
}
