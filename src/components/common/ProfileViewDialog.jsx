import { Dialog, DialogContent, Stack, Typography, IconButton, Box } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FindlyAvatar from './FindlyAvatar';

export default function ProfileViewDialog({ open, onClose, profile }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 5 } }}>
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
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
