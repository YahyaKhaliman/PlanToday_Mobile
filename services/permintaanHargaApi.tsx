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
  mh_harga?: number;
  harga?: number;
  harga_kalkulasi: number;
  status: string;
  ket_kalkulasi: string;
  user_create: string;
};

export type KalkulasiKomponenItem = {
  kk_komponen: string;
  kk_jeniskain: string;
  kk_warna: string;
  kk_harga: number;
  kk_babaran: number;
  kk_pcs: number;
  kk_kg?: string;
  kk_pabrik?: string;
  kk_nourut?: number;
};

export type KalkulasiAksesoriesItem = {
  ka_aksesories: string;
  ka_biaya: number;
  ka_nourut?: number;
};

export type KalkulasiDetailData = {
  hdr?: {
    kal_nomor: string;
    kal_mh_nomor: string;
    kal_project?: string;
    kal_tanggal?: string;
    kal_cus?: string;
    kal_kh_kode?: string;
    kal_order?: number;
    kal_rencanaorder?: number;
    kal_rpallowance?: number;
    kal_allowance?: number;
    kal_rplaba?: number;
    kal_laba?: number;
    kal_persen?: string;
    kal_pakaiobat?: string;
    kal_ppn?: number;
    kal_rpsesuai?: number;
    kal_rpsesuaippn?: number;
    kal_rpsales?: number;
    kal_rpsistem?: number;
    kal_rpsales_inc_ppn?: number;
    kal_rpsistem_inc_ppn?: number;
    kal_ket?: string;
    kal_ketbeli?: string;
    user_create?: string;
    date_create?: string;
  };
  dtl?: {
    kald_rpbody?: number;
    kald_rplengan?: number;
    kald_rprib?: number;
    kald_rpkrah?: number;
    kald_rpmanset?: number;
    kald_rppotong?: number;
    kald_rpjahit?: number;
    kald_rpraglan?: number;
    kald_rpfinishing?: number;
    kald_rptenagacetak?: number;
    kald_rpbiayaobat?: number;
    kald_rpkirim?: number;
    kald_jahit?: string;
    kald_body?: string;
    kald_lengan?: string;
    kald_rib?: string;
    kald_krah?: string;
    kald_manset?: string;
    kald_babaranbody?: number;
    kald_babaranlengan?: number;
  } | null;
  komponen?: KalkulasiKomponenItem[];
  aksesories?: KalkulasiAksesoriesItem[];
  cetak?: { kald_rpcetak?: number } | null;
  sublim?: { kald_rpsublim?: number; kald_cmsublim?: number } | null;
  dtf?: { kald_rpdtf?: number; kald_cmdtf?: number } | null;
  bordir?: { kald_rpbordir?: number; kald_cmbordir?: number } | null;
  polyflex?: { kald_rppolyflex?: number; kald_cmpolyflex?: number } | null;
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
  mh_ongkir?: number;
  kald_rpkirim?: number;
  mh_budget: number;
  mh_kain: string;
  mh_panjang: number;
  mh_lebar: number;
  mh_ukuran: string;
  mh_gramasi: string;
  mh_finishing: string;
  mh_sublim?: string;
  mh_warna?: string;
  mh_workshop?: string;
  mh_pro_nomor?: string;
  mh_ket: string;
  mh_status: string;
  mh_harga_kalkulasi: number;
  mh_ket_kalkulasi: string;
  mh_nomor_kalkulasi?: string;
  mh_date_kalkulasi?: string;
  kal_rpsales?: number;
  kal_rpsistem?: number;
  kal_rpsales_inc_ppn?: number;
  kal_rpsistem_inc_ppn?: number;
  kal_ppn?: number;
  kal_rpsesuai?: number;
  kal_rpsesuaippn?: number;
  mh_apv_usr?: string;
  user_kalkulasi?: string;
  sales_nama?: string;
  divisi_nama?: string;
  user_create?: string;
  mh_dateorder?: string;
  created_at_fmt?: string;
  gambar_1_url?: string;
  gambar_2_url?: string;
  kalkulasi_detail?: KalkulasiDetailData | null;
};

