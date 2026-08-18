# PlanToday - Mobile Application Client

PlanToday adalah aplikasi mobile berbasis **React Native (CLI)** yang digunakan untuk manajemen kunjungan sales (visit plan), pelacakan pencapaian (achievement), manajemen pengiriman kurir, pembuatan penawaran, pelacakan SPK, serta pengajuan permintaan harga.

Aplikasi ini dibangun menggunakan **TypeScript** dan berkomunikasi dengan backend layanan REST API PlanToday.

---

## 🚀 Fitur Utama

Aplikasi ini memiliki beberapa modul utama berdasarkan peran (role) pengguna:

1. **Dashboard & Manajemen Kunjungan (Visit & Sales)**
   - Rencana kunjungan harian/mingguan (Visit Plan).
   - Penambahan dan pembaharuan data calon customer baru.
   - Perekaman kunjungan riil di lapangan (Visit Record).
2. **Pelacakan Pencapaian (Achievement)**
   - Grafik visual pencapaian omset menggunakan chart interaktif (`react-native-gifted-charts`).
   - Detail KPI target dan realisasi per sales.
3. **Modul Pengiriman Kurir (Courier)**
   - Rencana pengiriman, jadwal kirim, dan pelacakan proses kirim barang.
   - Upload bukti pengiriman fisik langsung dari kamera/galeri.
4. **Modul Penawaran Harga (Quotation)**
   - Pembuatan draf penawaran harga.
   - Pelacakan status persetujuan penawaran.
   - Integrasi pencarian data perusahaan dan data sales.
5. **Modul Permintaan Harga & SPK (Price Request)**
   - Form permintaan harga oleh sales lengkap dengan unggah gambar produk referensi.
   - Tracking alur pengerjaan Surat Perintah Kerja (SPK).

---

## 🛠️ Tech Stack & Dependensi Utama

- **Core**: React Native v0.83.0, React v19.2.0, TypeScript.
- **Navigasi**: React Navigation v7 (`@react-navigation/native-stack`).
- **State & Autentikasi**: React Context API (`AuthProvider`).
- **HTTP Client**: Axios dengan mekanisme interseptor deduping request (mencegah klik ganda).
- **UI & Grafis**:
  - `react-native-vector-icons` (Material Icons).
  - `react-native-svg` & `react-native-gifted-charts` (visualisasi data).
  - `react-native-linear-gradient` (desain antarmuka premium).
- **Layanan Native**:
  - `@react-native-async-storage/async-storage` (penyimpanan lokal).
  - `react-native-geolocation-service` (perekaman GPS koordinat kunjungan/kurir).
  - `react-native-image-picker` & `react-native-image-resizer` (manajemen kamera & kompresi foto).
  - `react-native-html-to-pdf` & `react-native-share` (ekspor laporan PDF).

---

## 📂 Struktur Folder Proyek

```
PlanToday/
├── android/                  # Kode native Android
├── ios/                      # Kode native iOS
├── components/               # Komponen UI global (loading skeleton, toast kustom)
├── context/                  # Pengelolaan global state (autentikasi / session)
├── navigation/               # Konfigurasi navigasi stack & pembatasan akses halaman
├── screens/                  # Folder layar UI aplikasi dikelompokkan per modul:
│   ├── Login/ & Register/    # Autentikasi pengguna
│   ├── Home/                 # Halaman utama, Visit Plan, & Calon Customer
│   ├── Achievement/          # Tampilan grafik target/realisasi omset
│   ├── Kurir/                # Manajemen pengiriman logistik & kurir
│   ├── Penawaran/            # Pembuatan & tracking penawaran harga
│   └── PermintaanHarga/      # Formulir permintaan harga & detailnya
├── services/                 # Integrasi API, manajemen update, & penyimpanan lokal
└── utils/                    # Fungsi pembantu / utilitas umum
```

---

## ⚙️ Persyaratan Sistem & Instalasi Lokal

Sebelum menjalankan aplikasi, pastikan komputer Anda telah dikonfigurasi untuk pengembangan React Native:

### 1. Prasyarat OS & Environment
- **Node.js**: Versi `>= 20` (disarankan LTS).
- **Java Development Kit (JDK)**: Versi `17` (sangat direkomendasikan **Temurin** atau **OpenJDK**).
- **Android Studio**:
  - Instal Android SDK Platform-34 atau terbaru.
  - Konfigurasikan variabel lingkungan `ANDROID_HOME` di sistem Windows Anda.
  - Siapkan Android Virtual Device (AVD) / Emulator.
