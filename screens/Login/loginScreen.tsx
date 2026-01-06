/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';

const THEME = {
  primary: '#4F46E5', 
  accent: '#06B6D4', 
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

export default function LoginScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rememberMe, setRememberMe] = useState(false);

  const { setUser } = useAuth();

  const canLogin = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !loading;
  }, [username, password, loading]);

  useEffect(() => {
    const checkDevice = async () => {
      try {
        const deviceId = await DeviceInfo.getAndroidId();
        const res = await api.post('/check-device', { deviceId });
        if (res.data?.success && res.data?.username) {
          setUsername(String(res.data.username));
        }
      } catch {
      }
    };
    checkDevice();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const deviceId = await DeviceInfo.getAndroidId();
      const res = await api.post('/login', {
        username: username.trim(),
        password,
        deviceId,
      });

      if (!res.data?.success) {
        Toast.show({
          type: 'glassError',
          text1: 'Login Gagal',
          text2: res.data.message,
        });
        return;
      }
      setUser(res.data.user);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Gagal koneksi ke server';
      Toast.show({
        type: 'glassError',
        text1: 'Sistem Error',
        text2: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.appTitle}>PlanToday</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>LOGIN</Text>

            {/* Username */}
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputContainer}>
              <LinearGradient
                colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.inputIconWrap}
              >
                <Text style={styles.iconPlaceholder}>👤</Text>
              </LinearGradient>

              <TextInput
                placeholder="..."
                placeholderTextColor={THEME.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                editable={!loading}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <LinearGradient
                colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.inputIconWrap}
              >
                <Text style={styles.iconPlaceholder}>🔒</Text>
              </LinearGradient>

              <TextInput
                placeholder="***"
                placeholderTextColor={THEME.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                style={styles.input}
                editable={!loading}
                returnKeyType="done"
              />

              <TouchableOpacity
                onPress={() => setShowPass(v => !v)}
                style={styles.showBtn}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.showBtnText}>{showPass ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!canLogin}
              activeOpacity={0.9}
              style={{ marginTop: 8, opacity: canLogin ? 1 : 0.65 }}
            >
              <LinearGradient
                colors={[THEME.primary, THEME.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginButton}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.footerLink}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.footerText}>
                Belum punya akun? <Text style={styles.footerLinkBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 54 : 10,
    paddingBottom: 24,
  },

  /* Header */
  header: { alignItems: 'center', marginBottom: 18 },
  appTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.6,
  },

  formCard: {
    backgroundColor: THEME.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  formTitle: {
    color: THEME.muted,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  label: {
    color: THEME.muted,
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 6,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  /* Input */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 55,
  },

  inputIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.14)',
    marginRight: 10,
  },
  iconPlaceholder: { fontSize: 16 },

  input: { flex: 1, color: THEME.ink, fontSize: 16, fontWeight: '700' },

  showBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  showBtnText: { color: THEME.muted, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },

  /* Primary button */
  loginButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  footerLink: { marginTop: 14, alignItems: 'center' },
  footerText: { color: THEME.muted, fontSize: 13, fontWeight: '700' },
  footerLinkBold: { fontWeight: '900', textDecorationLine: 'underline', color: THEME.ink },

  bottomNote: {
    marginTop: 18,
    textAlign: 'center',
    color: 'rgba(100,116,139,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
});
