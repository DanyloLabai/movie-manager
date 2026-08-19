import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppTabs from './AppTabs';
import MovieDetailScreen from '../screens/movie/MovieDetailScreen';
import ActorDetailScreen from '../screens/actor/ActorDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import Top100Screen from '../screens/top100/Top100Screen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import { colors } from '../theme';

export type MainStackParamList = {
  Tabs: undefined;
  MovieDetail: { movieId: number; title?: string; mediaType?: 'movie' | 'tv' };
  ActorDetail: { actorId: number; name?: string };
  Notifications: undefined;
  Top100: { type: 'movie' | 'tv' };
  PublicProfile: { userId: number; username?: string };
  Discover: undefined;
  ChangePassword: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.backgroundElevated },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ActorDetail" component={ActorDetailScreen} options={{ title: '' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen name="Top100" component={Top100Screen} options={{ title: 'Top 100' }} />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: 'Discover', headerShown: false }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Security' }}
      />
    </Stack.Navigator>
  );
}
