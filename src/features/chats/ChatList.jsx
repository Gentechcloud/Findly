import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ButtonBase,
  CircularProgress,
  Divider,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

import Stack from '../../components/common/Stack';
function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Вчера';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function previewFor(m, myId) {
  if (!m) return 'Начните переписку';
  let text;
  if (m.deleted_for_everyone) text = 'Сообщение удалено';
  else if (m.message_type === 'voice') text = '🎤 Голосовое сообщение';
  else if (m.message_type === 'image') text = '📷 Фото';
  else if (m.message_type === 'video') text = '🎬 Видео';
  else if (m.message_type === 'file') text = '📎 Файл';
  else text = m.content;
  return m.sender_id === myId ? `Вы: ${text}` : text;
}

export default function ChatList({ myId, activeChatId, onOpenChat, refreshKey, ios }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setLoading(true);
    const { data: myChats } = await supabase
      .from('chat_participants')
      .select('chat_id, chats:chat_id (id, type, title, avatar_url, description, slow_mode_seconds, comments_enabled)')
      .eq('user_id', myId);

    const all = (myChats || []).map((c) => c.chats).filter(Boolean);
    const chatIds = all.map((c) => c.id);
    if (chatIds.length === 0) { setChats([]); setLoading(false); loadedOnce.current = true; return; }

    const directIds = all.filter((c) => c.type === 'direct').map((c) => c.id);
    const otherByChat = {};
    if (directIds.length) {
      const { data: participants } = await supabase
        .from('chat_participants').select('chat_id, user_id').in('chat_id', directIds).neq('user_id', myId);
      const otherUserIds = [...new Set((participants || []).map((p) => p.user_id))];
      let profilesById = {};
      if (otherUserIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, avatar_url, restrict_voice, restrict_media')
          .in('id', otherUserIds);
        profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }
      (participants || []).forEach((p) => { otherByChat[p.chat_id] = profilesById[p.user_id]; });
    }

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('chat_id, content, created_at, message_type, sender_id, deleted_for_everyone')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false })
      .limit(400);
    const lastByChat = {};
    (lastMessages || []).forEach((m) => { if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m; });

    const list = all.map((c) => {
      const last = lastByChat[c.id];
      if (c.type === 'direct') {
        const other = otherByChat[c.id];
        return {
          chat: { id: c.id, type: 'direct', profile: other },
          title: other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : '...',
          avatarUrl: other?.avatar_url, avatarSeed: other?.username,
          preview: previewFor(last, myId), lastAt: last?.created_at,
        };
      }
      return {
        chat: { ...c },
        title: c.title, avatarUrl: c.avatar_url, avatarSeed: c.id, kind: c.type,
        preview: previewFor(last, myId), lastAt: last?.created_at,
      };
    }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));

    setChats(list);
    setLoading(false);
    loadedOnce.current = true;
  }

  useEffect(() => { load(); }, [myId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Список обновляется сам, когда приходит новое сообщение в любой из моих чатов
  useEffect(() => {
    let timer;
    const channel = supabase
      .channel(`chatlist:${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 400);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;

  if (chats.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="bodyMedium" color="text.secondary">
          Пока нет чатов. Найдите пользователя через Findline (введите @ник), чтобы начать переписку, или создайте группу или канал кнопкой «+».
        </Typography>
      </Box>
    );
  }

  const KindIcon = ({ kind }) => (kind === 'channel'
    ? <CampaignRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
    : kind === 'group' ? <GroupsRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} /> : null);

  if (ios) {
    return (
      <Box>
        {chats.map((c, i) => (
          <Box key={c.chat.id}>
            <ButtonBase
              onClick={() => onOpenChat(c.chat)}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1, textAlign: 'left', borderRadius: 0,
                bgcolor: c.chat.id === activeChatId ? 'primary.container' : 'transparent',
              }}
            >
              <FindlyAvatar src={c.avatarUrl} name={c.title || 'Чат'} seed={c.avatarSeed} size={54} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Stack direction="row" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                    <KindIcon kind={c.kind} />
                    <Typography noWrap sx={{ fontSize: 17, fontWeight: 600 }}>{c.title || '...'}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }}>{timeLabel(c.lastAt)}</Typography>
                </Stack>
                <Typography noWrap sx={{ fontSize: 15, color: 'text.secondary', mt: 0.1 }}>{c.preview}</Typography>
              </Box>
            </ButtonBase>
            {i < chats.length - 1 && <Divider sx={{ ml: '84px', borderBottomWidth: '0.5px' }} />}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {chats.map((c) => (
        <ListItemButton
          key={c.chat.id}
          selected={c.chat.id === activeChatId}
          onClick={() => onOpenChat(c.chat)}
          sx={{
            py: 1.25, px: 1.5, gap: 1.5, borderRadius: '16px',
            '&.Mui-selected': { bgcolor: 'primary.container' },
            '&.Mui-selected:hover': { bgcolor: 'primary.container' },
          }}
        >
          <FindlyAvatar src={c.avatarUrl} name={c.title || 'Чат'} seed={c.avatarSeed} size={48} />
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Stack direction="row" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <KindIcon kind={c.kind} />
                <Typography variant="titleSmall" noWrap>{c.title || '...'}</Typography>
              </Stack>
              <Typography variant="labelSmall" color="text.secondary">{timeLabel(c.lastAt)}</Typography>
            </Stack>
            <Typography variant="bodyMedium" color="text.secondary" noWrap>{c.preview}</Typography>
          </Stack>
        </ListItemButton>
      ))}
    </List>
  );
}
