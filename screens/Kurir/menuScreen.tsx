/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  BackHandler,
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  StatusBar,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/authContext';
import { usePressGuard } from '../../utils/usePressGuard';

type MenuItem = {
  title: string;
  route: string;
  icon?: string;
  subtitle?: string;
};

const menus: MenuItem[] = [
  {
    title: 'Jadwal Kirim',
    route: 'KurirJadwalKirim',
    icon: '📦',
    subtitle: 'Rekap jadwal bulanan / beberapa hari ke depan',
  },
  {
    title: 'Rencana Kirim',
    route: 'KurirRencanaKirim',
    icon: '🗓️',
    subtitle: 'Rekap rencana dan tambah jadwal pengiriman',
  },
  {
    title: 'Kirim',
    route: 'KurirKirim',
    icon: '🚚',
    subtitle: 'Rekap kiriman yang telah diselesaikan',
  },
];

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

export default function KurirMenuScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const runGuardedPress = usePressGuard();
  const [isModalVisible, setModalVisible] = React.useState(false);

  const toggleModal = () => {
    runGuardedPress(
      'kurir-menu:toggle-modal',
      () => {
        setModalVisible(v => !v);
      },
      250,
    );
  };

  const initials = React.useMemo(() => {
    const name = (user?.nama || 'KURIR').trim();
    if (!name) return 'K';
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join('') || 'K';
  }, [user?.nama]);

  const handleNavigate = (route: string) => {
    runGuardedPress(`kurir-menu:navigate:${route}`, () => {
      navigation.navigate(route);
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      const goHome = () => {
        navigation.navigate('Home');
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        goHome,
      );

      const unsubscribeBeforeRemove = navigation.addListener(
        'beforeRemove',
        (e: any) => {
          if (e?.data?.action?.type === 'NAVIGATE') {
            return;
          }
          e.preventDefault();
          navigation.navigate('Home');
        },
      );

      return () => {
        backHandler.remove();
        unsubscribeBeforeRemove();
      };
    }, [navigation]),
  );

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.pagePad}>
          <LinearGradient
            colors={[
              'rgba(79,70,229,0.16)',
              'rgba(6,182,212,0.10)',
              'rgba(255,255,255,0.00)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCenter}>
                <Text style={styles.brandTextBig}>PlanToday</Text>
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <LinearGradient
                  colors={[THEME.primary, THEME.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user?.nama || 'KURIR'}
                  </Text>

                  <View style={styles.userMetaRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {user?.jabatan || 'KURIR'}
                      </Text>
                    </View>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.userCity} numberOfLines={1}>
                      {user?.cabang || '-'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleNavigate('GantiPassword')}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={[THEME.primary, THEME.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.quickBtn, styles.quickBtnPrimary]}
                  >
                    <Text style={styles.quickTextPrimary}>Ganti Password</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickBtn, styles.quickBtnDanger]}
                  onPress={toggleModal}
                  activeOpacity={0.9}
                >
                  <Text style={styles.quickTextDanger}>Keluar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          <Text style={styles.sectionTitle}>Menu</Text>
        </View>

        <FlatList
          data={menus}
          keyExtractor={(item, idx) => `${item.route}-${idx}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['rgba(79,70,229,0.20)', 'rgba(6,182,212,0.16)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.menuRowIconWrap}
              >
                <Text style={styles.menuRowIcon}>{item.icon || '▫️'}</Text>
              </LinearGradient>

              <View style={styles.menuRowText}>
                <Text style={styles.menuRowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.menuRowHint} numberOfLines={1}>
                  {item.subtitle || 'Tap untuk buka'}
                </Text>
              </View>

              <View style={styles.menuRowChevronWrap}>
                <Text style={styles.menuRowChevron}>›</Text>
              </View>

              <LinearGradient
                colors={['rgba(79,70,229,0.35)', 'rgba(6,182,212,0.35)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.menuRowAccent}
              />
            </TouchableOpacity>
          )}
        />

        <Modal
          isVisible={isModalVisible}
          onBackdropPress={toggleModal}
          backdropOpacity={0.45}
          animationIn="zoomIn"
          animationOut="zoomOut"
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Konfirmasi</Text>
            <Text style={styles.modalSubtitle}>Yakin ingin keluar?</Text>
            <Text style={styles.modalUserName}>
              {(user?.nama || '').toUpperCase()}
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={toggleModal}
                activeOpacity={0.85}
              >
                <Text style={styles.textCancel}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnLogoutConfirm}
                onPress={() => {
                  runGuardedPress('kurir-menu:logout', () => {
                    setModalVisible(false);
                    logout();
                  });
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.textLogout}>Keluar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  pagePad: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 8,
  },
  hero: {
    borderRadius: 26,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.12)',
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  brandTextBig: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', letterSpacing: 0.6 },
  userName: { color: THEME.ink, fontSize: 19, fontWeight: '900' },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  badgeText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  dot: { marginHorizontal: 8, color: THEME.muted, fontWeight: '900' },
  userCity: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  quickBtnPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  quickBtnDanger: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
  },
  quickTextPrimary: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  quickTextDanger: { color: THEME.danger, fontWeight: '900', fontSize: 13 },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 6,
    gap: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  menuRowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.14)',
  },
  menuRowIcon: { fontSize: 18 },
  menuRowText: { flex: 1 },
  menuRowTitle: { color: THEME.ink, fontSize: 14, fontWeight: '900' },
  menuRowHint: {
    marginTop: 4,
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  menuRowChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  menuRowChevron: {
    color: THEME.muted,
    fontSize: 18,
    fontWeight: '900',
    marginTop: -2,
  },
  menuRowAccent: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },

  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalIndicator: {
    width: 44,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink },
  modalSubtitle: {
    marginTop: 10,
    fontSize: 13,
    color: THEME.muted,
    textAlign: 'center',
  },
  modalUserName: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.6,
  },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
  },
  btnLogoutConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.danger,
    alignItems: 'center',
  },
  textCancel: { color: THEME.muted, fontWeight: '900' },
  textLogout: { color: '#FFF', fontWeight: '900' },
});
