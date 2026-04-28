// eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import RNFS from 'react-native-fs';
import {
  getPenawaranActivityLogs,
  getPenawaranDetail,
  PenawaranActivityLog,
  PenawaranDetailItem,
  PenawaranHeader,
} from '../../services/penawaranApi';
import PenawaranApprovalModal from './penawaranApprovalModal';
import {
  PENAWARAN_SHADOW,
  PENAWARAN_STATUS_COLORS,
  PENAWARAN_THEME,
} from './penawaranTheme';

const THEME = PENAWARAN_THEME;

const formatCurrency = (value: number) => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `Rp ${Number(value || 0)}`;
  }
};

const formatNumber = (value: number) => {
  try {
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return String(Number(value || 0));
  }
};

const normalizeApprovalState = (value?: string) =>
  String(value || '')
    .trim()
    .toUpperCase();

const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDateTimeDDMMYYYY = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

const escapeHtml = (value?: string | number) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const toSafeFileName = (value: string) =>
  String(value || 'penawaran')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'penawaran';

const normalizePdfPath = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/^file:\/\//, '');

const resolveImageMimeType = (value?: string) => {
  const cleaned = String(value || '')
    .split('?')[0]
    .toLowerCase();
  if (cleaned.endsWith('.png')) return 'image/png';
  if (cleaned.endsWith('.webp')) return 'image/webp';
  if (cleaned.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

const normalizeAssetPath = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/^file:\/\//i, '')
    .replace(/^bundle-assets:\/\//i, '')
    .replace(/^asset:\/+/i, '')
    .replace(/^\/+/, '');

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(() => resolve(undefined), ms);
  });

type PdfTemplateKey =
  | 'KENCANA_PRINT'
  | 'JAYA_ABADI_MULIA'
  | 'MADANI_PRODUCTION';

const ensureLegacyAndroidWritePermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) >= 29) return true;

  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  if (granted) return true;

  const requestResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Izin Penyimpanan',
      message: 'Izin penyimpanan dibutuhkan untuk menyimpan PDF ke Download.',
      buttonPositive: 'Izinkan',
      buttonNegative: 'Batal',
    },
  );

  return requestResult === PermissionsAndroid.RESULTS.GRANTED;
};

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>
      {value === '' || value === null || value === undefined
        ? '-'
        : String(value)}
    </Text>
  </View>
);

