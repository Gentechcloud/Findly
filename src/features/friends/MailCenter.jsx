import { useEffect, useState } from 'react';
import {
  Popover, Box, Stack, Typography, Button, CircularProgress, Divider,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function MailCenter({ myId, anchorEl, onClose, onFriendsChanged }) {
  const [incoming, setIncoming] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: inc } = await supabase
      .from('friend_requests')
      .select('id, from_user, created_at, profiles:from_user (username, first_name, last_name, avatar_url)')
      .eq('to_user', myId).eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: resp } = await supabase
      .from('friend_requests')
      .select('id, to_user, status, responded_at, seen_by_sender, profiles:to_user (username, first_name, last_name)')
      .eq('from_user', myId).eq('seen_by_sender', false)
      .not('status', 'eq', 'pending')
      .order('responded_at', { ascending: false });

    setIncoming(inc || []);
    setResponses(resp || []);
    setLoading(false);

    if (resp?.length) {
      await supabase.from('friend_requests').update({ seen_by_sender: true }).in('id', resp.map((r) => r.id));
    }
    if (inc?.length) {
      await supabase.from('friend_requests').update({ seen_by_recipient: true }).in('id', inc.map((r) => r.id));
    }
  }

  useEffect(() => { if (anchorEl) load(); }, [anchorEl, myId]);

  async function respond(id, accept) {
    await supabase.rpc('respond_friend_request', { request_id: id, accept });
    setIncoming((prev) => prev.filter((r) => r.id !== id));
    onFriendsChanged?.();
  }

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { borderRadius: 4, width: 360, maxHeight: 460, mt: 1 } } }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="titleMedium" gutterBottom>Mail</Typography>

        {loading ? (
          <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} /></Box>
        ) : (
          <Stack spacing={2}>
            {incoming.length === 0 && responses.length === 0 && (
              <Typography variant="bodyMedium" color="text.secondary">Новых уведомлений нет.</Typography>
            )}

            {incoming.map((req) => (
              <Stack key={req.id} direction="row" alignItems="center" spacing={1.5}>
                <FindlyAvatar src={req.profiles?.avatar_url} name={`${req.profiles?.first_name || ''} ${req.profiles?.last_name || ''}`} seed={req.profiles?.username} size={40} />
                <Stack sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="bodyMedium" noWrap>
                    <b>{req.profiles?.first_name} {req.profiles?.last_name}</b> хочет добавить вас в друзья
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Button size="small" onClick={() => respond(req.id, true)} sx={{ color: 'success.main', minWidth: 0 }}>Принять</Button>
                    <Button size="small" onClick={() => respond(req.id, false)} sx={{ color: 'error.main', minWidth: 0 }}>Отклонить</Button>
                  </Stack>
                </Stack>
              </Stack>
            ))}

            {incoming.length > 0 && responses.length > 0 && <Divider />}

            {responses.map((r) => (
              <Typography key={r.id} variant="bodyMedium" color="text.secondary">
                {r.profiles?.first_name} {r.profiles?.last_name} {r.status === 'accepted' ? 'принял(а) вашу заявку в друзья' : 'отклонил(а) вашу заявку в друзья'}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>
    </Popover>
  );
}
