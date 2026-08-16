import { useEffect, useState } from 'react';
import { Box, Stack, Typography, List, ListItemButton, CircularProgress } from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function FriendsList({ myId, onOpenChat, refreshKey }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: rels, error } = await supabase
        .from('friend_requests')
        .select('from_user, to_user')
        .eq('status', 'accepted')
        .or(`from_user.eq.${myId},to_user.eq.${myId}`);

      if (error) console.error('FriendsList error:', error);

      const friendIds = (rels || []).map((r) => (r.from_user === myId ? r.to_user : r.from_user));
      if (friendIds.length === 0) { if (!cancelled) { setFriends([]); setLoading(false); } return; }

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, bio')
        .in('id', friendIds);

      if (!cancelled) { setFriends(profs || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [myId, refreshKey]);

  async function openChat(friendProfile) {
    const { data, error } = await supabase.rpc('start_direct_chat', { other_username: friendProfile.username });
    if (!error) onOpenChat(data, friendProfile);
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
    <List disablePadding sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 560, mx: 'auto' }}>
      {friends.map((f) => (
        <ListItemButton key={f.id} onClick={() => openChat(f)} sx={{ py: 1.25, px: 1.5, gap: 1.5, borderRadius: 4 }}>
          <FindlyAvatar src={f.avatar_url} name={`${f.first_name || ''} ${f.last_name || ''}`} seed={f.username} size={48} />
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="titleSmall" noWrap>{f.first_name} {f.last_name}</Typography>
            <Typography variant="bodyMedium" color="text.secondary" noWrap>@{f.username}</Typography>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  );
}
