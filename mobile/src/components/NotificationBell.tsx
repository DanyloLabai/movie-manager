import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getNotifications } from '../api/movies.api';
import { getFriendRequests } from '../api/users.api';
import { colors } from '../theme';
import type { MainStackParamList } from '../navigation/MainStack';

const POLL_INTERVAL_MS = 60000;

// Polls for unread notifications + pending friend requests, same as
// movie-frontend's NotificationBell.tsx (no push/websocket channel exists
// for this yet on either platform).
export default function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const [requests, notifications] = await Promise.all([
          getFriendRequests(),
          getNotifications(),
        ]);
        if (cancelled) return;
        const unread = notifications.filter((n) => !n.isRead).length;
        setCount(requests.length + unread);
      } catch {
        // Best-effort — badge just stays at its last known count.
      }
    };
    void fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
      <Ionicons name="notifications-outline" size={20} color={colors.textSubtle} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 9,
  },
});
