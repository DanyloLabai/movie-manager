import { useFonts, Archivo_700Bold } from '@expo-google-fonts/archivo';

// Only the LUMEN wordmark uses a custom font file (matching movie-frontend's
// font-ui/font-bold pairing for that text specifically) — everywhere else in
// the app keeps the system font, since the rest of the UI already relies on
// numeric fontWeight variants that only the system font renders correctly.
export function useAppFonts() {
  const [fontsLoaded] = useFonts({ Archivo_700Bold });
  return fontsLoaded;
}
