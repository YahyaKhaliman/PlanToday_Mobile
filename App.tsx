import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DeviceInfo from 'react-native-device-info';
import { AuthProvider } from './context/authContext';
import AppNavigator from './navigation/appNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './components/toastCustomComponent';
import {
  AppUpdateManifest,
  checkAppUpdate,
  downloadUpdateApk,
} from './services/appUpdate';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.10)',
  overlay: 'rgba(15,23,42,0.45)',
};

export default function App() {
  const [pendingUpdate, setPendingUpdate] = useState<AppUpdateManifest | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const modalTranslateY = useRef(new Animated.Value(28)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const runUpdateCheck = async () => {
      const update = await checkAppUpdate();

      if (!update || !update.apkUrl) {
        return;
      }

      setPendingUpdate(update);
    };

    runUpdateCheck();
  }, []);

  useEffect(() => {
    if (!pendingUpdate) {
      return;
    }

    modalTranslateY.setValue(28);
    modalOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pendingUpdate, modalOpacity, modalTranslateY]);

  const handleUpdatePress = async () => {
    if (!pendingUpdate || isUpdating) {
      return;
    }

    setIsUpdating(true);
    const downloaded = await downloadUpdateApk(pendingUpdate);

    if (!downloaded) {
      await Linking.openURL(pendingUpdate.apkUrl);
    }

    setIsUpdating(false);
    setPendingUpdate(null);
  };

  const showSkipButton = useMemo(
    () => Boolean(pendingUpdate && !pendingUpdate.mandatory),
    [pendingUpdate],
  );

  const currentVersionLabel = useMemo(
    () => `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
    [],
  );

  const latestVersionLabel = useMemo(() => {
    if (!pendingUpdate) {
      return '-';
    }

    return `${pendingUpdate.versionName} (${pendingUpdate.versionCode})`;
  }, [pendingUpdate]);

  return (
    <>
      <AuthProvider>
        <AppNavigator />
        <Toast config={toastConfig} />
      </AuthProvider>

      <Modal
        visible={Boolean(pendingUpdate)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (showSkipButton) {
            setPendingUpdate(null);
          }
        }}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: modalOpacity,
                transform: [{ translateY: modalTranslateY }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(79,70,229,0.14)', 'rgba(6,182,212,0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <Text style={styles.badge}>SYSTEM</Text>
              <Text style={styles.title}>Update Tersedia</Text>
              <Text style={styles.subtitle}>
                Versi {pendingUpdate?.versionName} siap diunduh.
              </Text>
            </LinearGradient>

            <View style={styles.body}>
              <View style={styles.versionCompare}>
                <View style={styles.versionCard}>
                  <Text style={styles.versionLabel}>Saat Ini</Text>
                  <Text style={styles.versionValue}>{currentVersionLabel}</Text>
                </View>
                <View style={styles.versionCard}>
                  <Text style={styles.versionLabel}>Tersedia</Text>
                  <Text style={styles.versionValue}>{latestVersionLabel}</Text>
                </View>
              </View>

              <Text style={styles.caption}>Detail rilis</Text>
              <Text style={styles.notesText}>
                {pendingUpdate?.notes ||
                  'Performa dan stabilitas aplikasi ditingkatkan.'}
              </Text>
            </View>

            <View style={styles.actions}>
              {showSkipButton && (
                <Pressable
                  onPress={() => setPendingUpdate(null)}
                  disabled={isUpdating}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Nanti</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleUpdatePress}
                disabled={isUpdating}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isUpdating && styles.primaryButtonDisabled,
                ]}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Sekarang</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: THEME.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.line,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(79,70,229,0.14)',
    color: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  title: {
    color: THEME.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  versionCompare: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  versionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  versionLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  versionValue: {
    marginTop: 4,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  caption: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  notesText: {
    marginTop: 8,
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingTop: 18,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  secondaryButtonText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1.25,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
