import { useEffect, useState } from 'react';
import { Box, Stack, Typography, List, ListItemButton, CircularProgress, Badge } from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
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
        .select('chat_id, chats:chat_id (id, type, title, avatar_url)')
        .eq('user_id', myId);

      const all = (myChats || []).map((c) => c.chats).filter(Boolean);
      const chatIds = all.map((c) => c.id);
      if (chatIds.length === 0) { if (!cancelled) { setChats([]); setLoading(false); } return; }

      const directIds = all.filter((c) => c.type === 'direct').map((c) => c.id);
      let otherByChat = {};
      if (directIds.length) {
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('chat_id, user_id')
          .in('chat_id', directIds)
          .neq('user_id', myId);

        const otherUserIds = [...new Set((participants || []).map((p) => p.user_id))];
        let profilesById = {};
        if (otherUserIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', otherUserIds);
          profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        }
        (participants || []).forEach((p) => { otherByChat[p.chat_id] = profilesById[p.user_id]; });
      }

      const { data: lastMessages } = await supabase
        .from('messages')
        .select('chat_id, content, created_at, message_type')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      const lastByChat = {};
      (lastMessages || []).forEach((m) => { if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m; });

      const previewFor = (m) => {
        if (!m) return 'Начните переписку';
        if (m.message_type === 'voice') return '🎤 Голосовое сообщение';
        if (m.message_type === 'image') return '📷 Фото';
        if (m.message_type === 'video') return '🎬 Видео';
        if (m.message_type === 'file') return '📎 Файл';
        return m.content;
      };

      const list = all.map((c) => {
        if (c.type === 'group') {
          return {
            chatId: c.id, type: 'group', title: c.title, avatarUrl: c.avatar_url,
            lastMessage: previewFor(lastByChat[c.id]), lastAt: lastByChat[c.id]?.created_at,
          };
        }
        const other = otherByChat[c.id];
        return {
          chatId: c.id, type: 'direct', profile: other,
          title: other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : '...',
          avatarUrl: other?.avatar_url, avatarSeed: other?.username,
          lastMessage: previewFor(lastByChat[c.id]), lastAt: lastByChat[c.id]?.created_at,
        };
      }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));

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
          Пока нет чатов. Найдите пользователя через Findline (введите @ник), чтобы начать переписку, или создайте группу кнопкой «+».
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
          onClick={() => onOpenChat(c.chatId, c.type === 'group' ? { type: 'group', title: c.title, avatar_url: c.avatarUrl } : c.profile)}
          sx={{
            py: 1.25, px: 1.5, gap: 1.5, borderRadius: 4,
            '&.Mui-selected': { bgcolor: 'primary.container' },
            '&.Mui-selected:hover': { bgcolor: 'primary.container' },
          }}
        >
          {c.type === 'group' ? (
            <FindlyAvatar src={c.avatarUrl} name={c.title || 'Группа'} seed={c.chatId} size={48} />
          ) : (
            <FindlyAvatar src={c.avatarUrl} name={c.title} seed={c.avatarSeed} size={48} />
          )}
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="titleSmall" noWrap>{c.title || '...'}</Typography>
            <Typography variant="bodyMedium" color="text.secondary" noWrap>{c.lastMessage}</Typography>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  );
}
