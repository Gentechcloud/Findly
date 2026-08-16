import { useEffect, useState } from 'react';
import {
  Paper, InputBase, IconButton, Box, List, ListItemButton, Typography,
  ClickAwayListener, CircularProgress, Stack, Button,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function Findline({ myId, onOpenChat, onFriendsChanged, onError, autoFocus }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageResults, setMessageResults] = useState([]);
  const [userResult, setUserResult] = useState(null);
  const [relStatus, setRelStatus] = useState(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setMessageResults([]); setUserResult(null); setUserNotFound(false); setRelStatus(null); return; }

    const timer = setTimeout(async () => {
      setLoading(true);

      if (q.startsWith('@')) {
        const exactUsername = q.slice(1);
        const { data } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('username', exactUsername)
          .maybeSingle();
        setUserResult(data || null);
        setUserNotFound(!data && exactUsername.length > 0);
        setMessageResults([]);
        if (data) {
          const { data: status } = await supabase.rpc('relationship_status', { other_username: exactUsername });
          setRelStatus(status);
        }
      } else {
        const { data: myChats } = await supabase.from('chat_participants').select('chat_id').eq('user_id', myId);
        const chatIds = (myChats || []).map((c) => c.chat_id);
        if (chatIds.length) {
          const { data } = await supabase
            .from('messages')
            .select('id, chat_id, content, created_at, sender_id')
            .in('chat_id', chatIds)
            .ilike('content', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(15);
          setMessageResults(data || []);
        } else {
          setMessageResults([]);
        }
        setUserResult(null);
        setUserNotFound(false);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, myId]);

  function close() {
    setOpen(false);
    setQuery('');
    setMessageResults([]);
    setUserResult(null);
    setUserNotFound(false);
    setRelStatus(null);
  }

  async function sendRequest() {
    setActing(true);
    const { error } = await supabase.rpc('send_friend_request', { target_username: userResult.username });
    setActing(false);
    if (error) { onError?.(error.message); return; }
    setRelStatus('pending_outgoing');
    onFriendsChanged?.();
  }

  async function message() {
    const { data, error } = await supabase.rpc('start_direct_chat', { other_username: userResult.username });
    if (error) { onError?.(error.message); return; }
    onOpenChat(data, userResult);
    close();
  }

  return (
    <ClickAwayListener onClickAway={() => open && close()}>
      <Box sx={{ position: 'relative', flex: 1, maxWidth: 480 }}>
        <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 999, bgcolor: 'action.hover', border: 'none' }}>
          <SearchRoundedIcon fontSize="small" />
          <InputBase
            placeholder="Findline — поиск чатов, сообщений, @ников"
            fullWidth value={query}
            autoFocus={autoFocus}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ fontSize: 14 }}
          />
          {query && <IconButton size="small" onClick={close}><CloseRoundedIcon fontSize="small" /></IconButton>}
        </Paper>

        {open && query.trim() && (
          <Paper elevation={4} sx={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, borderRadius: 4, maxHeight: 360, overflowY: 'auto', zIndex: 20 }}>
            {loading ? (
              <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
            ) : query.startsWith('@') ? (
              userResult ? (
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FindlyAvatar src={userResult.avatar_url} name={`${userResult.first_name || ''} ${userResult.last_name || ''}`} seed={userResult.username} size={44} />
                  <Stack sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="titleSmall" noWrap>{userResult.first_name} {userResult.last_name}</Typography>
                    <Typography variant="labelSmall" color="text.secondary">@{userResult.username}</Typography>
                  </Stack>
                  {relStatus === 'friends' && (
                    <Button size="small" variant="contained" disabled={acting} onClick={message}>Написать</Button>
                  )}
                  {relStatus === 'none' && (
                    <Button size="small" variant="outlined" disabled={acting} onClick={sendRequest}>Добавить в друзья</Button>
                  )}
                  {relStatus === 'pending_outgoing' && (
                    <Button size="small" disabled sx={{ color: 'text.secondary' }}>Запрос отправлен</Button>
                  )}
                  {relStatus === 'pending_incoming' && (
                    <Typography variant="labelSmall" color="text.secondary" sx={{ textAlign: 'right' }}>
                      Запрос вам — откройте Mail
                    </Typography>
                  )}
                </Box>
              ) : userNotFound ? (
                <Box sx={{ p: 2.5 }}>
                  <Typography variant="bodyMedium" color="text.secondary">
                    Пользователь с точным ником «{query.slice(1)}» не найден. Findline находит только точное совпадение — похожие ники не показываются.
                  </Typography>
                </Box>
              ) : null
            ) : messageResults.length > 0 ? (
              <List disablePadding>
                {messageResults.map((m) => (
                  <ListItemButton key={m.id} onClick={() => { onOpenChat(m.chat_id); close(); }} sx={{ py: 1.25, px: 2 }}>
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="bodyMedium" noWrap>{m.content}</Typography>
                      <Typography variant="labelSmall" color="text.secondary">{new Date(m.created_at).toLocaleString()}</Typography>
                    </Stack>
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2.5 }}><Typography variant="bodyMedium" color="text.secondary">Ничего не найдено.</Typography></Box>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
