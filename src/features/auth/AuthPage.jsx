import { useState } from 'react';
import {
  Box, Paper, Stack, Typography, TextField, Button, Fade, Grow,
  Alert, IconButton, InputAdornment, useMediaQuery, CircularProgress,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { supabase } from '../../lib/supabaseClient';
import Waveform from '../../components/common/Waveform';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function AuthPage({ onAuthed }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [form, setForm] = useState({
    identifier: '', // login: логин или почта
    username: '',   // register
    email: '',
    password: '',
    confirmPassword: '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setInfo('');
    const identifier = form.identifier.trim();
    if (!identifier || !form.password) {
      setError('Заполните логин или почту, и пароль.');
      return;
    }
    setLoading(true);
    try {
      let email = identifier;
      if (!identifier.includes('@')) {
        // Это ник, а не почта — ищем привязанную почту через RPC-функцию.
        const { data, error: rpcError } = await supabase.rpc('email_for_username', {
          lookup_username: identifier,
        });
        if (rpcError || !data) {
          setError('Пользователь с таким логином не найден.');
          setLoading(false);
          return;
        }
        email = data;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: form.password });
      if (signInError) {
        setError('Неверный логин/почта или пароль.');
        setLoading(false);
        return;
      }
      onAuthed?.();
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setInfo('');

    const username = form.username.trim();
    const email = form.email.trim();

    if (!USERNAME_RE.test(username)) {
      setError('Логин: 3–20 символов, только латинские буквы, цифры и "_".');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Введите корректную почту.');
      return;
    }
    if (form.password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { username } },
      });
      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('already registered')) {
          setError('Эта почта уже зарегистрирована.');
        } else {
          setError(signUpError.message || 'Не удалось зарегистрироваться. Попробуйте другой логин.');
        }
        setLoading(false);
        return;
      }
      if (data.session) {
        onAuthed?.();
      } else {
        setInfo('Регистрация прошла успешно! Проверьте почту, чтобы подтвердить аккаунт, затем войдите.');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh', display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      {isDesktop && (
        <Box
          sx={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', gap: 4, px: 6,
            background: (t) => `linear-gradient(160deg, ${t.palette.primary.container} 0%, ${t.m3.surface} 100%)`,
          }}
        >
          <Typography sx={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 44, color: 'primary.onContainer' }}>
            Findly
          </Typography>
          <Typography variant="titleMedium" sx={{ color: 'primary.onContainer', textAlign: 'center', maxWidth: 360 }}>
            Общайтесь голосом, видео и текстом — быстро, красиво, в одном месте.
          </Typography>
          <Waveform bars={36} variant="ambient" height={56} color="inherit" />
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Fade in timeout={500}>
          <Paper
            elevation={0}
            sx={{
              width: '100%', maxWidth: 400, p: { xs: 3, sm: 5 },
              borderRadius: 6, bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider',
            }}
          >
            {!isDesktop && (
              <Typography sx={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 28, mb: 3, textAlign: 'center' }}>
                Findly
              </Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ mb: 3, p: 0.5, bgcolor: 'action.hover', borderRadius: 999 }}>
              {['login', 'register'].map((m) => (
                <Button
                  key={m}
                  fullWidth
                  onClick={() => { setMode(m); setError(''); setInfo(''); }}
                  sx={{
                    borderRadius: 999,
                    bgcolor: mode === m ? 'background.paper' : 'transparent',
                    color: mode === m ? 'primary.main' : 'text.secondary',
                    boxShadow: mode === m ? 1 : 0,
                    '&:hover': { bgcolor: mode === m ? 'background.paper' : 'transparent' },
                  }}
                >
                  {m === 'login' ? 'Вход' : 'Регистрация'}
                </Button>
              ))}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>{error}</Alert>}
            {info && <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }}>{info}</Alert>}

            {mode === 'login' ? (
              <Grow in key="login">
                <Stack component="form" onSubmit={handleLogin} spacing={2.5}>
                  <TextField
                    label="Логин или почта"
                    value={form.identifier}
                    onChange={set('identifier')}
                    autoComplete="username"
                    fullWidth
                  />
                  <TextField
                    label="Пароль"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="current-password"
                    fullWidth
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword((s) => !s)} edge="end">
                              {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.3 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : 'Войти'}
                  </Button>
                </Stack>
              </Grow>
            ) : (
              <Grow in key="register">
                <Stack component="form" onSubmit={handleRegister} spacing={2.5}>
                  <TextField label="Логин (ник)" value={form.username} onChange={set('username')} autoComplete="username" fullWidth helperText="3–20 символов: латиница, цифры, _" />
                  <TextField label="Почта" type="email" value={form.email} onChange={set('email')} autoComplete="email" fullWidth />
                  <TextField
                    label="Пароль"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                    fullWidth
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword((s) => !s)} edge="end">
                              {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    label="Повторите пароль"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    autoComplete="new-password"
                    fullWidth
                  />
                  <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.3 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : 'Создать аккаунт'}
                  </Button>
                </Stack>
              </Grow>
            )}
          </Paper>
        </Fade>
      </Box>
    </Box>
  );
}
