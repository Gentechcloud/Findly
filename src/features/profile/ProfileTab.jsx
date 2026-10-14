import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

import Stack from '../../components/common/Stack';
// Вкладка «Профиль»: смена аватара, имени, фамилии и описания
export default function ProfileTab({ profile, username, onLogout, onProfileRefresh, myId }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [first, setFirst] = useState(profile?.first_name || '');
  const [last, setLast] = useState(profile?.last_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('Файл слишком большой (максимум 8 МБ).'); return; }
    setUploading(true); setErr(''); setMsg('');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${myId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (uploadError) {
      setUploading(false);
      setErr(uploadError.message === 'Failed to fetch'
        ? 'Нет соединения с хранилищем Supabase. Проверьте интернет и что бакет "avatars" создан (Supabase → Storage).'
        : uploadError.message);
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: `${pub.publicUrl}?t=${Date.now()}` }).eq('id', myId);
    setUploading(false);
    onProfileRefresh?.();
  }

  async function save() {
    setErr(''); setMsg('');
    if (!first.trim() || !last.trim()) { setErr('Имя и фамилия обязательны — оставить пустым нельзя.'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ first_name: first.trim(), last_name: last.trim(), bio: bio.trim() || null }).eq('id', myId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg('Сохранено');
    onProfileRefresh?.();
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 480, mx: 'auto', alignItems: 'center', textAlign: 'center', width: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        <FindlyAvatar src={profile?.avatar_url} name={`${profile?.first_name || ''} ${profile?.last_name || ''}`} seed={username} size={96} />
        <IconButton
          component="label" size="small"
          sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }}
        >
          <PhotoCameraRoundedIcon fontSize="small" />
          <input type="file" accept="image/*" hidden onChange={handlePick} />
        </IconButton>
      </Box>
      {uploading && <CircularProgress size={20} />}
      <Stack spacing={0.25}>
        <Typography variant="headlineSmall">{profile?.first_name} {profile?.last_name}</Typography>
        <Typography variant="bodyMedium" color="text.secondary">@{username}</Typography>
      </Stack>

      {err && <Alert severity="error" sx={{ borderRadius: 3, textAlign: 'left', width: '100%' }}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ borderRadius: 3, textAlign: 'left', width: '100%' }}>{msg}</Alert>}

      <Stack spacing={1.5} sx={{ width: '100%', textAlign: 'left' }}>
        <TextField label="Имя" value={first} onChange={(e) => setFirst(e.target.value)} size="small" fullWidth />
        <TextField label="Фамилия" value={last} onChange={(e) => setLast(e.target.value)} size="small" fullWidth />
        <TextField label="О себе" value={bio} onChange={(e) => setBio(e.target.value)} size="small" fullWidth multiline minRows={2} maxRows={5} />
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Сохраняем...' : 'Сохранить'}</Button>
      </Stack>

      <Typography variant="bodySmall" color="text.secondary">
        Публикации фото и видео, лента и рейтинг в стиле Instagram появятся на Этапе 9.
      </Typography>
      <Button variant="outlined" color="error" onClick={onLogout} sx={{ borderColor: 'error.main', color: 'error.main' }}>
        Выйти из аккаунта
      </Button>
    </Stack>
  );
}
