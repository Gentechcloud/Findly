import { useEffect, useState } from 'react';
import {
  Popover,
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import { useBackHandler } from '../../native';

import Stack from '../../components/common/Stack';
export default function MailCenter({ myId, anchorEl, onClose, onFriendsChanged }) {
  const [incoming, setIncoming] = useState([]);
  const [responses, setResponses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  useBackHandler(!!anchorEl, onClose);

  async function load() {
    setLoading(true);

    const { data: inv } = await supabase.rpc('get_my_chat_invites');
    setInvites(inv || []);

    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, kind, body, created_at, seen')
      .eq('user_id', myId)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(notifs || []);
    const unseenNotifIds = (notifs || []).filter((n) => !n.seen).map((n) => n.id);
    if (unseenNotifIds.length) {
      await supabase.from('notifications').update({ seen: true }).in('id', unseenNotifIds);
    }

    const { data: inc, error: incErr } = await supabase
      .from('friend_requests')
      .select('id, from_user, created_at')
      .eq('to_user', myId).eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: resp, error: respErr } = await supabase
      .from('friend_requests')
      .select('id, to_user, status, responded_at')
      .eq('from_user', myId).eq('seen_by_sender', false)
      .neq('status', 'pending')
      .order('responded_at', { ascending: false });

    if (incErr) console.error('Mail incoming error:', incErr);
    if (respErr) console.error('Mail responses error:', respErr);

    // Профили подтягиваем отдельным запросом — надёжнее, чем полагаться
    // на автоматическое связывание таблиц.
    const otherIds = [...new Set([...(inc || []).map((r) => r.from_user), ...(resp || []).map((r) => r.to_user)])];
    let profilesById = {};
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url')
        .in('id', otherIds);
      profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    }

    setIncoming((inc || []).map((r) => ({ ...r, profile: profilesById[r.from_user] })));
    setResponses((resp || []).map((r) => ({ ...r, profile: profilesById[r.to_user] })));
    setLoading(false);

    if (resp?.length) {
      await supabase.from('friend_requests').update({ seen_by_sender: true }).in('id', resp.map((r) => r.id));
    }
    if (inc?.length) {
      await supabase.from('friend_requests').update({ seen_by_recipient: true }).in('id', inc.map((r) => r.id));
    }
  }

  useEffect(() => { if (anchorEl) load(); }, [anchorEl, myId]);

  async function respondInvite(id, accept) {
    const { error } = await supabase.rpc('respond_chat_invite', { p_invite: id, p_accept: accept });
    if (error) { console.error(error); return; }
    setInvites((prev) => prev.filter((i) => i.invite_id !== id));
    onFriendsChanged?.();
  }

  async function respond(id, accept) {
    const { error } = await supabase.rpc('respond_friend_request', { request_id: id, accept });
    if (error) { console.error(error); return; }
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
      slotProps={{ paper: { sx: { borderRadius: '16px', width: 360, maxWidth: 'calc(100vw - 24px)', maxHeight: 460, mt: 1 } } }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="titleMedium" gutterBottom>Mail</Typography>

        {loading ? (
          <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} /></Box>
        ) : (
          <Stack spacing={2}>
            {incoming.length === 0 && responses.length === 0 && notifications.length === 0 && invites.length === 0 && (
              <Typography variant="bodyMedium" color="text.secondary">Новых уведомлений нет.</Typography>
            )}

            {incoming.map((req) => (
              <Stack key={req.id} direction="row" alignItems="center" spacing={1.5}>
                <FindlyAvatar src={req.profile?.avatar_url} name={`${req.profile?.first_name || ''} ${req.profile?.last_name || ''}`} seed={req.profile?.username} size={40} />
                <Stack sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="bodyMedium" noWrap>
                    <b>{req.profile ? `${req.profile.first_name} ${req.profile.last_name}` : 'Пользователь'}</b> хочет добавить вас в друзья
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Button size="small" onClick={() => respond(req.id, true)} sx={{ color: 'success.main', minWidth: 0 }}>Принять</Button>
                    <Button size="small" onClick={() => respond(req.id, false)} sx={{ color: 'error.main', minWidth: 0 }}>Отклонить</Button>
                  </Stack>
                </Stack>
              </Stack>
            ))}

            {invites.map((inv) => (
              <Stack key={inv.invite_id} spacing={0.5}>
                <Typography variant="bodyMedium">
                  <b>{inv.from_name || 'Пользователь'}</b> приглашает вас в {inv.chat_type === 'channel' ? 'канал' : 'группу'} «{inv.chat_title}»
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => respondInvite(inv.invite_id, true)} sx={{ color: 'success.main', minWidth: 0 }}>Принять</Button>
                  <Button size="small" onClick={() => respondInvite(inv.invite_id, false)} sx={{ color: 'error.main', minWidth: 0 }}>Отклонить</Button>
                </Stack>
              </Stack>
            ))}

            {(incoming.length > 0 || invites.length > 0) && responses.length > 0 && <Divider />}

            {responses.map((r) => (
              <Typography key={r.id} variant="bodyMedium" color="text.secondary">
                {r.profile ? `${r.profile.first_name} ${r.profile.last_name}` : 'Пользователь'} {r.status === 'accepted' ? 'принял(а) вашу заявку в друзья' : 'отклонил(а) вашу заявку в друзья'}
              </Typography>
            ))}

            {(incoming.length > 0 || responses.length > 0) && notifications.length > 0 && <Divider />}

            {notifications.map((n) => (
              <Typography key={n.id} variant="bodyMedium" color="text.secondary">{n.body}</Typography>
            ))}
          </Stack>
        )}
      </Box>
    </Popover>
  );
}
