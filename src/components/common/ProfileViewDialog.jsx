import {
  Dialog,
  DialogContent,
  Typography,
  IconButton,
  Box,
  Button,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import FindlyAvatar from './FindlyAvatar';
import { useBackHandler } from '../../native';

import Stack from './Stack';
export default function ProfileViewDialog({ open, onClose, profile, onBlock, blocked }) {
  useBackHandler(open, onClose);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <IconButton onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8 }}>
        <CloseRoundedIcon />
      </IconButton>
      <DialogContent sx={{ pt: 5, pb: 4 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <FindlyAvatar src={profile?.avatar_url} name={`${profile?.first_name || ''} ${profile?.last_name || ''}`} seed={profile?.username} size={96} />
          <Box>
            <Typography variant="headlineSmall">{profile?.first_name} {profile?.last_name}</Typography>
            <Typography variant="bodyMedium" color="text.secondary">@{profile?.username}</Typography>
          </Box>
          {profile?.bio && <Typography variant="bodyMedium">{profile.bio}</Typography>}
          <Typography variant="labelSmall" color="text.secondary">
            Публикации, лайки и рейтинг появятся здесь на Этапе 9
          </Typography>
          {onBlock && (
            <Button color="error" startIcon={<BlockRoundedIcon />} onClick={onBlock} disabled={blocked}>
              {blocked ? 'Пользователь заблокирован' : 'Заблокировать'}
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
