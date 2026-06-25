// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { reloadAppAsync } from 'expo';
import { useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import colors from '../theme/colors';
import { logError } from '../utils/errorLogger';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

async function reloadApp() {
  try {
    await reloadAppAsync('User requested reload from error boundary');
  } catch (error) {
    if (error instanceof Error) {
      logError(error);
    } else {
      logError(new Error('Unable to reload app from error boundary'));
    }
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const router = useRouter();

  const handleReturnHome = () => {
    onReset();
    router.replace('/coming-soon');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/ipm-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>The app encountered an unexpected error.</Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={reloadApp}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Reload App</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleReturnHome}
            style={({ pressed }) => [
              styles.button,
              styles.ghostButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.ghostButtonText}>Return Home</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.reset} />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  content: {
    alignSelf: 'center',
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  logo: {
    width: 136,
    height: 136,
    marginBottom: 28,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 28,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  ghostButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
