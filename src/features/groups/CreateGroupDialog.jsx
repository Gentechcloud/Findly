import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField,
  Box, Checkbox, List, ListItemButton, Typography, CircularProgress, Alert,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function CreateGroupDialog({ open, onClose, myId, onCreated }) {
  const [title, setTitle] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(''); setAvatarFile(null); setAvatarPreview(null); setSelected(new Set()); setError('');
    setLoadingFriends(true);
    (async () => {
      const { data: rels, error } = await supabase
        .from('friend_requests')
        .select('from_user, to_user')
        .eq('status', 'accepted')
        .or(`from_user.eq.${myId},to_user.eq.${myId}`);
      if (error) console.error('CreateGroupDialog friends error:', error);

      const friendIds = (rels || []).map((r) => (r.from_user === myId ? r.to_user : r.from_user));
      if (friendIds.length === 0) { setFriends([]); setLoadingFriends(false); return; }

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url')
        .in('id', friendIds);
      setFriends(profs || []);
      setLoadingFriends(false);
    })();
  }, [open, myId]);

  function toggle(username) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  }

  function handlePickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Укажите название группы'); return; }
    setSubmitting(true);
    setError('');
    try {
      let avatar_url = null;
      if (avatarFile) {
        const path = `${myId}/group-${crypto.randomUUID()}.${avatarFile.name.split('.').pop() || 'jpg'}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { contentType: avatarFile.type });
        if (upErr) { setError('Не удалось загрузить аватар группы: ' + upErr.message); setSubmitting(false); return; }
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }

      const { data, error: createErr } = await supabase.rpc('create_group', {
        group_title: title.trim(),
        group_avatar_url: avatar_url,
        member_usernames: Array.from(selected),
      });
      setSubmitting(false);
      if (createErr) { setError(createErr.message); return; }
      onCreated(data);
      onClose();
    } catch (e) {
      setSubmitting(false);
      setError(String(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 5 } }}>
      <DialogTitle>Новая группа</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Stack alignItems="center" spacing={1}>
            <Box component="label" sx={{ cursor: 'pointer' }}>
              <FindlyAvatar src={avatarPreview} name={title || 'Группа'} size={72} />
              <input type="file" accept="image/*" hidden onChange={handlePickAvatar} />
            </Box>
            <Typography variant="labelSmall" color="text.secondary">Нажмите, чтобы выбрать аватар (необязательно)</Typography>
          </Stack>

          <TextField label="Название группы" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus fullWidth />

          {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

          <Box>
            <Typography variant="titleSmall" gutterBottom>Добавить друзей</Typography>
            {loadingFriends ? (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
            ) : friends.length === 0 ? (
              <Typography variant="bodyMedium" color="text.secondary">
                У вас пока нет друзей — сначала добавьте кого-то через Findline.
              </Typography>
            ) : (
              <List disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
                {friends.map((f) => (
                  <ListItemButton key={f.id} onClick={() => toggle(f.username)} sx={{ borderRadius: 3, gap: 1 }}>
                    <Checkbox checked={selected.has(f.username)} size="small" />
                    <FindlyAvatar src={f.avatar_url} name={`${f.first_name} ${f.last_name}`} seed={f.username} size={32} />
                    <Typography variant="bodyMedium" sx={{ ml: 1 }}>{f.first_name} {f.last_name}</Typography>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleCreate} disabled={submitting} startIcon={<GroupsRoundedIcon />}>
          {submitting ? 'Создаём...' : 'Создать группу'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
