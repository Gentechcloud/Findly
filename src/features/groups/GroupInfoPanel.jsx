import { useEffect, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  ButtonBase,
  Chip,
  Menu,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Divider,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import useFriends from '../friends/useFriends';
import { useBackHandler } from '../../native';

import Stack from '../../components/common/Stack';
const RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };
const ROLE_LABEL = { owner: 'Владелец', admin: 'Админ', moderator: 'Модератор', member: '' };
const MUTE_OPTIONS = [
  { minutes: 5, label: '5 минут' }, { minutes: 10, label: '10 минут' }, { minutes: 30, label: '30 минут' },
  { minutes: 60, label: '1 час' }, { minutes: 300, label: '5 часов' }, { minutes: 1440, label: '24 часа' },
];
const SLOW_OPTIONS = [
  { seconds: 0, label: 'Выключен' }, { seconds: 10, label: '10 секунд' }, { seconds: 30, label: '30 секунд' },
  { seconds: 60, label: '1 минута' }, { seconds: 300, label: '5 минут' }, { seconds: 900, label: '15 минут' },
  { seconds: 3600, label: '1 час' },
];

function formatAudit(e) {
  const a = e.actor_name || 'Кто-то';
  const t = e.target_name || 'участника';
  const roles = { admin: 'администратор', moderator: 'модератор', member: 'участник' };
  switch (e.action) {
    case 'create': return `${a} создал(а) «${e.details || ''}»`;
    case 'add': return `${a} добавил(а) ${t}`;
    case 'invite': return `${a} пригласил(а) ${t}`;
    case 'join': return `${a} присоединился(ась)`;
    case 'leave': return `${a} покинул(а) чат`;
    case 'kick': return `${a} исключил(а) ${t}`;
    case 'ban': return `${a} забанил(а) ${t}`;
    case 'unban': return `${a} разбанил(а) ${t}`;
    case 'mute': return `${a} заглушил(а) ${t} (${e.details})`;
    case 'unmute': return `${a} снял(а) мут с ${t}`;
    case 'role': return `${a} назначил(а) ${t}: ${roles[e.details] || e.details}`;
    case 'settings': return `${a} изменил(а) настройки: ${e.details}`;
    case 'delete_message': return `${a} удалил(а) сообщение ${t}`;
    case 'owner_transfer': return `${a} передал(а) владение — ${t}`;
    default: return `${a}: ${e.action}`;
  }
}