- **CocoaPods** *(Khusus macOS untuk target iOS)*:
  - Instal bundler Ruby untuk dependensi pods.

### 2. Instalasi Dependensi
Jalankan perintah berikut di root folder proyek:
```bash
npm install
```
*Atau untuk instalasi bersih yang sesuai dengan lockfile:*
```bash
npm ci
```

---

## 💻 Cara Menjalankan Aplikasi di Lokal

### Langkah 1: Konfigurasi Endpoint API
Buka file [services/api.tsx](file:///d:/Coding/PlanToday/services/api.tsx) dan sesuaikan konfigurasi host API:
```typescript
// Untuk pengembangan menggunakan emulator Android lokal, arahkan ke 10.0.2.2 atau IP komputer Anda
export const PUBLIC_API_ORIGIN = 'http://10.0.2.2:3001'; 

// Untuk mode produksi / server staging VPS
// export const PUBLIC_API_ORIGIN = 'http://YOUR_SERVER_IP:3005'; 
```

### Langkah 2: Jalankan Metro Bundler
Jalankan Metro bundler di terminal terpisah untuk memproses bundel JavaScript:
```bash
npm start
```

### Langkah 3: Jalankan Aplikasi pada Perangkat/Emulator

#### **Target Android**
Pastikan emulator Android Anda sudah menyala atau perangkat fisik Android sudah terhubung melalui `adb debug`. Jalankan perintah berikut:
```bash
npm run android
```

#### **Target iOS** *(Hanya di macOS)*
1. Instal CocoaPods terlebih dahulu:
   ```bash
   cd ios
   bundle install
   bundle exec pod install
   cd ..
   ```
2. Jalankan aplikasi di simulator iOS:
   ```bash
   npm run ios
   ```

---

## 🏗️ Alur Pembagian API Client (Axios Interceptors)

Aplikasi ini menggunakan Axios Client kustom di [services/api.tsx](file:///d:/Coding/PlanToday/services/api.tsx) dengan fitur **Request Deduplication** otomatis.
Mekanisme ini mencegah pengiriman request mutasi ganda (`POST`, `PUT`, `PATCH`, `DELETE`) secara tidak sengaja ketika user melakukan double-click secara cepat pada tombol submit.
- Jika request mutasi yang sama persis sedang berjalan (dalam status *in-flight*), request berikutnya akan dibatalkan dengan pesan error `'Permintaan sedang diproses. Mohon tunggu.'`.
- Kunci keunikan request dibentuk berdasarkan: `metode | url | query parameter | payload data`.

---

## 📦 Alur Pengemasan & Deployment (CI/CD)

Rilis aplikasi Android dikelola secara otomatis menggunakan GitHub Actions melalui workflow yang didefinisikan di `.github/workflows/android-release-vps.yml`.

### Cara Kerja Workflow Rilis:
1. **Pemicu (Trigger)**: Push commit baru ke branch `main` atau trigger manual melalui tab Actions di GitHub.
2. **Persiapan Environtment**: Setup Java 17 dan Node 20, lalu install dependensi menggunakan `npm ci`.
3. **Pemberian Tanda Tangan Keystore**: Mendekode file Android Keystore dari GitHub Secret (`ANDROID_KEYSTORE_BASE64`) menjadi file `android/app/upload-keystore.jks`.
4. **Validasi Versi**: Membaca `versionCode` lokal dari [android/app/build.gradle](file:///d:/Coding/PlanToday/android/app/build.gradle) dan membandingkannya dengan versi rilis terakhir di server (`latest.json`). Jika versi lokal tidak lebih tinggi, build akan dibatalkan secara otomatis guna mencegah konflik versi.
5. **Kompilasi**: Melakukan build APK Rilis menggunakan Gradle:
   ```bash
   ./gradlew assembleRelease
   ```
6. **Unggah ke VPS**: Mengunggah APK hasil kompilasi dan manifes pembaruan `latest.json` ke VPS tujuan via SCP.
7. **Pembersihan Logistik**: Script di VPS akan memindahkan APK ke folder rilis utama dan menghapus versi lama secara otomatis, dengan hanya mempertahankan **2 versi APK terbaru** untuk efisiensi penyimpanan.
