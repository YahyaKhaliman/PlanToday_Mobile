// eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

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

const APPROVAL_COLORS: Record<string, string> = {
  WAIT: '#D97706',
  ACC: '#16A34A',
  TOLAK: '#DC2626',
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

const toShareUri = (filePath: string) =>
  /^content:\/\//i.test(filePath) || /^file:\/\//i.test(filePath)
    ? filePath
    : `file://${filePath}`;

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
      const [data, logs] = await Promise.all([
        getPenawaranDetail(nomor),
        getPenawaranActivityLogs(nomor),
      ]);
      setHeader(data?.header || null);
      setDetails(data?.details || []);
      setActivityLogs(Array.isArray(logs) ? logs : []);
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

  const title = useMemo(
    () => header?.nomor || nomor || 'Detail Penawaran',
    [header?.nomor, nomor],
  );

  const approvalState = normalizeApprovalState(header?.approval_state);
  const approvalColor = APPROVAL_COLORS[approvalState] || THEME.muted;
  const approvalLabel = approvalState || '-';
  const isWaitingApproval = approvalState === 'WAIT';

  const buildPdfHtml = useCallback(() => {
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
      String(header.ttd_jabatan || '').trim() || 'Supervisor Office Marketing';
    const note = String(header.note || header.keterangan || '').trim() || '-';

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
                <div class="brand">Kencana Print</div>
                <div class="tagline">Semakin Nyala Semakin Nyata</div>
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
                  <tr><td class="label">Keterangan</td><td class="sep">:</td><td>${escapeHtml(
                    header.keterangan || '-',
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
  }, [details, header, nomor]);

  const handleSaveAndShareToWhatsapp = useCallback(async () => {
    if (!header) return;

    setExportingPdf(true);
    try {
      const { generatePDF } = await import('react-native-html-to-pdf');

      const safeNomor = toSafeFileName(header.nomor || nomor);
      const fileName = `Penawaran_${safeNomor}_${Date.now()}`;
      const html = buildPdfHtml();

      // Android: use logical directory name (not absolute path) to avoid invalid mixed paths
      const directory =
        Platform.OS === 'android' ? 'PlanTodayPDF' : RNFS.DocumentDirectoryPath;

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

      if (Platform.OS === 'android') {
        const hasLegacyPermission = await ensureLegacyAndroidWritePermission();
        if (!hasLegacyPermission) {
          throw new Error(
            'Izin penyimpanan ditolak. PDF tidak bisa disimpan ke Download.',
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
        } else {
          const downloadDir = RNFS.DownloadDirectoryPath;
          const targetDir = `${downloadDir}/PlanTodayPDF`;
          const targetPath = `${targetDir}/${fileName}.pdf`;

          await RNFS.mkdir(targetDir);
          await RNFS.copyFile(filePath, targetPath);
          finalFilePath = targetPath;
        }

        console.log('[PDF] Android final saved path:', finalFilePath);
      }

      const fileUrl = toShareUri(finalFilePath);
      console.log('[PDF] File ready:', { filePath: finalFilePath, fileUrl });

      const RNShare = require('react-native-share');
      const shareInstance =
        typeof RNShare.default?.open === 'function' ? RNShare.default : RNShare;

      try {
        await shareInstance.open({
          url: fileUrl,
          filename: `${fileName}.pdf`,
          type: 'application/pdf',
          failOnCancel: false,
          showAppsToView: true,
        });
      } catch (primaryShareError: any) {
        console.warn('[PDF] Share primary failed, trying fallback:', {
          message: primaryShareError?.message,
        });

        try {
          await shareInstance.open({
            urls: [fileUrl],
            type: 'application/pdf',
            failOnCancel: false,
          });
        } catch (fallbackShareError: any) {
          console.warn('[PDF] Share fallback failed:', {
            message: fallbackShareError?.message,
          });
          throw fallbackShareError;
        }
      }

      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil',
        text2:
          Platform.OS === 'android'
            ? 'PDF tersimpan di Download dan siap dibagikan.'
            : 'PDF siap dibagikan.',
      });
    } catch (err: any) {
      console.error('[PDF] Error:', err);
      Toast.show({
        type: 'glassError',
        text1: 'Gagal export PDF',
        text2: err?.message || 'Coba lagi atau hubungi support.',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [buildPdfHtml, header, nomor]);

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
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {!loading && header && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.pdfButton,
              exportingPdf && styles.actionButtonDisabled,
            ]}
            onPress={handleSaveAndShareToWhatsapp}
            disabled={exportingPdf}
          >
            <Text style={styles.actionButtonText}>
              {exportingPdf ? 'Export PDF...' : 'Simpan + Share WA'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isWaitingApproval && styles.actionButtonDisabled,
            ]}
            onPress={() =>
              navigation.navigate('PenawaranStatus', { nomor: header.nomor })
            }
            disabled={isWaitingApproval}
          >
            <Text style={styles.actionButtonText}>Ubah Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.approvalButton,
              isWaitingApproval && styles.actionButtonDisabled,
            ]}
            onPress={() => setApprovalModalVisible(true)}
            disabled={isWaitingApproval}
          >
            <Text style={styles.actionButtonText}>Ajukan Perubahan</Text>
          </TouchableOpacity>
        </View>
      )}

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
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Informasi Header</Text>
              <InfoRow label="Tanggal" value={header.tanggal} />
              <InfoRow label="Customer" value={header.customer} />
              <InfoRow label="Perusahaan" value={header.perusahaan} />
              <InfoRow label="Sales" value={header.sales} />
              <InfoRow label="Tipe" value={header.tipe} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status Approval</Text>
                <View
                  style={[
                    styles.approvalBadge,
                    { backgroundColor: `${approvalColor}1A` },
                  ]}
                >
                  <Text
                    style={[styles.approvalBadgeText, { color: approvalColor }]}
                  >
                    {approvalLabel}
                  </Text>
                </View>
              </View>
              <InfoRow label="Nominal" value={formatCurrency(header.nominal)} />
              <InfoRow label="Keterangan" value={header.keterangan} />
            </View>
          }
          ListFooterComponent={
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Activity Log</Text>
              {activityLogs.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada activity log.</Text>
              ) : (
                activityLogs.map((log, idx) => {
                  const rawState = normalizeApprovalState(log.approval_state);
                  const stateLabel = rawState || '-';
                  const stateColor = APPROVAL_COLORS[rawState] || THEME.muted;

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
                        {log.created_at || '-'} • {log.user || '-'}
                      </Text>
                      {!!log.keterangan && (
                        <Text style={styles.logText}>{log.keterangan}</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingTop: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  backBtn: {
    backgroundColor: 'rgba(79,70,229,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backBtnText: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    flex: 1,
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 17,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  actionButton: {
    minWidth: 110,
    flexGrow: 1,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfButton: {
    backgroundColor: '#0F766E',
  },
  approvalButton: {
    backgroundColor: THEME.accent,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
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
    flex: 1,
  },
  infoValue: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  approvalBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  itemCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
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
    fontWeight: '700',
  },
  itemMeta: {
    marginTop: 4,
    color: THEME.muted,
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
    color: THEME.muted,
  },
  logText: {
    marginTop: 4,
    fontSize: 12,
    color: THEME.ink,
  },
});
