import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/authContext';

import LoginScreen from '../screens/Login/loginScreen';
import HomeScreen from '../screens/Home/homeScreen';
import RegisterScreen from '../screens/Register/registerScreen';
import RekapCalonCustomerScreen from '../screens/Home/calonCustomerScreen';
import TambahCalonCustomerScreen from '../screens/Home/tambahCalonCustomerScreen';
import EditCalonCustomerScreen from '../screens/Home/editCalonCustomerScreen';
import VisitPlanScreen from '../screens/Home/visitPlanScreen';
import CariCustomerScreen from '../screens/Home/cariCustomer';
import VisitScreen from '../screens/Home/visitScreen';
import TambahVisitScreen from '../screens/Home/tambahVisitScreen';
import TambahVisitPlanScreen from '../screens/Home/tambahVisitPlanScreen';
import RekapVisitPlanDetailScreen from '../screens/Home/rekapVisitPlanDetailScreen';
import GantiPasswordScreen from '../screens/Home/gantiPasswordScreen';
import EditVisitPlanScreen from '../screens/Home/editVisitPlanScreen';
import EditVisitScreen from '../screens/Home/editVisitScreen';
import AchievementScreen from '../screens/Achievement/achievementScreen';
import AchievementDetailUserRangeScreen from '../screens/Achievement/achievementDetailUserScreen';
import KurirMenuScreen from '../screens/Kurir/menuScreen';
import KurirRencanaKirimScreen from '../screens/Kurir/rencanaKirimScreen';
import KurirKirimScreen from '../screens/Kurir/kirimScreen';
import KurirJadwalKirimScreen from '../screens/Kurir/jadwalKirimScreen';
import KurirTambahPengirimanScreen from '../screens/Kurir/tambahPengirimanScreen';
import KurirProsesPengirimanScreen from '../screens/Kurir/prosesPengirimanScreen';
import PenawaranListScreen from '../screens/Penawaran/penawaranListScreen';
import PenawaranDetailScreen from '../screens/Penawaran/penawaranDetailScreen';
import PenawaranCreateScreen from '../screens/Penawaran/penawaranCreateScreen';
import PenawaranStatusScreen from '../screens/Penawaran/penawaranStatusScreen';
import CariPerusahaanScreen from '../screens/Penawaran/cariPerusahaanScreen';
import CariSalesScreen from '../screens/Penawaran/cariSalesScreen';
import CariNomorPenawaranScreen from '../screens/Penawaran/cariNomorPenawaranScreen';
import TrackingPenawaranScreen from '../screens/Penawaran/trackingPenawaranScreen';
import TrackingMapScreen from '../screens/Penawaran/trackingMapScreen';
import TrackingSpkScreen from '../screens/Penawaran/trackingSpkScreen';
import PermintaanHargaListScreen from '../screens/PermintaanHarga/permintaanHargaListScreen';
import PermintaanHargaDetailScreen from '../screens/PermintaanHarga/permintaanHargaDetailScreen';
import PermintaanHargaFormScreen from '../screens/PermintaanHarga/permintaanHargaFormScreen';
import TambahCustomerScreen from '../screens/PermintaanHarga/tambahCustomerScreen';
import PotensiScreen from '../screens/Potensi/potensiScreen';
import LaporanPotensiScreen from '../screens/Potensi/laporanPotensiScreen';

export type RootStackParamList = {
  Home: undefined;
  CalonCustomer: undefined;
  EditCalonCustomer: undefined;
  VisitPlan: undefined;
  CariCustomer: any;
  Visit: undefined;
  TambahVisit: undefined;
  EditVisit: undefined;
  TambahVisitPlan: undefined;
  EditVisitPlan: undefined;
  RekapVisitPlanDetail: any;
  RekapCalonCustomer: undefined;
  GantiPassword: undefined;
  Achievement: undefined;
  AchievementOmset: undefined;
  AchievementDetailUserRange: {
    kode: string;
    nama: string;
    jabatan: string;
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
    target?: number;
    realisasi?: number;
    ach?: number;
  };
  KurirMenu: undefined;
  KurirRencanaKirim: undefined;
  KurirKirim: undefined;
  KurirJadwalKirim: undefined;
  KurirTambahPengiriman: undefined;
  KurirProsesPengiriman: undefined;
  PenawaranList: undefined;
  PenawaranDetail: { nomor: string };
  PenawaranCreate: undefined;
  PenawaranStatus: { nomor: string };
  CariPerusahaanPenawaran: { from: string };
  CariSalesPenawaran: { from: string };
  CariNomorPenawaran: { from: string };
  TrackingPenawaran: { month?: number; year?: number } | undefined;
  TrackingMap: undefined;
  TrackingSPK: { month?: number; year?: number } | undefined;
  Potensi: { month?: number; year?: number } | undefined;
  LaporanPotensi: { month?: number; year?: number } | undefined;
  PermintaanHargaList: { month?: number; year?: number } | undefined;
  PermintaanHargaDetail: { nomor: string };
  PermintaanHargaForm: {
    mode: 'create' | 'edit';
    nomor?: string;
    initialData?: any;
    selectedCustomer?: {
      kode: string;
      nama: string;
    };
  };
  TambahCustomerPermintaanHarga: undefined;
  Login: undefined;
  Register: undefined;
};

