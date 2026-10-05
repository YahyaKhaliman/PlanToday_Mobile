export interface OngkirMasterItem {
  id: number;
  alokasi: string;
  harga_kg: number;
  min_kg: number;
  free_spanduk_m: number;
  free_mmt_m2: number;
  free_garmen_pcs: number;
  spanduk_m_per_kg: number;
  mmt_m2_per_kg: number;
  garmen_med_pcs_per_kg: number;
  garmen_prem_pcs_per_kg: number;
  coverage_desc?: string;
  alias_keywords?: string[];
}

export interface OngkirCalcResult {
  alokasi: string;
  isCustom: boolean;
  totalBeratKg: number;
  beratDihitungKg: number;
  minKg: number;
  tarifPerKg: number;
  isFreeCharge: boolean;
  freeThreshold: number;
  totalOngkir: number;
  ongkirPerPcs: number;
  ringkasan: string;
  detectedFrom?: string;
}

export const FALLBACK_ONGKIR_OPTIONS: OngkirMasterItem[] = [
  {
    id: 1,
    alokasi: 'Jakarta',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'DKI Jakarta, Bogor, Depok, Tangerang, Bekasi (Jabodetabek)',
    alias_keywords: [
      'jakarta',
      'dki',
      'jaksel',
      'jakbar',
      'jaktim',
      'jakut',
      'jakpus',
      'bogor',
      'depok',
      'tangerang',
      'tangsel',
      'bekasi',
      'cikarang',
      'jabodetabek',
    ],
  },
  {
    id: 2,
    alokasi: 'Bandung',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Kota & Kab. Bandung, Cimahi, Bandung Barat',
    alias_keywords: ['bandung', 'cimahi', 'soreang', 'padalarang', 'lembang'],
  },
  {
    id: 3,
    alokasi: 'Yogya',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'DIY Yogyakarta, Sleman, Bantul, Kulon Progo, Gunungkidul',
    alias_keywords: [
      'yogya',
      'yogyakarta',
      'jogja',
      'sleman',
      'bantul',
      'kulon progo',
      'gunungkidul',
      'wates',
      'wonosari',
    ],
  },
  {
    id: 4,
    alokasi: 'Sidoarjo',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Kabupaten Sidoarjo & sekitarnya',
    alias_keywords: ['sidoarjo', 'waru', 'krian', 'porong'],
  },
  {
    id: 5,
    alokasi: 'Surabaya',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Kota Surabaya & sekitarnya',
    alias_keywords: ['surabaya', 'sby', 'rungkut', 'gubeng', 'wonokromo'],
  },
  {
    id: 6,
    alokasi: 'Surakarta',
    harga_kg: 2000,
    min_kg: 20,
    free_spanduk_m: 1000,
    free_mmt_m2: 500,
    free_garmen_pcs: 300,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Solo Raya (Solo, Sukoharjo, Karanganyar, Klaten, Boyolali, Sragen, Wonogiri)',
    alias_keywords: [
      'surakarta',
      'solo',
      'sukoharjo',
      'karanganyar',
      'klaten',
      'boyolali',
      'sragen',
      'wonogiri',
      'kartasura',
      'palur',
    ],
  },
  {
    id: 7,
    alokasi: 'Jawa Lainnya',
    harga_kg: 5000,
    min_kg: 20,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Semarang, Malang, Cirebon, Tegal, Purwokerto, Jember, Banyuwangi, dll.',
    alias_keywords: [
      'jawa',
      'semarang',
      'malang',
      'cirebon',
      'serang',
      'banten',
      'tasikmalaya',
      'sukabumi',
      'purwokerto',
      'banyumas',
      'tegal',
      'pekalongan',
      'kudus',
      'pati',
      'jepara',
      'magelang',
      'salatiga',
      'kediri',
      'madiun',
      'jember',
      'banyuwangi',
      'pasuruan',
      'probolinggo',
      'mojokerto',
      'blitar',
      'tulungagung',
      'nganjuk',
      'ngawi',
      'bojonegoro',
      'tuban',
      'lamongan',
      'gresik',
      'jombang',
      'lumajang',
      'situbondo',
      'bondowoso',
      'cilacap',
      'kebumen',
      'purworejo',
      'wonosobo',
      'temanggung',
      'kendal',
      'demak',
      'grobogan',
      'purwodadi',
      'blora',
      'rembang',
      'brebes',
      'pemalang',
      'batang',
      'kuningan',
      'majalengka',
      'sumedang',
      'garut',
      'ciamis',
      'pangandaran',
      'banjar',
      'purwakarta',
      'subang',
      'karawang',
      'pandeglang',
      'lebak',
      'cilegon',
      'madura',
      'bangkalan',
      'sampang',
      'pamekasan',
      'sumenep',
    ],
  },
  {
    id: 8,
    alokasi: 'Sumatra',
    harga_kg: 10000,
    min_kg: 40,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Jambi, Medan, Palembang, Padang, Pekanbaru, Batam, Lampung, Aceh, Bengkulu, Babel',
    alias_keywords: [
      'sumatra',
      'sumatera',
      'jambi',
      'medan',
      'palembang',
      'padang',
      'pekanbaru',
      'riau',
      'batam',
      'tanjung pinang',
      'kepri',
      'lampung',
      'bandar lampung',
      'aceh',
      'banda aceh',
      'bengkulu',
      'pangkal pinang',
      'bangka',
      'belitung',
      'babel',
      'bukittinggi',
      'dumai',
      'binjai',
      'pematang siantar',
      'lubuklinggau',
      'prabumulih',
      'lahat',
      'baturaja',
      'muaro jambi',
      'bungo',
      'tebo',
      'sarolangun',
      'merangin',
      'kerinci',
      'sungai penuh',
      'tanjab',
      'tanjung jabung',
      'asahan',
      'deli serdang',
      'karo',
      'labuhanbatu',
      'langkat',
      'mandailing',
      'nias',
      'simalungun',
      'tapanuli',
      'toba',
      'agam',
      'dharmasraya',
      'mentawai',
      'lima puluh kota',
      'padang pariaman',
      'pasaman',
      'pesisir selatan',
      'sijunjung',
      'solok',
      'tanah datar',
      'bengkalis',
      'indragiri',
      'kampar',
      'kuantan singingi',
      'pelalawan',
      'rokan',
      'siak',
      'banyuasin',
      'empat lawang',
      'muara enim',
      'musi banyuasin',
      'musi rawas',
      'ogan ilir',
      'ogan komering',
      'penukal abab',
      'mesuji',
      'pesawaran',
      'pringsewu',
      'tanggamus',
      'tulang bawang',
      'way kanan',
      'metro',
    ],
  },
  {
    id: 9,
    alokasi: 'Sulawesi',
    harga_kg: 10000,
    min_kg: 40,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Makassar, Manado, Palu, Kendari, Gorontalo, Mamuju & seluruh Sulawesi',
    alias_keywords: [
      'sulawesi',
      'makassar',
      'manado',
      'palu',
      'kendari',
      'gorontalo',
      'mamuju',
      'sulsel',
      'sulut',
      'sulteng',
      'sultra',
      'sulbar',
      'parepare',
      'palopo',
      'bitung',
      'tomohon',
      'kotamobagu',
      'baubau',
      'gowa',
      'maros',
      'bone',
      'bulukumba',
      'bantaeng',
      'pinrang',
      'sidrap',
      'wajo',
      'soppeng',
      'luwu',
      'toraja',
      'kolaka',
      'konawe',
      'muna',
      'buton',
      'wakatobi',
      'poso',
      'donggala',
      'tolitoli',
      'banggai',
      'morowali',
      'parigi',
      'minahasa',
      'bolmong',
      'sangihe',
      'talaud',
    ],
  },
  {
    id: 10,
    alokasi: 'Kalimantan',
    harga_kg: 15000,
    min_kg: 40,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Banjarmasin, Samarinda, Balikpapan, Pontianak, Palangkaraya, Tarakan',
    alias_keywords: [
      'kalimantan',
      'borneo',
      'banjarmasin',
      'banjarbaru',
      'samarinda',
      'balikpapan',
      'pontianak',
      'palangkaraya',
      'tarakan',
      'tanjung selor',
      'kalsel',
      'kaltim',
      'kalbar',
      'kalteng',
      'kaltara',
      'bontang',
      'singkawang',
      'sambas',
      'ketapang',
      'sintang',
      'kapuas',
      'kotawaringin',
      'sampit',
      'pangkalan bun',
      'katingan',
      'barito',
      'murung raya',
      'tanah laut',
      'kotabaru',
      'banjar',
      'tapin',
      'hulu sungai',
      'tabalong',
      'tanah bumbu',
      'penajam',
      'pasel',
      'kukar',
      'kutai',
      'berau',
      'nunukan',
      'bulungan',
      'malinau',
      'ikn',
      'nusantara',
    ],
  },
  {
    id: 11,
    alokasi: 'Bali',
    harga_kg: 8000,
    min_kg: 40,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Denpasar, Badung, Gianyar, Tabanan, Buleleng, Klungkung, dll.',
    alias_keywords: [
      'bali',
      'denpasar',
      'badung',
      'kuta',
      'seminyak',
      'canggu',
      'jimbaran',
      'nusa dua',
      'gianyar',
      'ubud',
      'tabanan',
      'buleleng',
      'singaraja',
      'klungkung',
      'nusa penida',
      'bangli',
      'karangasem',
      'jembrana',
      'negara',
    ],
  },
  {
    id: 12,
    alokasi: 'Nusa Tenggara',
    harga_kg: 10000,
    min_kg: 40,
    free_spanduk_m: 0,
    free_mmt_m2: 0,
    free_garmen_pcs: 0,
    spanduk_m_per_kg: 10,
    mmt_m2_per_kg: 2,
    garmen_med_pcs_per_kg: 5,
    garmen_prem_pcs_per_kg: 3,
    coverage_desc: 'Mataram, Lombok, Sumbawa, Bima (NTB), Kupang, Labuan Bajo, Flores (NTT)',
    alias_keywords: [
      'nusa tenggara',
      'ntb',
      'ntt',
      'mataram',
      'lombok',
      'sumbawa',
      'bima',
      'dompu',
      'kupang',
      'labuan bajo',
      'flores',
      'manggari',
      'ende',
      'sikka',
      'maumere',
      'ngada',
      'sumba',
      'waingapu',
      'alor',
      'lembata',
      'rote',
      'sabu',
      'timor',
      'belu',
      'atambua',
      'ttus',
      'tts',
    ],
  },
];

