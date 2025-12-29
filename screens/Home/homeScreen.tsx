/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useState } from 'react';
import {
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    View,
    StatusBar,
} from 'react-native';
import Modal from 'react-native-modal';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/authContext';

type MenuItem = {
    title: string;
    route: string;
    roles?: Array<'SALES' | 'MANAGER'>;
    icon?: string;
};

const menus: MenuItem[] = [
    { title: 'Calon Customer', route: 'CalonCustomer', roles: ['SALES', 'MANAGER'], icon: '🧾' },
    { title: 'Visit Plan', route: 'VisitPlan', roles: ['SALES', 'MANAGER'], icon: '🗓️' },
    { title: 'Visit', route: 'Visit', roles: ['SALES', 'MANAGER'], icon: '📍' },
    { title: 'Rekap Visit', route: 'RekapVisit', roles: ['SALES', 'MANAGER'], icon: '📊' },
    { title: 'Rekap Visit Plan', route: 'RekapVisitPlan', roles: ['SALES', 'MANAGER'], icon: '🧮' },
    { title: 'Rekap Calon Customer', route: 'RekapCalonCustomer', roles: ['SALES', 'MANAGER'], icon: '👥' },
    ];

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
        return menus.filter(m => !m.roles || m.roles.includes(user?.jabatan as any));
    }, [user?.jabatan]);

    const initials = useMemo(() => {
        const name = (user?.nama || '').trim();
        if (!name) return 'U';
        const parts = name.split(/\s+/).slice(0, 2);
        return parts.map(p => p[0]?.toUpperCase()).join('') || 'U';
    }, [user?.nama]);

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.scroll}>

            {/* HEADER GLASS / PROFILE */}
            <View style={styles.headerCard}>
            <Text style={styles.appTitle}>PlanToday</Text>

            <View style={{ marginTop: 14, width: '100%' }}>
                {/* Profile row */}
                <View style={styles.profileRow}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>Selamat Datang</Text>
                    <Text style={styles.userName}>{user?.nama}</Text>
                    <Text style={styles.userMeta}>
                    {user?.jabatan} • {user?.cabang}
                    </Text>
                </View>
                </View>

                {/* Actions in profile card */}
                <View style={styles.profileActions}>
                <TouchableOpacity
                    style={styles.profileBtn}
                    onPress={() => handleNavigate('GantiPassword')}
                    activeOpacity={0.85}
                >
                    <Text style={styles.profileBtnIcon}>🔐</Text>
                    <Text style={styles.profileBtnText}>{"\t"}Ganti {"\n"}Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.profileBtn, styles.profileBtnDanger]}
                    onPress={toggleModal}
                    activeOpacity={0.85}
                >
                    <Text style={styles.profileBtnIcon}>🚪</Text>
                    <Text style={styles.profileBtnText}>Keluar</Text>
                </TouchableOpacity>
                </View>
            </View>
            </View>

            {/* MENU LIST */}
            <View style={{ marginTop: 14 }}>
            {availableMenus.map((item, index) => (
                <TouchableOpacity
                key={`${item.route}-${index}`}
                style={styles.menuCard}
                onPress={() => handleNavigate(item.route)}
                activeOpacity={0.85}
                >
                <Text style={styles.menuIcon}>{item.icon || '▫️'}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuHint}>Tap untuk buka</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
            ))}
            </View>

        </ScrollView>

        {/* MODAL LOGOUT (GLASS) */}
        <Modal
            isVisible={isModalVisible}
            onBackdropPress={toggleModal}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
        >
            <View style={styles.glassModal}>
            <View style={styles.modalIndicator} />

            <Text style={styles.modalTitle}>Konfirmasi</Text>

            <Text style={styles.modalSubtitle}>Yakin ingin keluar?</Text>
            <Text style={styles.modalUserName}>{user?.nama}</Text>

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
                activeOpacity={0.85}
                >
                <Text style={styles.textLogout}>Keluar</Text>
                </TouchableOpacity>
            </View>
            </View>
        </Modal>
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 26,
    },

    // Header glass
    headerCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        padding: 18,
        alignItems: 'center',
    },
    appTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 0.4,
    },

    // Profile
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '900',
        letterSpacing: 0.6,
    },

    greeting: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    userName: {
        textTransform: 'uppercase',
        marginTop: 6,
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
    },
    userMeta: {
        textTransform: 'uppercase',
        marginTop: 6,
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
    },

    profileActions: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 12,
    },
    profileBtn: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    profileBtnDanger: {
        backgroundColor: 'rgba(231, 76, 60, 0.22)', 
        borderColor: 'rgba(255,255,255,0.22)',
    },
    profileBtnIcon: {
        fontSize: 16,
    },
    profileBtnText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },

    // Menu cards
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.22)',
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    menuIcon: {
        fontSize: 18,
        width: 28,
        textAlign: 'center',
    },
    menuTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    menuHint: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    chevron: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 26,
        marginLeft: 6,
        marginTop: -2,
    },

    // Modal styles
    glassModal: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 22,
        padding: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    modalIndicator: {
        width: 44,
        height: 4,
        backgroundColor: '#DDD',
        borderRadius: 2,
        marginBottom: 18,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E224F',
    },
    modalSubtitle: {
        marginTop: 10,
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
    },
    modalUserName: {
        marginTop: 6,
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        textTransform: 'uppercase',
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 18,
    },
    btnCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#EEF0F6',
        alignItems: 'center',
    },
    btnLogoutConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#E74C3C',
        alignItems: 'center',
    },
    textCancel: { color: '#6B7280', fontWeight: '800' },
    textLogout: { color: '#FFF', fontWeight: '900' },
});