function Sec({ title, children, danger }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      {title && (
        <Typography sx={{ fontSize: 13, color: danger ? 'error.main' : 'text.secondary', textTransform: 'uppercase', px: 1, pb: 0.75, letterSpacing: 0.2 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ borderRadius: '12px', bgcolor: (t) => t.m3.groupedItem, border: '1px solid', borderColor: 'divider', p: 2 }}>
        {children}
      </Box>
    </Box>
  );
}

export default function GroupInfoPanel({ open, onClose, chat, members, myId, onChanged, onLeft }) {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const isChannel = chat.type === 'channel';
  const me = members.find((m) => m.user_id === myId);
  const myRole = me?.role || 'member';
  const myRank = RANK[myRole];
  const isStaff = myRank >= 2;
  const isAdmin = myRank >= 3;

  const [title, setTitle] = useState(chat.title || '');
  const [description, setDescription] = useState(chat.description || '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [bans, setBans] = useState([]);
  const [audit, setAudit] = useState(null);
  const [inviteName, setInviteName] = useState('');
  const [menu, setMenu] = useState(null); // { anchorEl, member }
  const [confirm, setConfirm] = useState(null); // { title, text, action }
  const { friends } = useFriends(myId, open && (isAdmin || !isChannel));
  useBackHandler(open, onClose);

  useEffect(() => {
    if (!open) return;
    setTitle(chat.title || ''); setDescription(chat.description || ''); setError(''); setInfo('');
  }, [open, chat.id, chat.title, chat.description]);

  async function loadBans() {
    const { data } = await supabase.from('chat_bans').select('user_id').eq('chat_id', chat.id);
    const ids = (data || []).map((b) => b.user_id);
    if (!ids.length) { setBans([]); return; }
    const { data: profs } = await supabase.from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', ids);
    setBans(profs || []);
  }
  async function loadAudit() {
    const { data } = await supabase.rpc('get_chat_audit', { p_chat: chat.id, p_limit: 40 });
    setAudit(data || []);
  }

  useEffect(() => {
    if (!open) return;
    if (isAdmin) loadBans();
    if (isStaff) loadAudit();
  }, [open, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Выполнить действие: показать ошибку или обновить данные
  async function run(fn, okMessage) {
    setBusy(true); setError(''); setInfo('');
    const { data, error: err } = await fn();
    setBusy(false);
    if (err) { setError(err.message); return null; }
    if (okMessage) setInfo(okMessage);
    await onChanged?.();
    if (isAdmin) loadBans();
    if (isStaff) loadAudit();
    return data ?? true;
  }

  const rpc = (name, args) => () => supabase.rpc(name, args);

  async function saveTexts() {
    await run(rpc('update_chat_settings', { p_chat: chat.id, p_title: title, p_description: description }), 'Сохранено');
  }

  async function pickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    const path = `${myId}/chat-${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (upErr) { setBusy(false); setError('Не удалось загрузить аватар: ' + upErr.message); return; }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    setBusy(false);
    await run(rpc('update_chat_settings', { p_chat: chat.id, p_avatar_url: url }), 'Аватар обновлён');
  }

  async function invite(username) {
    const res = await run(rpc('invite_to_chat', { p_chat: chat.id, p_username: username.replace(/^@/, '').trim() }));
    if (res) {
      setInfo(res === 'added' ? 'Пользователь добавлен' : 'Приглашение отправлено — человек увидит его в Mail');
      setInviteName('');
    }
  }

  // Что можно делать с конкретным участником
  function actionsFor(m) {
    if (m.user_id === myId) return null;
    const t = RANK[m.role];
    const canAct = isStaff && myRank > t;
    if (!canAct) return null;
    return {
      canRole: isAdmin && m.role !== 'owner' && !(myRole === 'admin' && m.role === 'admin'),
      canMakeAdmin: myRole === 'owner' && m.role !== 'admin',
      canMute: true,
      canBan: isAdmin,
    };
  }

  const muted = (m) => m.muted_until && new Date(m.muted_until) > new Date();
  const typeWord = isChannel ? 'канал' : 'группу';
  const members_ = members;
  const friendsToAdd = friends.filter((f) => !members_.some((m) => m.user_id === f.id));
  const menuActions = menu ? actionsFor(menu.member) : null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={!isDesktop} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { height: isDesktop ? '88vh' : '100%', bgcolor: (t) => t.m3.groupedBg } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 'calc(env(safe-area-inset-top, 0px) + 8px)', pb: 1, bgcolor: 'background.paper', borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Typography variant="titleMedium" sx={{ flex: 1 }}>{isChannel ? 'Информация о канале' : 'Информация о группе'}</Typography>
        <IconButton onClick={onClose}><CloseRoundedIcon /></IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, pb: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setInfo('')}>{info}</Alert>}

        {/* Шапка */}
        <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <Box sx={{ position: 'relative' }}>
            <FindlyAvatar src={chat.avatar_url} name={chat.title || 'Чат'} seed={chat.id} size={88} />
            {isAdmin && (
              <IconButton component="label" size="small" sx={{ position: 'absolute', right: -4, bottom: -4, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }}>
                <PhotoCameraRoundedIcon fontSize="small" />
                <input type="file" accept="image/*" hidden onChange={pickAvatar} />
              </IconButton>
            )}
          </Box>
          <Typography variant="headlineSmall">{chat.title}</Typography>
          <Typography variant="bodyMedium" color="text.secondary">
            {isChannel ? 'Канал' : 'Группа'} · {members.length} {isChannel ? 'подписчиков' : 'участников'}
          </Typography>
          {chat.description && <Typography variant="bodyMedium" sx={{ textAlign: 'center' }}>{chat.description}</Typography>}
        </Stack>

        {/* Настройки (владелец/админ) */}
        {isAdmin && (
          <Sec title="Настройки">
            <Stack spacing={2}>
              <TextField label="Название" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth />
              <TextField label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} size="small" fullWidth multiline maxRows={4} />
              <Button variant="outlined" onClick={saveTexts} disabled={busy} sx={{ alignSelf: 'flex-start' }}>Сохранить</Button>

              {!isChannel && (
                <Box>
                  <Typography variant="bodyMedium" gutterBottom>Медленный режим — пауза между сообщениями участников</Typography>
                  <Select
                    size="small" fullWidth value={chat.slow_mode_seconds || 0} disabled={busy}
                    onChange={(e) => run(rpc('update_chat_settings', { p_chat: chat.id, p_slow_mode: Number(e.target.value) }))}
                  >
                    {SLOW_OPTIONS.map((o) => <MenuItem key={o.seconds} value={o.seconds}>{o.label}</MenuItem>)}
                  </Select>
                  <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Владелец, админы и модераторы пишут без ограничений.
                  </Typography>
                </Box>
              )}

              {isChannel && (
                <FormControlLabel
                  control={<Switch checked={chat.comments_enabled !== false} disabled={busy} onChange={(e) => run(rpc('update_chat_settings', { p_chat: chat.id, p_comments: e.target.checked }))} />}
                  label="Комментарии под публикациями"
                />
              )}
            </Stack>
          </Sec>
        )}

        {/* Пригласить */}
        {(isAdmin || !isChannel) && (
          <Sec title={isChannel ? 'Добавить подписчиков' : 'Пригласить в группу'}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1}>
                <TextField size="small" fullWidth placeholder="@ник" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                <Button variant="contained" disabled={!inviteName.trim() || busy} onClick={() => invite(inviteName)}>Пригласить</Button>
              </Stack>
              <Typography variant="bodySmall" color="text.secondary">
                Друзей добавляем сразу, остальным уйдёт приглашение в Mail.
              </Typography>
              {friendsToAdd.length > 0 && (
                <Stack spacing={0.5}>
                  <Divider />
                  {friendsToAdd.map((f) => (
                    <Stack key={f.id} direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.5 }}>
                      <FindlyAvatar src={f.avatar_url} name={`${f.first_name} ${f.last_name}`} seed={f.username} size={34} />
                      <Typography sx={{ flex: 1, fontSize: 15 }} noWrap>{f.first_name} {f.last_name}</Typography>
                      <Button size="small" disabled={busy} onClick={() => invite(f.username)}>Добавить</Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Sec>
        )}

        {/* Участники */}
        <Sec title={`${isChannel ? 'Подписчики' : 'Участники'} · ${members.length}`}>
          <Stack spacing={0.5}>
            {members.map((m) => {
              const acts = actionsFor(m);
              return (
                <Stack key={m.user_id} direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.5 }}>
                  <FindlyAvatar src={m.avatar_url} name={`${m.first_name || ''} ${m.last_name || ''}`} seed={m.username} size={40} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 16 }}>
                      {m.first_name} {m.last_name}{m.user_id === myId ? ' (вы)' : ''}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary' }}>
                      @{m.username}{muted(m) ? ' · заглушён' : ''}
                    </Typography>
                  </Box>
                  {ROLE_LABEL[m.role] && (
                    <Chip size="small" icon={m.role === 'owner' ? <ShieldRoundedIcon /> : <AdminPanelSettingsRoundedIcon />} label={ROLE_LABEL[m.role]} color={m.role === 'member' ? 'default' : 'primary'} variant="outlined" />
                  )}
                  {acts && (
                    <IconButton size="small" onClick={(e) => setMenu({ anchorEl: e.currentTarget, member: m })}><MoreVertRoundedIcon /></IconButton>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Sec>

        {/* Забаненные */}
        {isAdmin && bans.length > 0 && (
          <Sec title={`Забаненные · ${bans.length}`}>
            <Stack spacing={0.5}>
              {bans.map((b) => (
                <Stack key={b.id} direction="row" alignItems="center" spacing={1.25}>
                  <FindlyAvatar src={b.avatar_url} name={`${b.first_name} ${b.last_name}`} seed={b.username} size={34} />
                  <Typography sx={{ flex: 1 }} noWrap>{b.first_name} {b.last_name}</Typography>
                  <Button size="small" onClick={() => run(rpc('unban_member', { p_chat: chat.id, p_user: b.id }))}>Разбанить</Button>
                </Stack>
              ))}
            </Stack>
          </Sec>
        )}

        {/* Журнал действий */}
        {isStaff && (
          <Sec title="Журнал действий">
            {audit === null ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={20} /></Box>
            ) : audit.length === 0 ? (
              <Typography variant="bodyMedium" color="text.secondary">Пока пусто.</Typography>
            ) : (
              <Stack spacing={1}>
                {audit.map((e, i) => (
                  <Box key={i}>
                    <Typography sx={{ fontSize: 14 }}>{formatAudit(e)}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {new Date(e.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Sec>
        )}

        {/* Выход / удаление */}
        <Sec>
          <Stack spacing={1}>
            <ButtonBase
              onClick={() => setConfirm({
                title: `Покинуть ${typeWord}?`,
                text: myRole === 'owner' ? 'Владение перейдёт самому старшему по роли участнику. Если вы последний — чат будет удалён.' : 'Вы больше не будете получать сообщения.',
                action: async () => { const r = await run(rpc('leave_chat', { p_chat: chat.id })); if (r) onLeft?.(); },
              })}
              sx={{ justifyContent: 'flex-start', gap: 1.5, color: 'error.main', py: 1, borderRadius: 2 }}
            >
              <LogoutRoundedIcon /> <Typography>Покинуть {typeWord}</Typography>
            </ButtonBase>
            {myRole === 'owner' && (
              <ButtonBase
                onClick={() => setConfirm({
                  title: `Удалить ${typeWord} для всех?`,
                  text: 'Все сообщения и участники будут удалены без возможности восстановления.',
                  action: async () => { const r = await run(rpc('delete_chat', { p_chat: chat.id })); if (r) onLeft?.(); },
                })}
                sx={{ justifyContent: 'flex-start', gap: 1.5, color: 'error.main', py: 1, borderRadius: 2 }}
              >
                <DeleteForeverRoundedIcon /> <Typography>Удалить {typeWord}</Typography>
              </ButtonBase>
            )}
          </Stack>
        </Sec>
      </Box>

      {/* Меню действий над участником */}
      <Menu anchorEl={menu?.anchorEl} open={!!menu && !!menuActions} onClose={() => setMenu(null)}>
        {menu && menuActions && [
          menuActions.canRole && menu.member.role !== 'moderator' && menu.member.role !== 'admin' && (
            <MenuItem key="mod" onClick={() => { run(rpc('set_member_role', { p_chat: chat.id, p_user: menu.member.user_id, p_role: 'moderator' })); setMenu(null); }}>
              <ListItemIcon><AdminPanelSettingsRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Сделать модератором</ListItemText>
            </MenuItem>
          ),
          menuActions.canRole && (menu.member.role === 'moderator' || menu.member.role === 'admin') && (
            <MenuItem key="unmod" onClick={() => { run(rpc('set_member_role', { p_chat: chat.id, p_user: menu.member.user_id, p_role: 'member' })); setMenu(null); }}>
              <ListItemIcon><AdminPanelSettingsRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Снять {menu.member.role === 'admin' ? 'администратора' : 'модератора'}</ListItemText>
            </MenuItem>
          ),
          menuActions.canMakeAdmin && (
            <MenuItem key="admin" onClick={() => { run(rpc('set_member_role', { p_chat: chat.id, p_user: menu.member.user_id, p_role: 'admin' })); setMenu(null); }}>
              <ListItemIcon><ShieldRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Сделать администратором</ListItemText>
            </MenuItem>
          ),
          <ListSubheader key="mute-h" sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>Заглушить</ListSubheader>,
          ...MUTE_OPTIONS.map((o) => (
            <MenuItem key={`mute-${o.minutes}`} onClick={() => { run(rpc('mute_member', { p_chat: chat.id, p_user: menu.member.user_id, p_minutes: o.minutes })); setMenu(null); }}>
              <ListItemIcon><VolumeOffRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{o.label}</ListItemText>
            </MenuItem>
          )),
          muted(menu.member) && (
            <MenuItem key="unmute" onClick={() => { run(rpc('mute_member', { p_chat: chat.id, p_user: menu.member.user_id, p_minutes: 0 })); setMenu(null); }}>
              <ListItemIcon><VolumeUpRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Снять мут</ListItemText>
            </MenuItem>
          ),
          <Divider key="div" />,
          <MenuItem key="kick" sx={{ color: 'error.main' }} onClick={() => { const m = menu.member; setMenu(null); setConfirm({ title: 'Исключить участника?', text: `${m.first_name} ${m.last_name} сможет вернуться по приглашению.`, action: () => run(rpc('kick_member', { p_chat: chat.id, p_user: m.user_id })) }); }}>
            <ListItemIcon><PersonRemoveRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Исключить</ListItemText>
          </MenuItem>,
          menuActions.canBan && (
            <MenuItem key="ban" sx={{ color: 'error.main' }} onClick={() => { const m = menu.member; setMenu(null); setConfirm({ title: 'Забанить участника?', text: `${m.first_name} ${m.last_name} не сможет вернуться, пока вы не разбаните.`, action: () => run(rpc('ban_member', { p_chat: chat.id, p_user: m.user_id })) }); }}>
              <ListItemIcon><BlockRoundedIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Забанить</ListItemText>
            </MenuItem>
          ),
        ].filter(Boolean)}
      </Menu>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent><Typography variant="bodyMedium">{confirm?.text}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Отмена</Button>
          <Button color="error" onClick={() => { const c = confirm; setConfirm(null); c.action(); }}>Подтвердить</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
