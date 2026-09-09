import api from './api';
import { PUBLIC_IMAGE_READ_ORIGIN } from './api';
import RNBlobUtil from 'react-native-blob-util';

export type PermintaanHargaListParams = {
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type PermintaanHargaItem = {
  nomor: string;
  tanggal: string;
  created_at_fmt: string;
  nama: string;
  customer: string;
  divisi: string;
  jml_order: number;
  harga_kalkulasi: number;
  status: string;
  ket_kalkulasi: string;
  user_create: string;
};

export type PermintaanHargaDetail = {
  mh_nomor: string;
  mh_tanggal: string;
  mh_divisi: string;
  mh_cus_kode: string;
  mh_cus_nama: string;
  mh_sal_kode: string;
  mh_nama: string;
  mh_jmlorder: number;
  mh_harga: number;
  mh_budget: number;
  mh_kain: string;
  mh_panjang: number;
  mh_lebar: number;
  mh_ukuran: string;
  mh_gramasi: string;
  mh_finishing: string;
  mh_sublim?: string;
  mh_warna?: string;
  mh_ket: string;
  mh_status: string;
  mh_harga_kalkulasi: number;
  mh_ket_kalkulasi: string;
  mh_dateorder?: string;
  created_at_fmt?: string;
  gambar_1_url?: string;
  gambar_2_url?: string;
};

export type PermintaanHargaPayload = {
  mh_tanggal?: string;
  mh_divisi: string;
  mh_cus_kode: string;
  mh_cus_nama: string;
  mh_sal_kode: string;
  mh_nama: string;
  mh_jmlorder: number;
  mh_harga: number;
  mh_budget: number;
  mh_dateorder?: string;
  mh_kain: string;
  mh_panjang: number;
  mh_lebar: number;
  mh_ukuran: string;
  mh_gramasi: string;
  mh_finishing: string;
  mh_sublim?: string;
  mh_warna?: string;
  mh_ket: string;
  mh_harga_kalkulasi?: number;
  mh_ket_kalkulasi?: string;
  kal_kh_kode?: string;
  kal_rpallowance?: number;
  kal_allowance?: number;
  kal_rplaba?: number;
  kal_laba?: number;
  kal_ketbeli?: string;
  garmen_model?: string;
  garmen_kain?: string;
  garmen_warna?: string;
  garmen_tambahan?: any[];
  garmen_cetak?: any[];
};

export type PermintaanHargaImageUpload = {
  uri: string;
  type?: string;
  name?: string;
  base64?: string;
};

export type PermintaanHargaCreateCustomerPayload = {
  nama: string;
  alamat: string;
  kota: string;
  cus_telp: string;
  cus_cp: string;
  cus_email: string;
  cus_korporasi: 'Y' | 'N';
  cus_jenisusaha?: string;
  cus_npwp?: string;
  cus_nama_npwp?: string;
  cus_alamat_npwp?: string;
  cus_kota_npwp?: string;
};

export const getPermintaanHargaList = async (
  params: PermintaanHargaListParams = {},
  token?: string | null,
) => {
  const response = await api.get('/permintaan-harga', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return (response.data?.data || []) as PermintaanHargaItem[];
};

export const getPermintaanHargaDetail = async (
  nomor: string,
  token?: string | null,
) => {
  const response = await api.get(
    `/permintaan-harga/${encodeURIComponent(nomor)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  const payload = (response.data?.data || {}) as any;
  const readOrigin = String(PUBLIC_IMAGE_READ_ORIGIN || '').replace(/\/$/, '');
  const rewriteToReadOrigin = (value: any) => {
    if (typeof value !== 'string') return value;
    return value.replace(/^http:\/\/103\.94\.238\.252:8080/i, readOrigin);
  };

  console.log('[permintaanHargaApi.detail] image url mapping', {
    nomor,
    readOrigin,
    raw1: payload?.gambar_1_url,
    raw2: payload?.gambar_2_url,
  });

  return {
    ...payload,
    gambar_1_url: rewriteToReadOrigin(payload?.gambar_1_url),
    gambar_2_url: rewriteToReadOrigin(payload?.gambar_2_url),
    gambar_1_legacy_url: rewriteToReadOrigin(payload?.gambar_1_legacy_url),
    gambar_2_legacy_url: rewriteToReadOrigin(payload?.gambar_2_legacy_url),
    image1: rewriteToReadOrigin(payload?.image1),
    image2: rewriteToReadOrigin(payload?.image2),
  } as PermintaanHargaDetail;
};

export const createPermintaanHarga = async (
  payload: PermintaanHargaPayload,
  token?: string | null,
) => {
  const response = await api.post('/permintaan-harga', payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data as { nomor: string };
};

export const updatePermintaanHarga = async (
  nomor: string,
  payload: PermintaanHargaPayload,
  token?: string | null,
) => {
  const response = await api.put(
    `/permintaan-harga/${encodeURIComponent(nomor)}`,
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data?.data as { nomor: string };
};

export const deletePermintaanHarga = async (
  nomor: string,
  token?: string | null,
) => {
  const response = await api.delete(
    `/permintaan-harga/${encodeURIComponent(nomor)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data as { success?: boolean; message?: string };
};

export const createPermintaanHargaCustomer = async (
  payload: PermintaanHargaCreateCustomerPayload,
  token?: string | null,
) => {
  const response = await api.post('/permintaan-harga/customer', payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data as { kode: string; nama: string };
};

export const uploadPermintaanHargaImage = async (
  nomor: string,
  slot: 1 | 2,
  file: PermintaanHargaImageUpload,
  token?: string | null,
) => {
  const rawUri = String(file.uri || '').trim();
  const normalizedType = file.type || 'image/jpeg';
  const cleanedNomor = String(nomor || '').trim();
  const fallbackName =
    String(file.name || '').trim() ||
    `${cleanedNomor}${slot === 2 ? '-2' : ''}.${
      normalizedType.includes('png') ? 'png' : 'jpg'
    }`;
  const normalizedName = fallbackName;

  // Resolusi path untuk RNBlobUtil.fs.readFile:
  // - content:// URI: diteruskan apa adanya (RNBlobUtil pakai ContentResolver Android)
  // - file:// URI   : strip scheme 'file://' agar jadi path absolut biasa
  const readPath = rawUri.startsWith('file://')
    ? rawUri.slice('file://'.length)
    : rawUri;

  console.log('[permintaanHargaApi.upload] prepare', {
    nomor,
    slot,
    hasToken: Boolean(token),
    rawUri,
    readPath,
    type: normalizedType,
    name: normalizedName,
  });

  try {
    let base64DataUrl = '';

    // Prioritas 1: gunakan base64 yang sudah disediakan FE (jika ada)
    const providedBase64 = String(file.base64 || '').trim();
    if (providedBase64) {
      base64DataUrl = `data:${normalizedType};base64,${providedBase64}`;
      console.log('[permintaanHargaApi.upload] using provided base64');
    } else {
      // Prioritas 2: baca file via RNBlobUtil — reliable untuk content:// dan file:// di APK
      console.log('[permintaanHargaApi.upload] reading via RNBlobUtil', {
        readPath,
      });
      const base64String = await RNBlobUtil.fs.readFile(readPath, 'base64');
      if (!base64String) {
        throw new Error('File tidak dapat dibaca (konten kosong)');
      }
      base64DataUrl = `data:${normalizedType};base64,${base64String}`;
    }

    const response = await api.post(
      `/permintaan-harga/${encodeURIComponent(nomor)}/gambar-base64/${slot}`,
      {
        file_base64: base64DataUrl,
        file_name: normalizedName,
        file_type: normalizedType,
      },
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        skipDedupe: true,
      } as any,
    );

    const parsed = response.data || null;

    if (parsed?.success === false) {
      const error: any = new Error(parsed?.message || 'Upload base64 gagal');
      error.status = response.status;
      error.response = { status: response.status, data: parsed };
      throw error;
    }

    console.log('[permintaanHargaApi.upload] success', {
      nomor,
      slot,
      status: response.status,
      data: parsed?.data,
      mode: providedBase64 ? 'provided-base64' : 'rnblob-base64',
    });
    return parsed?.data;
  } catch (err: any) {
    console.log('[permintaanHargaApi.upload] error', {
      nomor,
      slot,
      message: err?.message,
      code: err?.code,
      status: err?.status || err?.response?.status,
      responseData: err?.response?.data,
      requestMethod: 'POST',
    });
    throw err;
  }
};

export const deletePermintaanHargaImage = async (
  nomor: string,
  slot: number,
  token?: string | null,
) => {
  try {
    const response = await api.delete(
      `/permintaan-harga/${encodeURIComponent(nomor)}/gambar/${slot}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    return response.data;
  } catch (err: any) {
    console.error('[permintaanHargaApi.deleteImage] error', {
      nomor,
      slot,
      message: err?.message,
    });
    throw err;
  }
};

export type PermintaanHargaStatusCounts = {
  BELUM: number;
  MINTA: number;
  WAIT: number;
  DONE: number;
  CANCEL: number;
};

export const getPermintaanHargaStatusCounts = async (
  params?: { startDate?: string; endDate?: string } | null,
  token?: string | null,
) => {
  const response = await api.get('/permintaan-harga/status-counts', {
    params: params || undefined,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return (response.data?.data ?? {
    BELUM: 0,
    MINTA: 0,
    WAIT: 0,
    DONE: 0,
    CANCEL: 0,
  }) as PermintaanHargaStatusCounts;
};

// --- KALKULASI HARGA API SERVICES ---

export const getJenisKainLookup = async (
  kodeModel: string = 'KH-0001',
  token?: string | null,
) => {
  const response = await api.get('/permintaan-harga/kalkulasi/kain', {
    params: { kodeModel },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};

export const getCetakLookup = async (token?: string | null) => {
  const response = await api.get('/permintaan-harga/kalkulasi/cetak', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};

export const getTambahanLookup = async (token?: string | null) => {
  const response = await api.get('/permintaan-harga/kalkulasi/tambahan', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};

export const getKalkulasiMetadata = async (
  params: {
    model: string;
    jenisKain: string;
    warna: string;
    qty: number;
  },
  token?: string | null,
) => {
  const response = await api.get('/permintaan-harga/kalkulasi/metadata', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data;
};

export const saveKalkulasiData = async (
  payload: {
    nomorMh: string;
    kal: any;
    namaPekerjaan?: string;
    custKode?: string;
    rencanaOrder?: number;
  },
  token?: string | null,
) => {
  const response = await api.post('/permintaan-harga/kalkulasi/save', payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data;
};

// --- KALKULASI ENGINE API (SPANDUK & MMT) ---

export interface SpandukCalculatePayload {
  metode: string;
  lebar: number;
  jenisKain: string;
  panjang: number;
  qty: number;
}

export interface MmtCalculatePayload {
  kategori: string;
  bahanKode: string;
  panjang: number;
  lebar: number;
  qty: number;
  toppingKode?: string;
  toppingQty?: number;
  isNetto?: boolean;
}

export const getKalkulasiMasterOptions = async (token?: string | null) => {
  const response = await api.get('/permintaan-harga/kalkulasi/options', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data;
};

export const calculateSpandukApi = async (
  payload: SpandukCalculatePayload,
  token?: string | null,
) => {
  const response = await api.post(
    '/permintaan-harga/kalkulasi/spanduk/calculate',
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data?.data;
};

export const calculateMmtApi = async (
  payload: MmtCalculatePayload,
  token?: string | null,
) => {
  const response = await api.post(
    '/permintaan-harga/kalkulasi/mmt/calculate',
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data?.data;
};

export interface GarmenTambahanPayloadItem {
  ket: string;
  tarif?: number;
}

export interface GarmenCetakPayloadItem {
  jenis: string;
  ket: string;
  biaya: number;
  customQty?: number;
}

export interface GarmenCalculatePayload {
  kodeModel: 'KH-0001' | 'KH-0002';
  jenisKain: string;
  warna: string;
  qty: number;
  tambahanList?: (string | GarmenTambahanPayloadItem)[];
  cetakList?: GarmenCetakPayloadItem[];
  customAllowance?: number;
  customBiayaJahit?: number;
}

export const calculateGarmenApi = async (
  payload: GarmenCalculatePayload,
  token?: string | null,
) => {
  const response = await api.post(
    '/permintaan-harga/kalkulasi/garmen/calculate',
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data?.data;
};


export const getJenisKainMintaHargaApi = async (
  kodeModel: string = 'KH-0001',
  token?: string | null,
) => {
  const response = await api.get('/lookups/jenis-kain-minta-harga', {
    params: { kode: kodeModel },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};

export const getTambahanOptionsApi = async (token?: string | null) => {
  const response = await api.get('/lookups/tambahan', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};

export const getCetakOptionsApi = async (token?: string | null) => {
  const response = await api.get('/lookups/cetak', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data || [];
};
