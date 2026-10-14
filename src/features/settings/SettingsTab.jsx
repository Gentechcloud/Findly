import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SecurityPrivacyAccount from './SecurityPrivacyAccount';
import AppearanceSettings from './AppearanceSettings';
import { BUILD_TAG } from '../../buildInfo';

import Stack from '../../components/common/Stack';
// Настройки для ПК и Material-версии: всё на одной странице
export default function SettingsTab({ onLogout, myId, profile, email, onProfileRefresh, onOpenSearch }) {
  return (
    <Stack spacing={3} sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="headlineSmall">Настройки</Typography>

      <Card variant="outlined" sx={{ cursor: 'pointer' }} onClick={onOpenSearch}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: 2 } }}>
          <SearchRoundedIcon color="action" />
          <Box>
            <Typography variant="titleMedium">Поиск (Findline)</Typography>
            <Typography variant="bodyMedium" color="text.secondary">Поиск по чатам, сообщениям и @никам</Typography>
          </Box>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="titleMedium" sx={{ mb: 1.5 }}>Оформление</Typography>
        <AppearanceSettings />
      </Box>

      <SecurityPrivacyAccount myId={myId} profile={profile} email={email} onProfileRefresh={onProfileRefresh} />

      <Button variant="outlined" color="error" onClick={onLogout} sx={{ borderColor: 'error.main', color: 'error.main', alignSelf: 'center' }}>
        Выйти из аккаунта
      </Button>

      <Typography variant="labelSmall" color="text.secondary" sx={{ textAlign: 'center', opacity: 0.6 }}>
        Findly · сборка {BUILD_TAG}
      </Typography>
    </Stack>
  );
}