export type PenawaranStackParamList = Pick<
  RootStackParamList,
  | 'PenawaranList'
  | 'PenawaranDetail'
  | 'PenawaranCreate'
  | 'PenawaranStatus'
  | 'CariPerusahaanPenawaran'
  | 'CariSalesPenawaran'
  | 'CariNomorPenawaran'
>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user } = useAuth();
  const jabatan = String(user?.jabatan || '').toUpperCase();
  const canAccessPenawaran = jabatan === 'MANAGER' || jabatan === 'SALES';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="CalonCustomer"
              component={TambahCalonCustomerScreen}
            />
            <Stack.Screen
              name="EditCalonCustomer"
              component={EditCalonCustomerScreen}
            />
            <Stack.Screen name="VisitPlan" component={VisitPlanScreen} />
            <Stack.Screen name="CariCustomer" component={CariCustomerScreen} />
            <Stack.Screen name="Visit" component={VisitScreen} />
            <Stack.Screen name="TambahVisit" component={TambahVisitScreen} />
            <Stack.Screen name="EditVisit" component={EditVisitScreen} />
            <Stack.Screen
              name="TambahVisitPlan"
              component={TambahVisitPlanScreen}
            />
            <Stack.Screen
              name="EditVisitPlan"
              component={EditVisitPlanScreen}
            />
            <Stack.Screen
              name="RekapVisitPlanDetail"
              component={RekapVisitPlanDetailScreen}
            />
            <Stack.Screen
              name="RekapCalonCustomer"
              component={RekapCalonCustomerScreen}
            />
            <Stack.Screen
              name="GantiPassword"
              component={GantiPasswordScreen}
            />
            <Stack.Screen name="Achievement" component={AchievementScreen} />
            <Stack.Screen
              name="AchievementDetailUserRange"
              component={AchievementDetailUserRangeScreen}
            />
            <Stack.Screen name="KurirMenu" component={KurirMenuScreen} />
            <Stack.Screen
              name="KurirRencanaKirim"
              component={KurirRencanaKirimScreen}
            />
            <Stack.Screen name="KurirKirim" component={KurirKirimScreen} />
            <Stack.Screen
              name="KurirJadwalKirim"
              component={KurirJadwalKirimScreen}
            />
            <Stack.Screen
              name="KurirTambahPengiriman"
              component={KurirTambahPengirimanScreen}
            />
            <Stack.Screen
              name="KurirProsesPengiriman"
              component={KurirProsesPengirimanScreen}
            />
            {canAccessPenawaran && (
              <>
                <Stack.Screen
                  name="PenawaranList"
                  component={PenawaranListScreen}
                />
                <Stack.Screen
                  name="PenawaranDetail"
                  component={PenawaranDetailScreen}
                />
                <Stack.Screen
                  name="PenawaranCreate"
                  component={PenawaranCreateScreen}
                />
                <Stack.Screen
                  name="PenawaranStatus"
                  component={PenawaranStatusScreen}
                />
                <Stack.Screen
                  name="CariPerusahaanPenawaran"
                  component={CariPerusahaanScreen}
                />
                <Stack.Screen
                  name="CariSalesPenawaran"
                  component={CariSalesScreen}
                />
                <Stack.Screen
                  name="CariNomorPenawaran"
                  component={CariNomorPenawaranScreen}
                />
                <Stack.Screen
                  name="TrackingPenawaran"
                  component={TrackingPenawaranScreen}
                />
                <Stack.Screen
                  name="TrackingMap"
                  component={TrackingMapScreen}
                />
                <Stack.Screen
                  name="TrackingSPK"
                  component={TrackingSpkScreen}
                />
                <Stack.Screen
                  name="Potensi"
                  component={PotensiScreen}
                />
                <Stack.Screen
                  name="LaporanPotensi"
                  component={LaporanPotensiScreen}
                />
                <Stack.Screen
                  name="PermintaanHargaList"
                  component={PermintaanHargaListScreen}
                />
                <Stack.Screen
                  name="PermintaanHargaDetail"
                  component={PermintaanHargaDetailScreen}
                />
                <Stack.Screen
                  name="PermintaanHargaForm"
                  component={PermintaanHargaFormScreen}
                />
                <Stack.Screen
                  name="TambahCustomerPermintaanHarga"
                  component={TambahCustomerScreen}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
