/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Option = { label: string; value: string };

type Props = {
    visible: boolean;
    title?: string;
    value?: string;
    years: number[];
    onClose: () => void;
    onSelect: (value: string) => void;
    theme?: {
        ink: string;
        muted: string;
        soft: string;
        line: string;
        accent: string;
    };
};

export default function YearGridSelect({
    visible,
    title = 'Pilih Tahun',
    value,
    years,
    onClose,
    onSelect,
    theme,
    }: Props) {
    const T = useMemo(
        () => ({
        ink: theme?.ink ?? '#0F172A',
        muted: theme?.muted ?? '#64748B',
        soft: theme?.soft ?? '#F1F5F9',
        line: theme?.line ?? 'rgba(15,23,42,0.08)',
        accent: theme?.accent ?? '#06B6D4',
        }),
        [theme]
    );

    const data: Option[] = useMemo(
        () => years.map((y) => ({ label: String(y), value: String(y) })),
        [years]
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
            <View style={[styles.card, { borderColor: T.line, backgroundColor: 'rgba(255,255,255,0.96)' }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: T.ink }]}>{title}</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color={T.muted} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={data}
                keyExtractor={(it) => it.value}
                numColumns={4}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 8 }}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                const active = String(item.value) === String(value);
                return (
                    <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onSelect(item.value)}
                    style={[
                        styles.yearBtn,
                        {
                        backgroundColor: active ? 'rgba(6,182,212,0.14)' : T.soft,
                        borderColor: active ? 'rgba(6,182,212,0.35)' : T.line,
                        },
                    ]}
                    >
                    <Text style={[styles.yearText, { color: T.ink }]}>{item.label}</Text>
                    </TouchableOpacity>
                );
                }}
            />
            </View>
        </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 16,
        justifyContent: 'flex-end',
        paddingBottom: 18,
    },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: { fontSize: 16, fontWeight: '900' },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: { marginTop: 6, fontSize: 12, fontWeight: '800' },

    yearBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    yearText: {
        fontSize: 13,
        fontWeight: '900',
    },
});
