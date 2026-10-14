import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Checkbox,
  List,
  ListItemButton,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import useFriends from '../friends/useFriends';
import { useBackHandler } from '../../native';

import Stack from '../../components/common/Stack';
// Создание группы (kind='group') или канала (kind='channel')
export default function CreateChatDialog({ open, kind = 'group', onClose, myId, onCreated }) {
  const isChannel = kind === 'channel';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { friends, loading: loadingFriends } = useFriends(myId, open);
  useBackHandler(open, onClose);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setAvatarFile(null); setAvatarPreview(null); setSelected(new Set()); setError('');
  }, [open]);

  const toggle = (username) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(username)) next.delete(username); else next.add(username);
    return next;
  });

  function handlePickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Укажите название'); return; }
    setSubmitting(true); setError('');
    try {
      let avatar_url = null;
      if (avatarFile) {
        const path = `${myId}/chat-${crypto.randomUUID()}.${avatarFile.name.split('.').pop() || 'jpg'}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { contentType: avatarFile.type });
        if (upErr) { setError('Не удалось загрузить аватар: ' + upErr.message); setSubmitting(false); return; }
        avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
      const { data, error: createErr } = await supabase.rpc('create_chat', {
        p_kind: kind, p_title: title.trim(), p_avatar_url: avatar_url,
        p_description: description.trim() || null, p_members: Array.from(selected),
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isChannel ? 'Новый канал' : 'Новая группа'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Stack alignItems="center" spacing={1}>
            <Box component="label" sx={{ cursor: 'pointer' }}>
              <FindlyAvatar src={avatarPreview} name={title || (isChannel ? 'Канал' : 'Группа')} size={72} />
              <input type="file" accept="image/*" hidden onChange={handlePickAvatar} />
            </Box>
            <Typography variant="labelSmall" color="text.secondary">Нажмите, чтобы выбрать аватар (необязательно)</Typography>
          </Stack>

          <TextField label={isChannel ? 'Название канала' : 'Название группы'} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus fullWidth />
          <TextField label="Описание (необязательно)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline maxRows={3} />

          {isChannel && (
            <Typography variant="bodySmall" color="text.secondary">
              В канале публикуют только администраторы. Подписчики ставят 👍/👎 (одна реакция на человека) и пишут комментарии.
            </Typography>
          )}

          {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

          <Box>
            <Typography variant="titleSmall" gutterBottom>{isChannel ? 'Добавить подписчиков из друзей' : 'Добавить друзей'}</Typography>
            {loadingFriends ? (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
            ) : friends.length === 0 ? (
              <Typography variant="bodyMedium" color="text.secondary">
                Друзей пока нет — их можно будет пригласить позже через @ник.
              </Typography>
            ) : (
              <List disablePadding sx={{ maxHeight: 220, overflowY: 'auto' }}>
                {friends.map((f) => (
                  <ListItemButton key={f.id} onClick={() => toggle(f.username)} sx={{ gap: 1 }}>
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
        <Button variant="contained" onClick={handleCreate} disabled={submitting} startIcon={isChannel ? <CampaignRoundedIcon /> : <GroupsRoundedIcon />}>
          {submitting ? 'Создаём...' : isChannel ? 'Создать канал' : 'Создать группу'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