export default function PenawaranDetailScreen({ navigation, route }: any) {
  const nomor = String(route?.params?.nomor || '');
  const insets = useSafeAreaInsets();
  const pdfHeaderAssetUri = useMemo(
    () => ({
      KENCANA_PRINT:
        Image.resolveAssetSource(require('../../utils/kp.jpg'))?.uri || '',
      JAYA_ABADI_MULIA:
        Image.resolveAssetSource(require('../../utils/jaya.jpg'))?.uri || '',
      MADANI_PRODUCTION:
        Image.resolveAssetSource(require('../../utils/madani.jpg'))?.uri || '',
    }),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<PenawaranHeader | null>(null);
  const [details, setDetails] = useState<PenawaranDetailItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<PenawaranActivityLog[]>([]);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!nomor) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: 'Nomor penawaran tidak ditemukan',
      });
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      const fetchDetailWithRetry = async () => {
        let lastError: any;

        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            return await getPenawaranDetail(nomor);
          } catch (error: any) {
            lastError = error;
            const status = error?.response?.status;
            const message = String(error?.response?.data?.message || '')
              .trim()
              .toLowerCase();
            const shouldRetry =
              status === 404 &&
              message.includes('tidak ditemukan') &&
              attempt < 3;

            if (!shouldRetry) {
              throw error;
            }

            await sleep(500);
          }
        }

        throw lastError;
      };

      const [detailResult, logsResult] = await Promise.allSettled([
        fetchDetailWithRetry(),
        getPenawaranActivityLogs(nomor),
      ]);

      if (detailResult.status === 'rejected') {
        throw detailResult.reason;
      }

      const data = detailResult.value;
      setHeader(data?.header || null);
      setDetails(data?.details || []);

      if (logsResult.status === 'fulfilled') {
        setActivityLogs(
          Array.isArray(logsResult.value) ? logsResult.value : [],
        );
      } else {
        setActivityLogs([]);
      }
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2:
          err?.response?.data?.message || 'Gagal mengambil detail penawaran',
      });
      setHeader(null);
      setDetails([]);
      setActivityLogs([]);
    } finally {
      setLoading(false);
    }
  }, [navigation, nomor]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail]),
  );

  const displayNomor = useMemo(
    () => header?.nomor || nomor || '-',
    [header?.nomor, nomor],
  );

  const nomorPermintaan = useMemo(() => {
    if (!header) return '';

    const source = header as PenawaranHeader & {
      no_permintaan?: string;
      nomor_permintaan?: string;
      permintaan_no?: string;
      minta?: string;
    };

    const candidates = [
      source.no_permintaan,
      source.nomor_permintaan,
      source.permintaan_no,
      source.minta,
    ];

    const found = candidates
      .map(value => String(value || '').trim())
      .find(Boolean);

    return found || '';
  }, [header]);

  const approvalState = normalizeApprovalState(header?.approval_state);
  const isWaitingApproval = approvalState === 'WAIT';

  const resolvePdfTemplateKey = useCallback((companyName?: string) => {
    const normalized = String(companyName || '')
      .trim()
      .toLowerCase();

    if (
      normalized.includes('jaya abadi') ||
      normalized.includes('pt. jaya abadi mulia')
    ) {
      return 'JAYA_ABADI_MULIA' as PdfTemplateKey;
    }

    if (normalized.includes('madani')) {
      return 'MADANI_PRODUCTION' as PdfTemplateKey;
    }

    if (normalized.includes('kencana')) {
      return 'KENCANA_PRINT' as PdfTemplateKey;
    }

    return 'KENCANA_PRINT' as PdfTemplateKey;
  }, []);

  const resolvePdfImageSrc = useCallback(async (assetUri?: string) => {
    const rawUri = String(assetUri || '').trim();
    if (!rawUri) return '';

    if (rawUri.startsWith('data:') || /^https?:\/\//i.test(rawUri)) {
      return rawUri;
    }

    const normalizedPath = normalizePdfPath(rawUri);
    const mimeType = resolveImageMimeType(rawUri);

    try {
      if (normalizedPath && (await RNFS.exists(normalizedPath))) {
        const base64 = await RNFS.readFile(normalizedPath, 'base64');
        if (base64) {
          return `data:${mimeType};base64,${base64}`;
        }
      }
    } catch {
      // fallback to raw uri when local file cannot be converted.
    }

    if (Platform.OS === 'android') {
      const assetPath = normalizeAssetPath(rawUri);
      if (assetPath) {
        try {
          const base64 = await RNFS.readFileAssets(assetPath, 'base64');
          if (base64) {
            return `data:${mimeType};base64,${base64}`;
          }
        } catch {
          // fallback to raw uri when bundled asset cannot be converted.
        }
      }
    }

    return rawUri;
  }, []);

  const buildKencanaPrintPdfHtml = useCallback(
    (headerImageSrc?: string) => {
      if (!header) return '';

      const rows = details
        .map(
          (item, idx) => `
          <tr>
            <td class="num">${idx + 1}.</td>
            <td>${escapeHtml(item.nama_barang || '-')}</td>
            <td>${escapeHtml(item.bahan || '-')}</td>
            <td>${escapeHtml(item.ukuran || '-')}</td>
            <td>${escapeHtml(item.satuan || '-')}</td>
            <td class="num">${escapeHtml(formatNumber(item.qty || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.harga || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.total || 0))}</td>
          </tr>
        `,
        )
        .join('');

      const totalNominal = details.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      const upLabel = String(header.up || '').trim() || header.customer || '-';
      const ttdName = String(header.ttd || '').trim() || 'Marketing';
      const ttdJabatan =
        String(header.ttd_jabatan || '').trim() ||
        'Supervisor Office Marketing';
      const note = String(header.note || header.note || '').trim() || '-';

      return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.28; }
            .wrap { width: 100%; }
            .top { display: table; width: 100%; margin-bottom: 10px; }
            .top-left, .top-right { display: table-cell; vertical-align: top; }
            .top-left { width: 46%; }
            .top-right { width: 54%; padding-left: 10px; }
            .logo-wrap { width: 100%; padding-top: 2px; }
            .logo-img {
              width: 96%;
              max-width: 280px;
              max-height: 92px;
              height: auto;
              object-fit: contain;
              object-position: left top;
              display: block;
            }
            .brand { font-size: 46px; font-weight: 700; color: #D90429; line-height: 1; letter-spacing: 0.5px; }
            .tagline { margin-top: 2px; font-style: italic; font-size: 15px; font-weight: 600; }
            .svc-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
            .svc-list { margin: 0; padding-left: 0; list-style: none; }
            .svc-list li { margin: 2px 0; }
            .svc-list li::before { content: "- "; }

            .company { margin-top: 4px; margin-bottom: 8px; }
            .company-name { font-size: 18px; font-weight: 700; text-decoration: underline; margin-bottom: 2px; }
            .company-line { font-size: 12px; margin-bottom: 1px; }

            .meta-wrap { display: table; width: 100%; margin-top: 6px; margin-bottom: 8px; }
            .meta-left, .meta-right { display: table-cell; vertical-align: top; }
            .meta-left { width: 58%; border: 1px solid #222; padding: 6px; min-height: 86px; }
            .meta-right { width: 42%; padding-left: 14px; }
            .meta-left-line { margin-bottom: 2px; font-size: 12px; }
            .meta-up { margin-top: 34px; font-size: 12px; }
            .meta-table { width: 100%; border-collapse: collapse; }
            .meta-table td { font-size: 12px; padding: 1px 0; vertical-align: top; }
            .meta-table .label { width: 82px; }
            .meta-table .sep { width: 12px; text-align: center; }

            .greet { margin-top: 8px; font-size: 12px; }
            .intro { margin-top: 6px; margin-bottom: 8px; font-size: 12px; text-align: justify; }

            .grid { width: 100%; border-collapse: collapse; margin-top: 4px; }
            .grid th, .grid td { border: 1px solid #333; padding: 4px 5px; font-size: 11px; vertical-align: top; }
            .grid th { font-size: 12px; font-weight: 700; text-align: left; }
            .grid .num { text-align: right; }
            .grid .w-no { width: 28px; }
            .grid .w-nama { width: 220px; }
            .grid .w-bahan { width: 180px; }
            .grid .w-ukuran { width: 110px; }
            .grid .w-satuan { width: 70px; }
            .grid .w-qty { width: 55px; }
            .grid .w-harga { width: 90px; }
            .grid .w-total { width: 100px; }

            .note-tax { margin-top: 18px; font-size: 13px; font-style: italic; }
            .closing { margin-top: 12px; font-size: 12px; text-align: justify; }

            .note-label { margin-top: 12px; font-size: 12px; }
            .note-box { margin-top: 4px; background: #fff200; padding: 6px 8px; min-height: 44px; font-size: 11px; }

            .sign-wrap { display: table; width: 100%; margin-top: 6px; }
            .sign-left, .sign-right { display: table-cell; vertical-align: top; }
            .sign-left { width: 70%; }
            .sign-right { width: 30%; text-align: center; }
            .sign-title { font-size: 12px; margin-bottom: 64px; text-align: left; }
            .sign-name { font-size: 12px; font-weight: 700; border-bottom: 1px solid #111; display: inline-block; padding: 0 8px 2px; }
            .sign-role { font-size: 10px; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="top">
                <div class="top-left">
                  ${
                    headerImageSrc
                      ? `<div class="logo-wrap"><img class="logo-img" src="${escapeHtml(
                          headerImageSrc,
                        )}" alt="Kencana Print" /></div>`
                      : '<div class="brand">Kencana Print</div><div class="tagline">Semakin Nyala Semakin Nyata</div>'
                  }
              </div>
              <div class="top-right">
                <div class="svc-title">OUR SERVICES :</div>
                <ul class="svc-list">
                  <li>GARMENT (T-SHIRT, POLO SHIRT, KEMEJA, WEARPACK, Etc).</li>
                  <li>MANUAL PRINTING (SPANDUK/UMBUL KAIN).</li>
                  <li>DIGITAL PRINTING (X BANNER, ROLL BANNER, FLEXI, ALBATROS, TENDA, STICKER, Etc).</li>
                </ul>
              </div>
            </div>

            <div class="company">
              <div class="company-name">CV. Kencana Print</div>
              <div class="company-line">Padokan RT 04 / 04 Sawahan Ngemplak</div>
              <div class="company-line">Telp  0271-740634  /  Fax  0271-740634</div>
              <div class="company-line">solokencana2@gmail.com</div>
            </div>

            <div class="meta-wrap">
              <div class="meta-left">
                <div class="meta-left-line">Kepada YTH</div>
                <div class="meta-left-line">DARI WEB</div>
                <div class="meta-up">Up.&nbsp;&nbsp;${escapeHtml(upLabel)}</div>
              </div>
              <div class="meta-right">
                <table class="meta-table">
                  <tr><td class="label">Tanggal</td><td class="sep">:</td><td>${escapeHtml(
                    formatDate(header.tanggal),
                  )}</td></tr>
                  <tr><td class="label">Perihal</td><td class="sep">:</td><td>Penawaran Harga</td></tr>
                  <tr><td class="label">No</td><td class="sep">:</td><td>${escapeHtml(
                    header.nomor || nomor,
                  )}</td></tr>
                  <tr><td class="label">note</td><td class="sep">:</td><td>${escapeHtml(
                    header.note || '-',
                  )}</td></tr>
                </table>
              </div>
            </div>

            <div class="greet">Dengan Hormat,</div>
            <div class="intro">
              Bersama dengan surat ini kami perusahaan yang bergerak di garment, manual printing dan
              digital printing mengajukan penawaran harga untuk item-item barang tersebut di bawah ini:
            </div>

            <table class="grid">
              <thead>
                <tr>
                  <th class="w-no">No</th>
                  <th class="w-nama">Nama</th>
                  <th class="w-bahan">Bahan</th>
                  <th class="w-ukuran">Ukuran</th>
                  <th class="w-satuan">Satuan</th>
                  <th class="w-qty num">Qty</th>
                  <th class="w-harga num">Harga</th>
                  <th class="w-total num">Total</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  '<tr><td colspan="8" style="text-align:center;">Tidak ada detail item.</td></tr>'
                }
                <tr>
                  <td colspan="7" style="text-align:right; font-weight:700;">TOTAL</td>
                  <td class="num" style="font-weight:700;">${escapeHtml(
                    formatNumber(totalNominal || header.nominal || 0),
                  )}</td>
                </tr>
              </tbody>
            </table>

            <div class="note-tax">* Note : Harga sudah termasuk PPn 11%</div>

            <div class="closing">
              Demikian penawaran ini kami ajukan, apabila ada informasi yang perlu diketahui mengenai
              penawaran ini lebih lanjut maka Bapak/Ibu dapat menghubungi kami. Atas perhatian dan kerja
              samanya kami ucapkan terima kasih.
            </div>

            <div class="note-label">Note :</div>
            <div class="note-box">${escapeHtml(note)}</div>

            <div class="sign-wrap">
              <div class="sign-left"></div>
              <div class="sign-right">
                <div class="sign-title">Hormat Kami,</div>
                <div class="sign-name">${escapeHtml(ttdName)}</div>
                <div class="sign-role">${escapeHtml(ttdJabatan)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    },
    [details, header, nomor],
  );

  const buildJayaAbadiPdfHtml = useCallback(
    (headerImageSrc?: string) => {
      if (!header) return '';

      const rows = details
        .map(
          (item, idx) => `
          <tr>
            <td>${idx + 1}.</td>
            <td>${escapeHtml(item.nama_barang || '-')}</td>
            <td>${escapeHtml(item.bahan || '-')}</td>
            <td>${escapeHtml(item.ukuran || '-')}</td>
            <td>${escapeHtml(item.satuan || '-')}</td>
            <td class="num">${escapeHtml(formatNumber(item.qty || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.harga || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.total || 0))}</td>
          </tr>
        `,
        )
        .join('');

      const totalNominal = details.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      const dateLine = `Surakarta, ${escapeHtml(formatDate(header.tanggal))}`;
      const upLabel = String(header.up || '').trim() || '-';
      const ttdName = String(header.ttd || '').trim() || '-';
      const ttdJabatan = String(header.ttd_jabatan || '').trim() || '-';
      const note = String(header.note || '').trim() || '-';

      return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111; font-size: 11px; }
            .head { text-align: center; margin-bottom: 8px; }
            .logo-wrap { text-align: center; margin-bottom: 4px; }
            .logo-img { width: 100%; max-width: 360px; max-height: 95px; object-fit: contain; display: inline-block; }
            .brand { font-size: 42px; font-weight: 800; }
            .brand-red { color: #d80f16; }
            .tagline { font-size: 12px; color: #b11f1f; font-style: italic; margin-top: 2px; }
            .date { text-align: right; margin: 12px 0 8px; font-size: 12px; font-weight: 700; }
            .to { margin-top: 2px; font-size: 12px; line-height: 1.5; }
            .meta { margin-top: 10px; }
            .meta-row { font-size: 12px; margin-bottom: 2px; }
            .label { display: inline-block; width: 116px; font-weight: 700; }
            .intro { margin-top: 10px; font-size: 12px; text-align: justify; line-height: 1.45; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #333; padding: 4px; font-size: 11px; vertical-align: top; }
            th { text-align: left; }
            .num { text-align: right; }
            .note-tax { margin-top: 6px; font-style: italic; font-size: 12px; }
            .closing { margin-top: 10px; font-size: 12px; text-align: justify; }
            .note-title { margin-top: 8px; font-size: 12px; }
            .note-box { background: #fff200; min-height: 30px; padding: 6px; font-size: 11px; }
            .sign { margin-top: 10px; width: 100%; display: table; }
            .sign-left, .sign-right { display: table-cell; vertical-align: top; }
            .sign-left { width: 70%; }
            .sign-right { width: 30%; text-align: center; }
            .sign-title { font-size: 12px; margin-bottom: 68px; }
            .sign-name { font-size: 12px; border-bottom: 1px solid #111; display: inline-block; padding: 0 8px 2px; }
            .sign-role { font-size: 11px; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="head">
            ${
              headerImageSrc
                ? `<div class="logo-wrap"><img class="logo-img" src="${escapeHtml(
                    headerImageSrc,
                  )}" alt="PT. Jaya Abadi Mulia" /></div>`
                : '<div class="brand"><span class="brand-red">PT.</span> Jaya Abadi Mulia</div><div class="tagline">Your Best Solutions Partner</div>'
            }
          </div>
          <div class="date">${dateLine}</div>

          <div class="to">
            <div>Kepada Yth.</div>
            <div><b>${escapeHtml(upLabel)}</b></div>
            <div><b>${escapeHtml(header.customer || '-')}</b></div>
            <div>${escapeHtml(header.customer_alamat || '-')}</div>
            <div>${escapeHtml(header.customer_kota || '-')}</div>
          </div>

          <div class="meta">
            <div class="meta-row"><span class="label">Nomor</span>: ${escapeHtml(
              header.nomor || nomor,
            )}</div>
            <div class="meta-row"><span class="label">Perihal</span>: Surat Penawaran Harga</div>
            <div class="meta-row"><span class="label">Keterangan</span>: </div>
          </div>

          <div class="intro">
            Dengan Hormat,<br/>
            Bersama dengan surat ini kami mengajukan penawaran harga untuk item-item barang tersebut di bawah ini.
          </div>

          <table>
            <thead>
              <tr>
                <th>No</th><th>Nama</th><th>Bahan</th><th>Ukuran</th><th>Satuan</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                '<tr><td colspan="8" style="text-align:center;">Tidak ada detail item.</td></tr>'
              }
              <tr>
                <td colspan="7" class="num"><b>Grand Total</b></td>
                <td class="num"><b>${escapeHtml(
                  formatNumber(totalNominal || header.nominal || 0),
                )}</b></td>
              </tr>
            </tbody>
          </table>

          <div class="note-tax">* Note : Harga belum termasuk PPn 11%</div>
          <div class="closing">Demikian surat penawaran ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</div>
          <div class="note-title">Note :</div>
          <div class="note-box">${escapeHtml(note)}</div>

          <div class="sign">
            <div class="sign-left"></div>
            <div class="sign-right">
              <div class="sign-title">Hormat Kami,</div>
              <div class="sign-name">${escapeHtml(ttdName)}</div>
              <div class="sign-role">${escapeHtml(ttdJabatan)}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    },
    [details, header, nomor],
  );

  const buildMadaniPdfHtml = useCallback(
    (headerImageSrc?: string) => {
      if (!header) return '';

      const rows = details
        .map(
          (item, idx) => `
          <tr>
            <td>${idx + 1}.</td>
            <td>${escapeHtml(item.nama_barang || '-')}</td>
            <td>${escapeHtml(item.bahan || '-')}</td>
            <td>${escapeHtml(item.ukuran || '-')}</td>
            <td>${escapeHtml(item.satuan || '-')}</td>
            <td class="num">${escapeHtml(formatNumber(item.qty || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.harga || 0))}</td>
            <td class="num">${escapeHtml(formatNumber(item.total || 0))}</td>
          </tr>
        `,
        )
        .join('');

      const totalNominal = details.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      const upLabel = String(header.up || '').trim() || '-';
      const ttdName = String(header.ttd || '').trim() || '-';
      const ttdJabatan = String(header.ttd_jabatan || '').trim() || '-';
      const note = String(header.note || '').trim() || '-';

      return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111; font-size: 11px; }
            .top { display: table; width: 100%; margin-bottom: 8px; }
            .top-left, .top-right { display: table-cell; vertical-align: top; }
            .top-left { width: 46%; }
            .top-right { width: 54%; padding-left: 10px; }
            .logo { width: 100%; max-width: 320px; max-height: 90px; object-fit: contain; border: 1px solid #999; }
            .brand { font-size: 17px; font-weight: 700; margin-top: 4px; }
            .svc-title { font-size: 12px; font-weight: 700; }
            .svc-list { margin: 4px 0 0; padding-left: 0; list-style: none; }
            .svc-list li { margin: 2px 0; font-size: 11px; }
            .svc-list li::before { content: '- '; }
            .company-line { font-size: 12px; margin-top: 2px; }
            .meta-wrap { display: table; width: 100%; margin-top: 8px; }
            .meta-left, .meta-right { display: table-cell; vertical-align: top; }
            .meta-left { width: 58%; border: 1px solid #333; padding: 6px; }
            .meta-right { width: 42%; padding-left: 12px; }
            .meta-right-row { font-size: 12px; margin-bottom: 3px; }
            .label { display: inline-block; width: 72px; }
            .intro { margin-top: 10px; font-size: 12px; text-align: justify; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #333; padding: 4px; font-size: 11px; }
            th { text-align: left; }
            .num { text-align: right; }
            .note-tax { margin-top: 6px; font-style: italic; font-size: 12px; }
            .closing { margin-top: 10px; font-size: 12px; text-align: justify; }
            .note-title { margin-top: 8px; font-size: 12px; }
            .note-box { background: #fff200; min-height: 30px; padding: 6px; font-size: 11px; }
            .sign { margin-top: 10px; width: 100%; display: table; }
            .sign-left, .sign-right { display: table-cell; vertical-align: top; }
            .sign-left { width: 70%; }
            .sign-right { width: 30%; text-align: center; }
            .sign-title { font-size: 12px; margin-bottom: 68px; }
            .sign-name { font-size: 12px; border-bottom: 1px solid #111; display: inline-block; padding: 0 8px 2px; }
            .sign-role { font-size: 11px; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="top">
            <div class="top-left">
              ${
                headerImageSrc
                  ? `<img class="logo" src="${escapeHtml(
                      headerImageSrc,
                    )}" alt="Company logo" />`
                  : '<div class="brand">PT. Madani Production</div>'
              }
              <div class="brand">PT.Madani Production</div>
              <div class="company-line">${escapeHtml(
                header.perusahaan || '-',
              )}</div>
              <div class="company-line">${escapeHtml(
                header.customer_alamat || '-',
              )}</div>
            </div>
            <div class="top-right">
              <div class="svc-title">OUR SERVICES :</div>
              <ul class="svc-list">
                <li>GARMENT (T-SHIRT, POLO SHIRT, KEMEJA, WEARPACK, Etc).</li>
                <li>MANUAL PRINTING (SPANDUK/UMBUL KAIN).</li>
                <li>DIGITAL PRINTING (X BANNER, ROLL BANNER, FLEXI, ALBATROS, TENDA, STICKER, Etc).</li>
              </ul>
            </div>
          </div>

          <div class="meta-wrap">
            <div class="meta-left">
              <div>Kepada YTH</div>
              <div><b>${escapeHtml(header.customer || '-')}</b></div>
              <div>${escapeHtml(header.customer_alamat || '-')}</div>
              <div>${escapeHtml(header.customer_kota || '-')}</div>
              <div style="margin-top:4px;">Up. <b>${escapeHtml(
                upLabel,
              )}</b></div>
            </div>
            <div class="meta-right">
              <div class="meta-right-row"><span class="label">Tanggal</span>: ${escapeHtml(
                formatDate(header.tanggal),
              )}</div>
              <div class="meta-right-row"><span class="label">Perihal</span>: Penawaran Harga</div>
              <div class="meta-right-row"><span class="label">No</span>: ${escapeHtml(
                header.nomor || nomor,
              )}</div>
              <div class="meta-right-row"><span class="label">Keterangan</span>: </div>
            </div>
          </div>

          <div class="intro">
            Dengan Hormat,<br/>
            Bersama dengan surat ini kami perusahaan yang bergerak di garment, manual printing dan digital printing akan mengajukan penawaran harga untuk item-item barang tersebut di bawah ini.
          </div>

          <table>
            <thead>
              <tr>
                <th>No</th><th>Nama</th><th>Bahan</th><th>Ukuran</th><th>Satuan</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                '<tr><td colspan="8" style="text-align:center;">Tidak ada detail item.</td></tr>'
              }
              <tr>
                <td colspan="7" class="num"><b>Grand Total</b></td>
                <td class="num"><b>${escapeHtml(
                  formatNumber(totalNominal || header.nominal || 0),
                )}</b></td>
              </tr>
            </tbody>
          </table>

          <div class="note-tax">* Note : Harga belum termasuk PPN 11%</div>
          <div class="closing">Demikian penawaran ini kami ajukan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</div>
          <div class="note-title">Note :</div>
          <div class="note-box">${escapeHtml(note)}</div>

          <div class="sign">
            <div class="sign-left"></div>
            <div class="sign-right">
              <div class="sign-title">Hormat Kami,</div>
              <div class="sign-name">${escapeHtml(ttdName)}</div>
              <div class="sign-role">${escapeHtml(ttdJabatan)}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    },
    [details, header, nomor],
  );

  const buildPdfHtml = useCallback(
    (headerImageByTemplate: Record<PdfTemplateKey, string>) => {
      if (!header) return '';

      const templateKey = resolvePdfTemplateKey(header.perusahaan);

      switch (templateKey) {
        case 'KENCANA_PRINT':
          return buildKencanaPrintPdfHtml(
            headerImageByTemplate.KENCANA_PRINT || '',
          );
        case 'JAYA_ABADI_MULIA':
          return buildJayaAbadiPdfHtml(
            headerImageByTemplate.JAYA_ABADI_MULIA || '',
          );
        case 'MADANI_PRODUCTION':
          return buildMadaniPdfHtml(
            headerImageByTemplate.MADANI_PRODUCTION || '',
          );
        default:
          return buildKencanaPrintPdfHtml(
            headerImageByTemplate.KENCANA_PRINT || '',
          );
      }
    },
    [
      buildJayaAbadiPdfHtml,
      buildKencanaPrintPdfHtml,
      buildMadaniPdfHtml,
      header,
      resolvePdfTemplateKey,
    ],
  );

  const handleExportPdf = useCallback(async () => {
    if (!header) return;

    setExportingPdf(true);
    try {
      const { generatePDF } = await import('react-native-html-to-pdf');

      const safeNomor = toSafeFileName(header.nomor || nomor);
      const fileName = `Penawaran_${safeNomor}_${Date.now()}`;
      const [kencanaHeaderSrc, jayaHeaderSrc, madaniHeaderSrc] =
        await Promise.all([
          resolvePdfImageSrc(pdfHeaderAssetUri.KENCANA_PRINT),
          resolvePdfImageSrc(pdfHeaderAssetUri.JAYA_ABADI_MULIA),
          resolvePdfImageSrc(pdfHeaderAssetUri.MADANI_PRODUCTION),
        ]);

      const html = buildPdfHtml({
        KENCANA_PRINT: kencanaHeaderSrc,
        JAYA_ABADI_MULIA: jayaHeaderSrc,
        MADANI_PRODUCTION: madaniHeaderSrc,
      });

      // Android: use logical folder name. iOS: absolute path is supported.
      const directory =
        Platform.OS === 'android'
          ? 'PlanTodayTempPDF'
          : RNFS.TemporaryDirectoryPath;

      console.log('[PDF] Generate start:', { os: Platform.OS, directory });

      const result = await generatePDF({
        html,
        fileName,
        directory,
      });

      console.log('[PDF] Generate result:', result);

      type PdfResultCompat = { filePath?: string | null; file?: string | null };
      const pdfResult = result as PdfResultCompat | null | undefined;
      const rawPath = pdfResult?.filePath ?? pdfResult?.file;
      const filePath = normalizePdfPath(rawPath);

      if (!filePath) {
        throw new Error(
          `File PDF gagal dibuat. Result: ${JSON.stringify(result)}`,
        );
      }

      if (!/\.pdf$/i.test(filePath)) {
        throw new Error(`Path PDF tidak valid: ${filePath}`);
      }

      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`File tidak ditemukan di: ${filePath}`);
      }

      let finalFilePath = filePath;
      let savedLocationLabel = 'penyimpanan perangkat';

      if (Platform.OS === 'android') {
        const hasLegacyPermission = await ensureLegacyAndroidWritePermission();
        if (!hasLegacyPermission) {
          throw new Error(
            'Izin penyimpanan ditolak. PDF tidak bisa disimpan ke folder Download.',
          );
        }

        const RNBlobUtil = require('react-native-blob-util');
        const blobUtil = RNBlobUtil?.default ?? RNBlobUtil;

        if (blobUtil?.MediaCollection?.copyToMediaStore) {
          const mediaUri = await blobUtil.MediaCollection.copyToMediaStore(
            {
              name: `${fileName}.pdf`,
              parentFolder: 'PlanTodayPDF',
              mimeType: 'application/pdf',
            },
            'Download',
            filePath,
          );

          finalFilePath =
            typeof mediaUri === 'string' && mediaUri.trim()
              ? mediaUri
              : filePath;
          savedLocationLabel = 'Download/PlanTodayPDF';
        } else {
          const downloadDir = RNFS.DownloadDirectoryPath;
          const targetDir = `${downloadDir}/PlanTodayPDF`;
          const targetPath = `${targetDir}/${fileName}.pdf`;

          await RNFS.mkdir(targetDir);
          await RNFS.copyFile(filePath, targetPath);
          finalFilePath = targetPath;
          savedLocationLabel = targetDir;
        }

        console.log('[PDF] Android final saved path:', finalFilePath);
      } else {
        const targetDir = `${RNFS.DocumentDirectoryPath}/PlanTodayPDF`;
        const targetPath = `${targetDir}/${fileName}.pdf`;
        await RNFS.mkdir(targetDir);
        await RNFS.copyFile(filePath, targetPath);
        finalFilePath = targetPath;
        savedLocationLabel = targetDir;
      }

      console.log('[PDF] File ready:', {
        filePath: finalFilePath,
        savedLocationLabel,
      });

      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil',
        text2: `PDF tersimpan di ${savedLocationLabel}`,
      });
    } catch (err: any) {
      console.error('[PDF] Error:', err);
      Toast.show({
        type: 'glassError',
        text1: 'Gagal export PDF',
        text2:
          err?.message ||
          'Terjadi kesalahan saat menyimpan PDF ke penyimpanan perangkat.',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [buildPdfHtml, header, nomor, pdfHeaderAssetUri, resolvePdfImageSrc]);

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Detail Penawaran</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {displayNomor}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Memuat detail penawaran...</Text>
        </View>
      ) : !header ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Data tidak ditemukan.</Text>
        </View>
      ) : (
        <FlatList
          data={details}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 120 + insets.bottom },
          ]}
          ListHeaderComponent={
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Informasi Header</Text>
              <InfoRow label="Tanggal" value={formatDate(header.tanggal)} />
              {!!nomorPermintaan && (
                <InfoRow label="No. Permintaan" value={nomorPermintaan} />
              )}
              <InfoRow label="Customer" value={header.customer} />
              <InfoRow label="Perusahaan" value={header.perusahaan} />
              <InfoRow label="Sales" value={header.sales} />
              <InfoRow label="Tipe" value={header.tipe} />
              <InfoRow label="UP" value={header.up} />
              <InfoRow label="TTD" value={header.ttd} />
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>Note</Text>
                <Text style={styles.noteText}>{header.note || '-'}</Text>
              </View>
              <InfoRow label="Nominal" value={formatCurrency(header.nominal)} />
            </View>
          }
          ListFooterComponent={
            activityLogs.length > 0 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Activity Log</Text>
                {activityLogs.map((log, idx) => {
                  const rawState = normalizeApprovalState(log.approval_state);
                  const stateLabel = rawState || '-';
                  const stateColor =
                    PENAWARAN_STATUS_COLORS[rawState] || THEME.muted;

                  return (
                    <View
                      key={`${log.created_at}-${idx}`}
                      style={styles.logItem}
                    >
                      <View style={styles.logTopRow}>
                        <Text style={styles.logType}>
                          {log.type === 'APPROVAL'
                            ? `Approval ${stateLabel}`
                            : 'Update Status Detail'}
                        </Text>
                        {log.type === 'APPROVAL' && (
                          <View
                            style={[
                              styles.approvalBadge,
                              { backgroundColor: `${stateColor}1A` },
                            ]}
                          >
                            <Text
                              style={[
                                styles.approvalBadgeText,
                                { color: stateColor },
                              ]}
                            >
                              {stateLabel}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.logMeta}>
                        {formatDateTimeDDMMYYYY(log.created_at)} •{' '}
                        {log.user || '-'}
                      </Text>
                      {!!log.note && (
                        <Text style={styles.logText}>{log.note}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {index + 1}. {item.nama_barang || '-'}
                </Text>
                <Text style={styles.itemStatus}>{item.status || 'OPEN'}</Text>
              </View>

              <Text style={styles.itemMeta}>
                {item.bahan || '-'} • {item.ukuran || '-'} •{' '}
                {item.satuan || '-'}
              </Text>
              <Text style={styles.itemMeta}>
                Qty {item.qty} x {formatCurrency(item.harga)}
              </Text>
              <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>

              {!!item.ket_batal && (
                <Text style={styles.itemRemark}>Batal: {item.ket_batal}</Text>
              )}
              {!!item.ket_confirm && (
                <Text style={styles.itemRemark}>
                  Confirm: {item.ket_confirm}
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Belum ada detail item.</Text>
            </View>
          }
        />
      )}

      <PenawaranApprovalModal
        visible={approvalModalVisible}
        nomor={nomor}
        onClose={() => setApprovalModalVisible(false)}
        onSuccess={() => loadDetail()}
      />

      {!loading && header && (
        <View
          style={[
            styles.bottomAction,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnFull,
              styles.actionBtnPrimary,
              exportingPdf && styles.actionButtonDisabled,
            ]}
            onPress={handleExportPdf}
            disabled={exportingPdf}
            activeOpacity={0.9}
          >
            <Text style={styles.bottomActionText}>
              {exportingPdf ? 'Export PDF...' : 'Eksport PDF'}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnSoft,
                isWaitingApproval && styles.actionButtonDisabled,
              ]}
              onPress={() =>
                navigation.navigate('PenawaranStatus', { nomor: header.nomor })
              }
              disabled={isWaitingApproval}
              activeOpacity={0.9}
            >
              <Text style={[styles.bottomActionText, { color: THEME.primary }]}>
                Ubah Status
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnSoft,
                isWaitingApproval && styles.actionButtonDisabled,
              ]}
              onPress={() => setApprovalModalVisible(true)}
              disabled={isWaitingApproval}
              activeOpacity={0.9}
            >
              <Text style={[styles.bottomActionText, { color: THEME.primary }]}>
                Ajukan Perubahan
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingTop: Platform.OS === 'android' ? 44 : 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 8,
  },
  backBtn: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  backBtnText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  title: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 17,
    textAlign: 'center',
  },
  titleWrap: {
    flex: 1,
    paddingTop: 2,
    alignItems: 'center',
  },
  subtitle: {
    marginTop: 1,
    color: THEME.muted,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 74,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.muted,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 2,
    gap: 10,
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    ...PENAWARAN_SHADOW.softCard,
  },
  sectionTitle: {
    fontSize: 14,
    color: THEME.ink,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  infoLabel: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  infoValue: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  noteBlock: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.22)',
    backgroundColor: 'rgba(79,70,229,0.06)',
    padding: 10,
  },
  noteLabel: {
    color: THEME.primary,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  noteText: {
    color: THEME.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  approvalBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    alignSelf: 'flex-start',
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  itemCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
    ...PENAWARAN_SHADOW.softCard,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    flex: 1,
    color: THEME.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  itemStatus: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  itemMeta: {
    marginTop: 4,
    color: THEME.ink,
    fontSize: 12,
  },
  itemTotal: {
    marginTop: 8,
    color: THEME.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  itemRemark: {
    marginTop: 4,
    color: THEME.ink,
    fontSize: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 20,
  },
  emptyText: {
    color: THEME.muted,
    fontSize: 13,
  },
  logItem: {
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 8,
    marginTop: 8,
  },
  logTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  logType: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
  },
  logMeta: {
    marginTop: 2,
    fontSize: 11,
    color: THEME.ink,
    fontWeight: 500,
  },
  logText: {
    marginTop: 4,
    fontSize: 12,
    color: THEME.ink,
  },
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    gap: 8,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnFull: {
    width: '100%',
    flex: 0,
  },
  actionBtnPrimary: {
    backgroundColor: THEME.primary,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  actionBtnSoft: {
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderColor: 'rgba(79,70,229,0.18)',
  },
  bottomActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
