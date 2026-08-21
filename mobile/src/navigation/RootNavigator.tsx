import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import { colors } from '../theme';

// Extends React Navigation's DarkTheme (not building a theme from scratch)
// so default chrome (header back-button tint, etc.) looks reasonable, then
// overrides the tokens that need to match the brand palette.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.textPrimary,
    primary: colors.accent,
    border: colors.border,
  },
};

// A single NavigationContainer/Stack tree that conditionally renders either
// the auth screens or the main app, switching on AuthContext's
// isAuthenticated — rather than swapping which NavigationContainer is
// mounted, which would lose navigator state and cause flicker on login.
export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoading: isLanguageLoading } = useLanguage();

  if (isLoading || isLanguageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