export type PermintaanHargaPayload = {
  mh_tanggal?: string;
  mh_pro_nomor?: string;
  mh_divisi: string;
  mh_cus_kode: string;
  mh_cus_nama: string;
  mh_sal_kode: string;
  mh_nama: string;
  mh_jmlorder: number;
  mh_harga: number;
  mh_ongkir?: number;
  kald_rpkirim?: number;
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
  mh_workshop?: string;
  garmen_workshop?: string;
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
  NEGO: number;
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
    NEGO: 0,
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

export interface SpandukFinishingItem {
  id: number;
  nama: string;
  tipe_hitung: string;
  tarif: number;
  satuan?: string;
  biayaPerPcs?: number;
  totalBiaya?: number;
}

export interface SpandukCalculatePayload {
  metode: string;
  lebar: number;
  jenisKain: string;
  panjang: number;
  qty: number;
  finishingIds?: number[];
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
  selongsongVertical?: boolean;
  selongsongHorizontal?: boolean;
}

export const getKalkulasiMasterOptions = async (token?: string | null) => {
  const response = await api.get('/permintaan-harga/kalkulasi/options', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data;
};

export interface OngkirCalculatePayload {
  alokasi: string;
  divisi: string;
  panjang?: number;
  lebar?: number;
  qty: number;
  sublim?: string;
  customNominal?: number;
}

export const getOngkirOptionsApi = async (token?: string | null) => {
  const response = await api.get('/permintaan-harga/kalkulasi/ongkir/options', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data?.data;
};

export const calculateOngkirApi = async (
  payload: OngkirCalculatePayload,
  token?: string | null,
) => {
  const response = await api.post(
    '/permintaan-harga/kalkulasi/ongkir/calculate',
    payload,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
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

export const getTambahanOptionsApi = async (
  token?: string | null,
  params?: { jenisKain?: string; kategori?: string; kodeModel?: string },
) => {
  const response = await api.get('/lookups/tambahan', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params,
  });
  return response.data?.data || [];
};

export const getCetakOptionsApi = async (
  token?: string | null,
  params?: { jenisKain?: string; kategori?: string },
) => {
  const response = await api.get('/lookups/cetak', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params,
  });
  return response.data?.data || [];
};

export interface CustomerSoHistoryItem {
  so_nomor: string;
  so_tanggal: string;
  so_tanggal_fmt: string;
  so_nama: string;
  so_nama2?: string;
  so_jumlah: number;
  so_harga: number | string;
  so_ukuran?: string;
  so_kain?: string;
  so_finishing?: string;
  so_panjang?: number;
  so_lebar?: number;
  so_gramasi?: string;
  so_keterangan?: string;
  so_divisi?: number;
  divisi_nama?: string;
}

export const getCustomerSoHistoryApi = async (
  cusKode: string,
  paramsOrToken?:
    | { divisi?: string; q?: string; page?: number; limit?: number }
    | string
    | null,
  token?: string | null,
): Promise<{ data: CustomerSoHistoryItem[]; pagination?: any }> => {
  if (!cusKode) return { data: [] };

  let params: { divisi?: string; q?: string; page?: number; limit?: number } = {
    divisi: 'SEMUA',
    q: '',
    page: 1,
    limit: 20,
  };
  let effectiveToken: string | null | undefined = token;

  if (typeof paramsOrToken === 'string' || paramsOrToken === null) {
    effectiveToken = paramsOrToken;
  } else if (paramsOrToken && typeof paramsOrToken === 'object') {
    params = { ...params, ...paramsOrToken };
  }

  const response = await api.get(
    `/penjualan/minta-harga-form/katalog/customer/${encodeURIComponent(cusKode)}`,
    {
      params,
      headers: effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : undefined,
    },
  );

  const rawData = response.data?.data;
  return {
    data: Array.isArray(rawData) ? rawData : [],
    pagination: response.data?.pagination,
  };
};

export interface PraOrderItem {
  nomor: string;
  namaPekerjaan: string;
  cusNama: string;
  cusKode: string;
  salKode?: string;
  salesNama?: string;
  tanggal: string;
  status: string;
  statusPpic: string;
  qtyRencana: number;
  divisi: string;
  divisiNama?: string;
  finishing?: string;
  sudahDipakaiOleh?: string | null;
}

export interface PraOrderDetail {
  nomor: string;
  cusKode: string;
  cusNama: string;
  salKode: string;
  salNama: string;
  namaPekerjaan: string;
  divisi: string;
  divisiNama: string;
  finishing: string;
  spesifikasi: string;
  sampel: string;
  rencanaOrder: number;
  kain: string;
  ukuran: string;
  keterangan: string;
  catatanDeadline: string;
  imageUrl: string | null;
  sudahDipakaiOleh: string | null;
}

export const getPraOrderListApi = async (
  keyword: string = '',
  token?: string | null,
): Promise<PraOrderItem[]> => {
  const response = await api.get('/permintaan-harga/pra-order', {
    params: { q: keyword, limit: 30 },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const raw = response.data?.data;
  return Array.isArray(raw) ? raw : [];
};

export const getPraOrderDetailApi = async (
  nomor: string,
  token?: string | null,
): Promise<PraOrderDetail | null> => {
  const response = await api.get(
    `/permintaan-harga/pra-order/${encodeURIComponent(nomor)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  return response.data?.data || null;
};


