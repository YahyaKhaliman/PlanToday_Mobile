import api from './api';

export type PenawaranListParams = {
  startDate?: string;
  endDate?: string;
  status?: 'ALL' | 'OPEN' | 'BATAL' | 'CLOSE';
  search?: string;
  limit?: number;
};

export type PenawaranListItem = {
  nomor: string;
  tanggal: string;
  divisi: string;
  tipe: string;
  perusahaan: string;
  customer: string;
  sales: string;
  keterangan: string;
  fu1: string;
  fu2: string;
  fu3: string;
  proyeksi: string;
  nominal: number;
  detail_count: number;
  approval_state: '' | 'WAIT' | 'ACC' | 'TOLAK' | string;
};

export type PenawaranHeader = {
  nomor: string;
  tanggal: string;
  divisi: string;
  divisi_nama: string;
  tipe: string;
  perusahaan_kode: string;
  perusahaan: string;
  customer_kode: string;
  customer: string;
  customer_alamat: string;
  customer_kota: string;
  sales_kode: string;
  sales: string;
  keterangan: string;
  note: string;
  rekening: string;
  dp_per: number;
  ttd: string;
  ttd_jabatan: string;
  up: string;
  marketing: string;
  marketing_telp: string;
  status_harga: number;
  cetak_total: number;
  panjang: number;
  lebar: number;
  tambahan: string;
  fu1: string;
  fu2: string;
  fu3: string;
  proyeksi: string;
  mx: string;
  digital_sign: string;
  nominal: number;
  approval_state: '' | 'WAIT' | 'ACC' | 'TOLAK' | string;
};

export type PenawaranDetailItem = {
  id: string;
  urutan: number;
  minta: string;
  nama_barang: string;
  bahan: string;
  ukuran: string;
  panjang: number;
  lebar: number;
  satuan: string;
  qty: number;
  harga: number;
  total: number;
  status: string;
  ket_batal: string;
  ket_confirm: string;
  gambar: string;
};

export type PenawaranMasterOption = {
  kode: string;
  nama: string;
  alamat?: string;
};

export type PenawaranCreatePayload = {
  tanggal: string;
  divisi: string;
  tipe: string;
  perusahaan_kode: string;
  customer_kode: string;
  sales_kode: string;
  keterangan?: string;
  note?: string;
  user?: string;
  details: Array<{
    minta?: string;
    nama_barang: string;
    bahan?: string;
    ukuran?: string;
    panjang?: number;
    lebar?: number;
    satuan?: string;
    qty: number;
    harga: number;
  }>;
};

export type PenawaranStatusUpdate = {
  id: string;
  status: 'OPEN' | 'BATAL' | 'CLOSE' | '';
  ket_batal?: string;
  ket_confirm?: string;
};

export type PenawaranStatusUpdatePayload = {
  updates: PenawaranStatusUpdate[];
  user?: string;
};

export type ApprovalRequestPayload = {
  alasan: string;
  user?: string;
};

export type PenawaranActivityLog = {
  type: 'APPROVAL' | 'STATUS_UPDATE' | string;
  created_at: string;
  user: string;
  keterangan: string;
  approval_state?: '' | 'WAIT' | 'ACC' | 'TOLAK' | string;
  changes?: Array<{
    id: string;
    before: {
      status: string;
      ket_batal: string;
      ket_confirm: string;
    };
    after: {
      status: string;
      ket_batal: string;
      ket_confirm: string;
    };
  }>;
};

export const getPenawaranList = async (params: PenawaranListParams = {}) => {
  const response = await api.get('/penawaran', { params });
  return (response.data?.data || []) as PenawaranListItem[];
};

export const getPenawaranDetail = async (nomor: string) => {
  const response = await api.get(`/penawaran/${encodeURIComponent(nomor)}`);
  return response.data?.data as {
    header: PenawaranHeader;
    details: PenawaranDetailItem[];
  };
};

export const createPenawaran = async (payload: PenawaranCreatePayload) => {
  const response = await api.post('/penawaran', payload);
  return response.data?.data as { nomor: string };
};

export const getMasterPerusahaan = async (search?: string) => {
  const response = await api.get('/penawaran/master/perusahaan', {
    params: { search: search || '' },
  });
  return (response.data?.data || []) as PenawaranMasterOption[];
};

export const getMasterSales = async (search?: string) => {
  const response = await api.get('/penawaran/master/sales', {
    params: { search: search || '' },
  });
  return (response.data?.data || []) as PenawaranMasterOption[];
};

export const updatePenawaranStatusDetail = async (
  nomor: string,
  payload: PenawaranStatusUpdatePayload,
) => {
  const response = await api.put(
    `/penawaran/${encodeURIComponent(nomor)}/status`,
    payload,
  );
  return response.data as { success: boolean; message: string };
};

export const getMasterPenawaranBatal = async () => {
  const response = await api.get('/penawaran/master/batal');
  return (response.data?.data || []) as PenawaranMasterOption[];
};

export const getMasterPenawaranConfirm = async () => {
  const response = await api.get('/penawaran/master/confirm');
  return (response.data?.data || []) as PenawaranMasterOption[];
};

export const requestApprovalPerubahan = async (
  nomor: string,
  payload: ApprovalRequestPayload,
) => {
  const response = await api.post(
    `/penawaran/${encodeURIComponent(nomor)}/pengajuan-perubahan`,
    payload,
  );
  return response.data as { success: boolean; message: string; approval_state: string };
};

export const getPenawaranActivityLogs = async (nomor: string) => {
  const response = await api.get(
    `/penawaran/${encodeURIComponent(nomor)}/activity-logs`,
  );
  return (response.data?.data || []) as PenawaranActivityLog[];
};
