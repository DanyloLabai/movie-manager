import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import AiChatScreen from '../screens/aichat/AiChatScreen';
import SearchScreen from '../screens/search/SearchScreen';
import QuizScreen from '../screens/quiz/QuizScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { colors } from '../theme';

export type AppTabsParamList = {
  AiChat: undefined;
  Search: undefined;
  Quiz: undefined;
  Profile: { tab?: 'profile' | 'watchlist' | 'watched' } | undefined;
  Settings: undefined;
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// @expo/vector-icons ships bundled with Expo itself (already in node_modules
// as a dependency of the `expo` package) — not a new dependency being added.
// Matches the 5-tab bar in movie-frontend's BottomNav.tsx: AI Chat, Search,
// Quiz, Profile (route label is "watchlist" there, tab label is "Profile"),
// Settings.
const TAB_ICONS: Record<keyof AppTabsParamList, { active: IoniconName; inactive: IoniconName }> = {
  AiChat: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Quiz: { active: 'help-circle', inactive: 'help-circle-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = TAB_ICONS[route.name as keyof AppTabsParamList];
          return (
            <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="AiChat" component={AiChatScreen} options={{ title: 'AI Chat' }} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Quiz" component={QuizScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
