import { useEffect, useState } from 'react';
import { Box, Stack, Typography, List, ListItemButton, Divider, CircularProgress } from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function ChatList({ myId, activeChatId, onOpenChat, refreshKey }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: myChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', myId);

      const chatIds = (myChats || []).map((c) => c.chat_id);
      if (chatIds.length === 0) { if (!cancelled) { setChats([]); setLoading(false); } return; }

      const { data: participants } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id, profiles:user_id (id, username, first_name, last_name, avatar_url)')
        .in('chat_id', chatIds)
        .neq('user_id', myId);

      const { data: lastMessages } = await supabase
        .from('messages')
        .select('chat_id, content, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      const lastByChat = {};
      (lastMessages || []).forEach((m) => { if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m; });

      const list = (participants || []).map((p) => ({
        chatId: p.chat_id,
        profile: p.profiles,
        lastMessage: lastByChat[p.chat_id]?.content || 'Начните переписку',
        lastAt: lastByChat[p.chat_id]?.created_at,
      })).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));

      if (!cancelled) { setChats(list); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [myId, refreshKey]);

  if (loading) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;
  }

  if (chats.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="bodyMedium" color="text.secondary">
          Пока нет чатов. Найдите пользователя через Findline (введите @ник), чтобы начать переписку.
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {chats.map((c) => (
        <ListItemButton
          key={c.chatId}
          selected={c.chatId === activeChatId}
          onClick={() => onOpenChat(c.chatId, c.profile)}
          sx={{
            py: 1.25, px: 1.5, gap: 1.5, borderRadius: 4,
            '&.Mui-selected': { bgcolor: 'primary.container' },
            '&.Mui-selected:hover': { bgcolor: 'primary.container' },
          }}
        >
          <FindlyAvatar
            src={c.profile?.avatar_url}
            name={`${c.profile?.first_name || ''} ${c.profile?.last_name || ''}`}
            seed={c.profile?.username}
            size={48}
          />
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="titleSmall" noWrap>
              {c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : '...'}
            </Typography>
            <Typography variant="bodyMedium" color="text.secondary" noWrap>{c.lastMessage}</Typography>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  );
}
