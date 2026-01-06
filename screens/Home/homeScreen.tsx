/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useState } from 'react';
import {
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

type Role = 'SALES' | 'MANAGER';
type MenuItem = {
    title: string;
    route: string;
    roles?: Role[];
    icon?: string;
};

const menus: MenuItem[] = [
    { title: 'Calon Customer', route: 'RekapCalonCustomer', roles: ['SALES', 'MANAGER'], icon: '👥' },
    { title: 'Visit Plan', route: 'VisitPlan', roles: ['SALES', 'MANAGER'], icon: '🗓️' },
    { title: 'Visit', route: 'Visit', roles: ['SALES', 'MANAGER'], icon: '📍' },
];

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

export default function HomeScreen({ navigation }: any) {
    const { user, logout } = useAuth();
    const [isModalVisible, setModalVisible] = useState(false);
    const toggleModal = () => setModalVisible(v => !v);

    const handleNavigate = (route: string) => {
        try {
        navigation.navigate(route);
        } catch {
        console.log('Menu belum tersedia:', route);
        }
    };

    const availableMenus = useMemo(() => {
        return menus.filter(m => !m.roles || m.roles.includes(user?.jabatan as Role));
    }, [user?.jabatan]);

    const initials = useMemo(() => {
        const name = (user?.nama || '').trim();
        if (!name) return 'U';
        const parts = name.split(/\s+/).slice(0, 2);
        return parts.map(p => p[0]?.toUpperCase()).join('') || 'U';
    }, [user?.nama]);

    return (
        <LinearGradient
        colors={[THEME.bgTop, THEME.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
        >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <SafeAreaView style={styles.safe}>
            <View style={styles.pagePad}>
            {/* HERO */}
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
                {/* HEADER */}
                <View style={styles.headerRow}>
                <View style={styles.headerCenter}>
                    <Text style={styles.brandTextBig}>Plan Today</Text>
                </View>
                </View>

                {/* Profile Card */}
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
                        {user?.nama || '-'}
                    </Text>

                    <View style={styles.userMetaRow}>
                        <View style={styles.badge}>
                        <Text style={styles.badgeText}>{user?.jabatan || '-'}</Text>
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

            {/* MENU VERTIKAL MEMANJANG */}
            <FlatList
            data={availableMenus}
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
                    <Text style={styles.menuRowHint}>Tap untuk buka</Text>
                </View>

                <View style={styles.menuRowChevronWrap}>
                    <Text style={styles.menuRowChevron}>›</Text>
                </View>

                {/* Accent kanan */}
                <LinearGradient
                    colors={['rgba(79,70,229,0.35)', 'rgba(6,182,212,0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.menuRowAccent}
                />
                </TouchableOpacity>
            )}
            />

            {/* Modal logout */}
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
                <Text style={styles.modalUserName}>{(user?.nama || '').toUpperCase()}</Text>

                <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={toggleModal} activeOpacity={0.85}>
                    <Text style={styles.textCancel}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.btnLogoutConfirm}
                    onPress={() => {
                    toggleModal();
                    logout();
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

    /* HEADER CENTERED */
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerSide: {
        width: 92,
        height: 36,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    brandTextBig: {
        fontSize: 26,
        fontWeight: '900',
        color: THEME.ink,
        letterSpacing: 0.5,
    },
    brandSubtitle: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '800',
        color: THEME.muted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    logoutChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.18)',
    },
    logoutChipText: { color: THEME.danger, fontWeight: '900' },

    profileCard: {
        backgroundColor: THEME.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.line,
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
    avatarText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.6 },

    /* USER INFO EMPHASIS */
    userName: {
        color: THEME.ink,
        fontSize: 19,
        fontWeight: '900',
    },
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
    userHint: {
        marginTop: 6,
        color: THEME.muted,
        fontSize: 12,
        fontWeight: '700',
    },

    /* QUICK ACTIONS */
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

    /* LIST MENU */
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
    menuRowHint: { marginTop: 4, color: THEME.muted, fontSize: 12, fontWeight: '700' },

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
    menuRowChevron: { color: THEME.muted, fontSize: 18, fontWeight: '900', marginTop: -2 },

    menuRowAccent: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
    },

    /* MODAL */
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
    modalSubtitle: { marginTop: 10, fontSize: 13, color: THEME.muted, textAlign: 'center' },
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
