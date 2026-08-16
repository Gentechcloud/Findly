import { useRef, useState } from 'react';
import {
  Box, Paper, Stack, Typography, TextField, Button, Alert,
  IconButton, CircularProgress, useMediaQuery,
} from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function OnboardingPage({ session, onDone }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const username = session?.user?.user_metadata?.username || 'user';

  function handlePickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Файл слишком большой (максимум 8 МБ).');
      return;
    }
    setError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setError('Имя и фамилия обязательны — оставить пустым нельзя.');
      return;
    }

    setLoading(true);
    try {
      let avatar_url = null;

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `${session.user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || 'image/jpeg' });
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          setError(
            uploadError.message === 'Failed to fetch'
              ? 'Не удалось загрузить фото — нет соединения с хранилищем Supabase. Проверьте: 1) интернет-соединение, 2) что в Supabase → Storage существует бакет "avatars" (если нет — перезалейте supabase-setup.sql), 3) отключите VPN/блокировщики рекламы на секунду и попробуйте снова.'
              : 'Не удалось загрузить фото: ' + uploadError.message
          );
          setLoading(false);
          return;
        }
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        avatar_url = pub.publicUrl + `?t=${Date.now()}`; // избегаем кеша старой картинки
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: first,
          last_name: last,
          bio: bio.trim() || null,
          avatar_url,
          onboarding_completed: true,
        })
        .eq('id', session.user.id);

      if (updateError) {
        setError('Не удалось сохранить профиль: ' + updateError.message);
        setLoading(false);
        return;
      }

      onDone?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%', maxWidth: 440, p: { xs: 3, sm: 5 },
          borderRadius: 6, border: '1px solid', borderColor: 'divider',
        }}
      >
        <Typography variant="headlineSmall" gutterBottom>Расскажите о себе</Typography>
        <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 3 }}>
          Это увидят другие пользователи Findly
        </Typography>

        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <FindlyAvatar src={avatarPreview} name={`${firstName} ${lastName}`.trim()} seed={username} size={96} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small" variant="outlined" startIcon={<ImageRoundedIcon />}
              onClick={() => galleryInput.current?.click()}
            >
              Из галереи
            </Button>
            <Button
              size="small" variant="outlined" startIcon={<PhotoCameraRoundedIcon />}
              onClick={() => cameraInput.current?.click()}
            >
              Сделать фото
            </Button>
          </Stack>
          <Typography variant="labelSmall" color="text.secondary">
            Можно оставить пустым — тогда будет цветной аватар с вашими инициалами
          </Typography>
          <input ref={galleryInput} type="file" accept="image/*" hidden onChange={handlePickFile} />
          <input ref={cameraInput} type="file" accept="image/*" capture="user" hidden onChange={handlePickFile} />
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>{error}</Alert>}

        <Stack spacing={2.5}>
          <TextField label="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} required fullWidth />
          <TextField label="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} required fullWidth />
          <TextField
            label="О себе (необязательно)"
            value={bio} onChange={(e) => setBio(e.target.value)}
            multiline minRows={2} maxRows={4} fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.3 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Продолжить'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
