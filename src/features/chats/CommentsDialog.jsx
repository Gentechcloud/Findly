import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  InputBase,
  CircularProgress,
  Alert,
  useMediaQuery,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import { useBackHandler } from '../../native';

import Stack from '../../components/common/Stack';
// Комментарии под публикацией канала
export default function CommentsDialog({ open, onClose, post, myId, membersById, canModerate, commentsEnabled }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const [comments, setComments] = useState([]);
  const [extraProfiles, setExtraProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  useBackHandler(open, onClose);

  async function load() {
    const { data } = await supabase
      .from('post_comments').select('id, user_id, content, created_at')
      .eq('post_id', post.id).order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!open || !post) return undefined;
    setLoading(true); setError(''); setDraft('');
    load();
    const channel = supabase
      .channel(`comments:${post.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${post.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Профили авторов, которых нет в списке участников (например, вышли из канала)
  useEffect(() => {
    const unknown = [...new Set(comments.map((c) => c.user_id))].filter((id) => !membersById[id] && !extraProfiles[id]);
    if (!unknown.length) return;
    supabase.from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', unknown)
      .then(({ data }) => setExtraProfiles((prev) => ({ ...prev, ...Object.fromEntries((data || []).map((p) => [p.id, p])) })));
  }, [comments]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true); setError('');
    const { error: err } = await supabase.rpc('add_post_comment', { p_post: post.id, p_content: text });
    setSending(false);
    if (err) { setError(err.message); return; }
    setDraft('');
    load();
  }

  async function remove(id) {
    const { error: err } = await supabase.rpc('delete_post_comment', { p_comment: id });
    if (err) setError(err.message); else setComments((prev) => prev.filter((c) => c.id !== id));
  }

  const person = (id) => membersById[id] || extraProfiles[id];
  const nameOf = (id) => {
    const p = person(id);
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username : 'Пользователь';
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={!isDesktop} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { height: isDesktop ? '80vh' : '100%' } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 'calc(env(safe-area-inset-top, 0px) + 8px)', pb: 1, borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Typography variant="titleMedium" sx={{ flex: 1 }}>Комментарии · {comments.length}</Typography>
        <IconButton onClick={onClose}><CloseRoundedIcon /></IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : comments.length === 0 ? (
          <Typography variant="bodyMedium" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Комментариев пока нет — напишите первым!
          </Typography>
        ) : (
          <Stack spacing={2}>
            {comments.map((c) => (
              <Stack key={c.id} direction="row" spacing={1.25} alignItems="flex-start">
                <FindlyAvatar src={person(c.user_id)?.avatar_url} name={nameOf(c.user_id)} seed={person(c.user_id)?.username} size={34} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{nameOf(c.user_id)}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {new Date(c.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 15, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{c.content}</Typography>
                </Box>
                {(c.user_id === myId || canModerate) && (
                  <IconButton size="small" onClick={() => remove(c.id)} title="Удалить"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                )}
              </Stack>
            ))}
            <div ref={bottomRef} />
          </Stack>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mb: 1, borderRadius: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {commentsEnabled ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, pb: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', borderTop: '0.5px solid', borderColor: 'divider' }}>
          <InputBase
            value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Написать комментарий..." fullWidth multiline maxRows={4}
            sx={{ bgcolor: (t) => t.m3.surfaceVariant, borderRadius: '20px', px: 2, py: 0.75, fontSize: 16 }}
          />
          <IconButton onClick={send} disabled={!draft.trim() || sending} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
            <SendRoundedIcon />
          </IconButton>
        </Stack>
      ) : (
        <Box sx={{ p: 2, textAlign: 'center', borderTop: '0.5px solid', borderColor: 'divider' }}>
          <Typography variant="bodyMedium" color="text.secondary">Комментарии отключены администраторами</Typography>
        </Box>
      )}
    </Dialog>
  );
}
