import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Список друзей (принятые заявки) с профилями. enabled=false — не грузить.
export default function useFriends(myId, enabled = true, refreshKey = 0) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rels } = await supabase
        .from('friend_requests').select('from_user, to_user')
        .eq('status', 'accepted').or(`from_user.eq.${myId},to_user.eq.${myId}`);
      const ids = (rels || []).map((r) => (r.from_user === myId ? r.to_user : r.from_user));
      if (!ids.length) { if (!cancelled) { setFriends([]); setLoading(false); } return; }
      const { data: profs } = await supabase
        .from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', ids);
      if (!cancelled) { setFriends(profs || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [myId, enabled, refreshKey]);

  return { friends, loading };
}
