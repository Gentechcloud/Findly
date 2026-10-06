import { useEffect, useState } from 'react';
import {
  Stack, Typography, Card, CardContent, FormControlLabel, Checkbox,
  Select, MenuItem, Box, List, ListItemButton, Button, TextField, Alert,
  CircularProgress, Snackbar, Divider,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';

export default function SecurityPrivacyAccount({ myId, profile, email, onProfileRefresh }) {
  const [restrictVoice, setRestrictVoice] = useState(profile?.restrict_voice || false);
  const [restrictMedia, setRestrictMedia] = useState(profile?.restrict_media || false);
  const [avatarVis, setAvatarVis] = useState(profile?.avatar_visibility || 'all');
  const [profileVis, setProfileVis] = useState(profile?.profile_visibility || 'all');
  const [avatarHint, setAvatarHint] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  const [newUsername, setNewUsername] = useState(profile?.username || '');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameErr, setUsernameErr] = useState('');

  const [newEmail, setNewEmail] = useState(email || '');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');

  useEffect(() => { loadBlocked(); }, [myId]);

  async function loadBlocked() {
    setLoadingBlocked(true);
    const { data: rels } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId);
    const ids = (rels || []).map((r) => r.blocked_id);
    if (!ids.length) { setBlocked([]); setLoadingBlocked(false); return; }
    const { data: profs } = await supabase.from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', ids);
    setBlocked(profs || []);
    setLoadingBlocked(false);
  }

  async function unblock(id) {
    await supabase.from('blocked_users').delete().eq('blocker_id', myId).eq('blocked_id', id);
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  }

  async function saveSecurity(patch) {
    await supabase.from('profiles').update(patch).eq('id', myId);
    onProfileRefresh?.();
  }

  function handleAvatarVisChange(value) {
    setAvatarVis(value);
    saveSecurity({ avatar_visibility: value });
    if (value === 'none' && profile?.avatar_url) {
      setAvatarHint(true);
      setTimeout(() => setAvatarHint(false), 3000);
    }
  }

  async function handleChangePassword() {
    setPassErr(''); setPassMsg('');
    if (newPass.length < 6) { setPassErr('Новый пароль должен быть не короче 6 символов.'); return; }
    if (newPass !== confirmPass) { setPassErr('Пароли не совпадают.'); return; }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: oldPass });
    if (reauthErr) { setPassErr('Старый пароль неверен.'); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
    if (updateErr) { setPassErr(updateErr.message); return; }
    setPassMsg('Пароль изменён.');
    setOldPass(''); setNewPass(''); setConfirmPass('');
  }

  async function handleChangeUsername() {
    setUsernameErr(''); setUsernameMsg('');
    const { error } = await supabase.rpc('change_username', { new_username: newUsername.trim() });
    if (error) { setUsernameErr(error.message); return; }
    setUsernameMsg('Ник изменён.');
    onProfileRefresh?.();
  }

  async function handleChangeEmail() {
    setEmailErr(''); setEmailMsg('');
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) { setEmailErr(error.message); return; }
    setEmailMsg('На новую почту отправлено письмо для подтверждения смены.');
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 560, mx: 'auto' }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="titleMedium" gutterBottom>Безопасность — что мне могут присылать</Typography>
          <Typography variant="bodyMedium" color="text.secondary" sx={{ mb: 1 }}>
            Собеседники не увидят соответствующую кнопку в чате с вами.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={restrictVoice} onChange={(e) => { setRestrictVoice(e.target.checked); saveSecurity({ restrict_voice: e.target.checked }); }} />}
            label="Запретить присылать голосовые сообщения"
          />
          <br />
          <FormControlLabel
            control={<Checkbox checked={restrictMedia} onChange={(e) => { setRestrictMedia(e.target.checked); saveSecurity({ restrict_media: e.target.checked }); }} />}
            label="Запретить присылать фото, видео и файлы"
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="titleMedium" gutterBottom>Кто видит содержимое профиля</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="bodyMedium" gutterBottom>Мою аватарку могут видеть</Typography>
              <Select size="small" value={avatarVis} onChange={(e) => handleAvatarVisChange(e.target.value)} fullWidth>
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="friends">Только друзья</MenuItem>
                <MenuItem value="none">Никто</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography variant="bodyMedium" gutterBottom>Содержимое моего профиля видят</Typography>
              <Select size="small" value={profileVis} onChange={(e) => { setProfileVis(e.target.value); saveSecurity({ profile_visibility: e.target.value }); }} fullWidth>
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="friends">Только друзья</MenuItem>
              </Select>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="titleMedium" gutterBottom>Заблокированные пользователи</Typography>
          {loadingBlocked ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>
          ) : blocked.length === 0 ? (
            <Typography variant="bodyMedium" color="text.secondary">Список пуст.</Typography>
          ) : (
            <List disablePadding>
              {blocked.map((b) => (
                <ListItemButton key={b.id} sx={{ borderRadius: 3, gap: 1.5 }} disableRipple>
                  <FindlyAvatar src={b.avatar_url} name={`${b.first_name} ${b.last_name}`} seed={b.username} size={36} />
                  <Typography variant="bodyMedium" sx={{ flex: 1 }}>{b.first_name} {b.last_name}</Typography>
                  <Button size="small" onClick={() => unblock(b.id)}>Разблокировать</Button>
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="titleMedium" gutterBottom>Смена пароля</Typography>
          <Stack spacing={1.5}>
            {passErr && <Alert severity="error" sx={{ borderRadius: 3 }}>{passErr}</Alert>}
            {passMsg && <Alert severity="success" sx={{ borderRadius: 3 }}>{passMsg}</Alert>}
            <TextField label="Старый пароль" type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} size="small" />
            <TextField label="Новый пароль" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} size="small" />
            <TextField label="Подтверждение пароля" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} size="small" />
            <Button variant="outlined" onClick={handleChangePassword} sx={{ alignSelf: 'flex-start' }}>Сохранить пароль</Button>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="titleMedium" gutterBottom>Смена ника</Typography>
          <Stack spacing={1.5}>
            {usernameErr && <Alert severity="error" sx={{ borderRadius: 3 }}>{usernameErr}</Alert>}
            {usernameMsg && <Alert severity="success" sx={{ borderRadius: 3 }}>{usernameMsg}</Alert>}
            <TextField label="Новый ник" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} size="small" />
            <Button variant="outlined" onClick={handleChangeUsername} sx={{ alignSelf: 'flex-start' }}>Сохранить ник</Button>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="titleMedium" gutterBottom>Смена почты</Typography>
          <Stack spacing={1.5}>
            {emailErr && <Alert severity="error" sx={{ borderRadius: 3 }}>{emailErr}</Alert>}
            {emailMsg && <Alert severity="success" sx={{ borderRadius: 3 }}>{emailMsg}</Alert>}
            <TextField label="Новая почта" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} size="small" />
            <Button variant="outlined" onClick={handleChangeEmail} sx={{ alignSelf: 'flex-start' }}>Сохранить почту</Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={avatarHint} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" sx={{ borderRadius: 4 }}>
          А зачем ты выбрал эту функцию, если ты установил аватарку? 🙂
        </Alert>
      </Snackbar>
    </Stack>
  );
}