/**
 * Mencari alokasi ongkir berdasarkan teks pencarian daerah (misal "Jambi" -> "Sumatra", "Semarang" -> "Jawa Lainnya")
 */
export const detectAlokasiFromText = (
  text: string,
  options: OngkirMasterItem[] = FALLBACK_ONGKIR_OPTIONS,
): OngkirMasterItem | null => {
  const q = String(text || '').toLowerCase().trim();
  if (!q || q.length < 2) return null;

  const masterList = options.length > 0 ? options : FALLBACK_ONGKIR_OPTIONS;

  // 1. Cek Exact Match Nama Alokasi
  const exact = masterList.find(o => o.alokasi.toLowerCase() === q);
  if (exact) return exact;

  // 2. Cek apakah ada keyword alias yang sama persis
  const exactKw = masterList.find(o =>
    (o.alias_keywords || []).some(kw => kw.toLowerCase() === q),
  );
  if (exactKw) return exactKw;

  // 3. Cek apakah query mengandung kata kunci alias lengkap (misal "kirim ke malang" mengandung "malang")
  for (const item of masterList) {
    const keywords = item.alias_keywords || [];
    if (
      keywords.some(
        kw => kw.length >= 3 && q.includes(kw.toLowerCase()),
      )
    ) {
      return item;
    }
  }

  // 4. Cek apakah kata kunci alias diawali/mengandung query jika query >= 3 karakter (misal user mengetik "mala" -> match "malang" -> Jawa Lainnya)
  if (q.length >= 3) {
    for (const item of masterList) {
      const keywords = item.alias_keywords || [];
      if (
        keywords.some(
          kw =>
            kw.toLowerCase().startsWith(q) ||
            kw.toLowerCase().includes(q),
        )
      ) {
        return item;
      }
    }
  }

  // 5. Cek apakah nama alokasi terkandung dalam query
  const partial = masterList.find(o =>
    q.includes(o.alokasi.toLowerCase()),
  );
  if (partial) return partial;

  return null;
};

