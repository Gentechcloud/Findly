import { useState } from 'react';
import { Box, Typography, ButtonBase } from '@mui/material';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { IosHeader, IosBackButton, IosSection, IosRow } from '../../components/ios/IosKit';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import AppearanceSettings from './AppearanceSettings';
import SecurityPrivacyAccount from './SecurityPrivacyAccount';
import { useBackHandler } from '../../native';
import { BUILD_TAG } from '../../buildInfo';

// Настройки в стиле Telegram iOS: список разделов → вложенные экраны
export default function IosSettings({ profile, username, email, myId, onProfileRefresh, onLogout, onOpenSearch, onOpenProfile }) {
  const [page, setPage] = useState(null);
  useBackHandler(!!page, () => setPage(null));

  const titles = { appearance: 'Оформление', privacy: 'Приватность и безопасность', account: 'Аккаунт' };
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  if (page) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, bgcolor: (t) => t.m3.groupedBg }}>
        <IosHeader title={titles[page]} left={<IosBackButton label="Настройки" onClick={() => setPage(null)} />} />
        <Box sx={{ flex: 1, overflowY: 'auto', py: 2, px: 1.5 }}>
          {page === 'appearance' && <AppearanceSettings />}
          {page === 'privacy' && <SecurityPrivacyAccount section="privacy" myId={myId} profile={profile} email={email} onProfileRefresh={onProfileRefresh} />}
          {page === 'account' && <SecurityPrivacyAccount section="account" myId={myId} profile={profile} email={email} onProfileRefresh={onProfileRefresh} />}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, bgcolor: (t) => t.m3.groupedBg }}>
      <IosHeader title="Настройки" />
      <Box sx={{ flex: 1, overflowY: 'auto', pt: 2, pb: 3 }}>
        <Box sx={{ mx: 1.5, mb: 2.5, borderRadius: '12px', overflow: 'hidden', bgcolor: (t) => t.m3.groupedItem }}>
          <ButtonBase onClick={onOpenProfile} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.75, p: 1.75, textAlign: 'left', borderRadius: 0 }}>
            <FindlyAvatar src={profile?.avatar_url} name={fullName} seed={username} size={64} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 20, fontWeight: 600 }}>{fullName || username}</Typography>
              <Typography noWrap sx={{ fontSize: 15, color: 'text.secondary' }}>@{username}</Typography>
            </Box>
            <ChevronRightRoundedIcon sx={{ color: 'text.secondary', opacity: 0.6 }} />
          </ButtonBase>
        </Box>

        <IosSection inset={58}>
          <IosRow icon={<SearchRoundedIcon />} iconColor="#007AFF" title="Поиск (Findline)" onClick={onOpenSearch} />
        </IosSection>

        <IosSection inset={58}>
          <IosRow icon={<PaletteRoundedIcon />} iconColor="#FF9500" title="Оформление" onClick={() => setPage('appearance')} />
          <IosRow icon={<LockRoundedIcon />} iconColor="#8E8E93" title="Приватность и безопасность" onClick={() => setPage('privacy')} />
          <IosRow icon={<KeyRoundedIcon />} iconColor="#34C759" title="Аккаунт" subtitle="Пароль, ник, почта" onClick={() => setPage('account')} />
        </IosSection>

        <IosSection>
          <IosRow title="Выйти из аккаунта" danger chevron={false} onClick={onLogout} />
        </IosSection>

        <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', opacity: 0.7 }}>
          Findly · сборка {BUILD_TAG}
        </Typography>
      </Box>
    </Box>
  );
}
