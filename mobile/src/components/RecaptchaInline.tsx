import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors, radius } from '../theme';

interface RecaptchaInlineProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

// Google's reCAPTCHA v2 has no React Native SDK, so this loads the same
// checkbox widget the web app uses (react-google-recaptcha) inside a WebView
// and bridges the token back via postMessage — the only piece a WebView
// script can use to talk to RN. Rendered inline in the Register form (per
// the LUMEN design), rather than behind a submit-triggered modal.
const buildHtml = (siteKey: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<style>
  html, body { margin: 0; height: 100%; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<div class="g-recaptcha" data-sitekey="${siteKey}" data-callback="onVerify" data-expired-callback="onExpire"></div>
<script>
  function onVerify(token) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verify', token: token }));
  }
  function onExpire() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expire' }));
  }
</script>
</body>
</html>`;

export default function RecaptchaInline({ siteKey, onVerify, onExpire }: RecaptchaInlineProps) {
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        token?: string;
      };
      if (data.type === 'verify' && data.token) {
        onVerify(data.token);
      } else if (data.type === 'expire') {
        onExpire?.();
      }
    } catch {
      // Ignore malformed messages — nothing else posts to this bridge.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(siteKey) }}
        onMessage={handleMessage}
        style={styles.webview}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