export const hitungOngkirOtomatis = ({
  options = [],
  alokasi = 'Jakarta',
  divisi = '1',
  panjang = 0,
  lebar = 0,
  qty = 0,
  sublim = '',
  customNominal = 0,
  isCustom = false,
}: {
  options?: OngkirMasterItem[];
  alokasi?: string;
  divisi?: string;
  panjang?: number;
  lebar?: number;
  qty?: number;
  sublim?: string;
  customNominal?: number;
  isCustom?: boolean;
}): OngkirCalcResult => {
  const numPanjang = Number(panjang) || 0;
  const numLebar = Number(lebar) || 0;
  const numQty = Number(qty) || 0;
  const normDivisi = String(divisi || '1').trim();

  // Mode Tanpa Ongkir (Default / Rp 0)
  if (
    !alokasi ||
    String(alokasi).toLowerCase() === 'tanpa ongkir' ||
    String(alokasi).toLowerCase() === 'none' ||
    String(alokasi).trim() === ''
  ) {
    return {
      alokasi: 'Tanpa Ongkir',
      isCustom: false,
      totalBeratKg: 0,
      beratDihitungKg: 0,
      minKg: 0,
      tarifPerKg: 0,
      isFreeCharge: true,
      freeThreshold: 0,
      totalOngkir: 0,
      ongkirPerPcs: 0,
      ringkasan: 'Tanpa Ongkir (Rp 0)',
    };
  }

  // Mode Custom / Manual jika memang ada
  if (
    isCustom ||
    String(alokasi).toLowerCase() === 'custom' ||
    String(alokasi).toLowerCase() === 'manual'
  ) {
    const totalOngkir = Number(customNominal) || 0;
    const ongkirPerPcs =
      numQty > 0 ? Math.round(totalOngkir / numQty) : totalOngkir;
    return {
      alokasi: 'Custom',
      isCustom: true,
      totalBeratKg: 0,
      beratDihitungKg: 0,
      minKg: 0,
      tarifPerKg: 0,
      isFreeCharge: totalOngkir === 0,
      freeThreshold: 0,
      totalOngkir,
      ongkirPerPcs,
      ringkasan:
        totalOngkir > 0
          ? `Manual: Rp ${totalOngkir.toLocaleString('id-ID')}`
          : 'Rp 0',
    };
  }

  const masterList = options.length > 0 ? options : FALLBACK_ONGKIR_OPTIONS;
  
  // Deteksi otomatis jika user menginputkan nama daerah / kota bebas
  let matched = masterList.find(
    o => o.alokasi.toLowerCase() === String(alokasi).toLowerCase(),
  );

  if (!matched) {
    matched = detectAlokasiFromText(String(alokasi), masterList) || masterList[0];
  }

  if (!matched) {
    const totalOngkir = Number(customNominal) || 0;
    return {
      alokasi: alokasi || 'Custom',
      isCustom: true,
      totalBeratKg: 0,
      beratDihitungKg: 0,
      minKg: 0,
      tarifPerKg: 0,
      isFreeCharge: false,
      freeThreshold: 0,
      totalOngkir,
      ongkirPerPcs:
        numQty > 0 ? Math.round(totalOngkir / numQty) : totalOngkir,
      ringkasan: 'Ongkir Manual',
    };
  }

  let totalBeratKg = 0;
  let isFreeCharge = false;
  let freeThreshold = 0;

  if (normDivisi === '1') {
    // Spanduk: 10 meter = 1 kg
    const totalMeter = Math.round(numPanjang * numQty * 100) / 100;
    const rasio = Number(matched.spanduk_m_per_kg) || 10;
    totalBeratKg = rasio > 0 ? totalMeter / rasio : 0;
    freeThreshold = Number(matched.free_spanduk_m) || 0;
    if (freeThreshold > 0 && totalMeter >= freeThreshold) {
      isFreeCharge = true;
    }
  } else if (normDivisi === '5') {
    // MMT: 2 m2 = 1 kg (0.5 kg / m2)
    const luasPerPcs = Math.round(numPanjang * numLebar * 100) / 100;
    const totalLuas = Math.round(luasPerPcs * numQty * 100) / 100;
    const rasio = Number(matched.mmt_m2_per_kg) || 2;
    totalBeratKg = rasio > 0 ? totalLuas / rasio : 0;
    freeThreshold = Number(matched.free_mmt_m2) || 0;
    if (freeThreshold > 0 && totalLuas >= freeThreshold) {
      isFreeCharge = true;
    }
  } else if (normDivisi === '4') {
    // Garmen: 5 pcs/kg (Medium) atau 3 pcs/kg (Premium)
    const isPremium = String(sublim || '').toUpperCase() === 'PREMIUM';
    const rasio = isPremium
      ? Number(matched.garmen_prem_pcs_per_kg) || 3
      : Number(matched.garmen_med_pcs_per_kg) || 5;
    totalBeratKg = rasio > 0 ? numQty / rasio : 0;
    freeThreshold = Number(matched.free_garmen_pcs) || 0;
    if (freeThreshold > 0 && numQty >= freeThreshold) {
      isFreeCharge = true;
    }
  } else {
    totalBeratKg = numQty;
  }

  totalBeratKg = Math.round(totalBeratKg * 100) / 100;

  const minKg = Number(matched.min_kg) || 20;
  const tarifPerKg = Number(matched.harga_kg) || 0;

  let totalOngkir = 0;
  let beratDihitungKg = totalBeratKg;

  if (isFreeCharge) {
    totalOngkir = 0;
    beratDihitungKg = totalBeratKg;
  } else {
    beratDihitungKg = Math.max(totalBeratKg, minKg);
    totalOngkir = Math.round(beratDihitungKg * tarifPerKg);
  }

  const ongkirPerPcs =
    numQty > 0 ? Math.round(totalOngkir / numQty) : totalOngkir;

  let ringkasan = '';
  if (isFreeCharge) {
    ringkasan = 'Gratis Ongkir (Free Charge)';
  } else {
    ringkasan = `Rp ${totalOngkir.toLocaleString(
      'id-ID',
    )} (${beratDihitungKg}kg @ Rp ${tarifPerKg.toLocaleString('id-ID')}/kg)`;
  }

  return {
    alokasi: matched.alokasi,
    isCustom: false,
    totalBeratKg,
    beratDihitungKg,
    minKg,
    tarifPerKg,
    isFreeCharge,
    freeThreshold,
    totalOngkir,
    ongkirPerPcs,
    ringkasan,
  };
};
