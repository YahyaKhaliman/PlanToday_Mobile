/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, ScrollView } from 'react-native';
import api from '../../services/api';

type Detail = {
    id: number;
    cus_kode: string;
    cus_nama: string;
    note: string;
};

export default function RekapVisitPlanDetailScreen({ navigation, route }: any) {
    const id = route?.params?.id;
    const canEdit = route?.params?.canEdit ?? true;

    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<Detail | null>(null);
    const [note, setNote] = useState('');

    const loadDetail = async () => {
        if (!id) {
        Alert.alert('Error', 'ID tidak valid');
        return;
        }

        setLoading(true);
        try {
        const res = await api.get(`/rekap-visit-plan/${id}`);
        const d = res.data?.data;
        setDetail(d || null);
        setNote(d?.note || '');
        } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Gagal mengambil detail');
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const simpan = async () => {
        if (!id) return;

        setLoading(true);
        try {
        const res = await api.put(`/rekap-visit-plan/${id}/note`, { note });
        Alert.alert('Sukses', res.data?.message || 'Berhasil disimpan', [
            {
            text: 'OK',
            onPress: () => navigation.goBack(),
            },
        ]);
        } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Gagal menyimpan note');
        } finally {
        setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Detail Visit Plan
        </Text>

        {!detail ? (
            <Text style={{ color: '#666' }}>{loading ? 'Memuat...' : 'Data tidak ada'}</Text>
        ) : (
            <View>
            <Text>Customer</Text>
            <TextInput
                value={detail.cus_nama || ''}
                editable={false}
                style={{
                borderWidth: 1,
                marginBottom: 10,
                padding: 10,
                backgroundColor: '#eee',
                borderRadius: 8,
                }}
            />

            <Text>Keperluan</Text>
            <TextInput
                value={note}
                onChangeText={setNote}
                editable={canEdit}
                multiline
                numberOfLines={5}
                style={{
                borderWidth: 1,
                marginBottom: 20,
                padding: 10,
                borderRadius: 8,
                backgroundColor: canEdit ? '#fff' : '#eee',
                textAlignVertical: 'top',
                }}
            />

            {canEdit ? (
                <Button title={loading ? 'Menyimpan...' : 'Simpan'} onPress={simpan} disabled={loading} />
            ) : (
                <Text style={{ color: '#666', marginBottom: 10 }}>
                Note tidak bisa diedit untuk role ini.
                </Text>
            )}
            </View>
        )}

        <View style={{ marginTop: 10 }}>
            <Button title="Kembali" color="gray" onPress={() => navigation.goBack()} />
        </View>
        </ScrollView>
    );
}
