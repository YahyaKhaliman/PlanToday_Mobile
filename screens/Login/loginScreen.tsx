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
        // silent
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
      colors={['#5D59A2', '#3B3A82', '#1E224F']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.welcomeText}>SELAMAT DATANG</Text>
            <Text style={styles.subWelcomeText}>PLAN TODAY</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Username */}
            <View style={styles.glassInputContainer}>
              <Text style={styles.iconPlaceholder}>👤</Text>
              <TextInput
                placeholder="Username"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            {/* Password */}
            <View style={styles.glassInputContainer}>
              <Text style={styles.iconPlaceholder}>🔒</Text>
              <TextInput
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingHorizontal: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {showPass ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>


            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!canLogin}
              style={[styles.loginButton, !canLogin && { opacity: 0.7 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Login</Text>}
            </TouchableOpacity>

            {/* Register */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.footerLink}
              disabled={loading}
            >
              <Text style={styles.footerText}>
                <Text style={styles.footerLinkBold}>Register</Text>
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
    paddingHorizontal: 30,
  },
  header: { alignItems: 'center', marginBottom: 50 },
  welcomeText: { fontSize: 30, fontWeight: '300', color: '#FFFFFF' },
  subWelcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  formContainer: { width: '100%' },
  glassInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 55,
  },
  iconPlaceholder: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: '#233975',
    borderRadius: 30,
    paddingVertical: 15,
    marginTop: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  footerLink: { marginTop: 20, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  footerLinkBold: { fontWeight: 'bold', textDecorationLine: 'underline' },
});
