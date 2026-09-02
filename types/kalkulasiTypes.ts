export interface KomponenKainItem {
  Komponen: string;
  Kg: boolean;
  Pabrik: boolean;
  JenisKain: string;
  Lengan: string;
  Warna: string;
  Harga: number;
  Babaran: number;
  Kebutuhan?: number;
  Bruto?: number;
  Pcs?: number;
}

export interface GridCetakItem {
  Keterangan: string;
  Harga: number;
}

export interface GridAksesorisItem {
  Keterangan: string;
  Harga: number;
}

export interface Dimension8Slots {
  Cm: number;
  P1?: number;
  L1?: number;
  P2?: number;
  L2?: number;
  P3?: number;
  L3?: number;
  P4?: number;
  L4?: number;
  P5?: number;
  L5?: number;
  P6?: number;
  L6?: number;
  P7?: number;
  L7?: number;
  P8?: number;
  L8?: number;
  [key: string]: number | undefined;
}

export interface KalkulasiState {
  NomorKalkulasi: string;
  TanggalKalkulasi: string;
  Model: string; // 'KH-0001' (1 Warna) | 'KH-0002' (2 Warna)
  JenisKain: string;
  Warna: 'MUDA' | 'SEDANG' | 'TUA';
  KategoriKain: string; // 'LACOST' | 'COTTON' | 'PE' | ...
  RencanaOrder: number;

  // Biaya Operasional Satuan
  RpPotong: number;
  RpJahit: number;
  RpFinishing: number;
  RpKirim: number;
  RpObat: number;

  // Grids
  GridKomponen: KomponenKainItem[];
  GridCetak: GridCetakItem[];
  GridAksesoris: GridAksesorisItem[];

  // Custom Services
  Bordir: Dimension8Slots;
  Dtf: Dimension8Slots;
  RpBordirTotal: number;
  RpDtfTotal: number;
  RpCetakTotal: number;

  // Financial Parameters
  PersenAllowance: number;
  RpAllowance: number;
  PersenLaba: number;
  RpLaba: number;
  HargaSesuai: number; // Exclude PPN
  PersenPpn: number; // default: 11
  HargaSesuaiPpn: number; // Include PPN
  UpdateOtomatis: boolean;
}

export interface JenisKainLookupItem {
  Jeniskain: string;
  Kategori: string;
}

export interface CetakLookupItem {
  mhb_jenis: string;
  mhb_ket: string;
  mhb_biaya: number;
}

export interface TambahanLookupItem {
  mht_ket: string;
  mht_lacost: number;
  mht_cotton: number;
  mht_pe: number;
}

export interface KalkulasiMetadataResponse {
  rpPotong: number;
  rpJahit: number;
  komponen: Array<{
    komponen: string;
    lengan: string;
    babaran: number;
    harga: number;
    allowance: number;
  }>;
  margin: {
    laba: number;
    persen: 'Y' | 'N';
  };
  allowancePersen: number;
  jenisKainValid: boolean;
}
