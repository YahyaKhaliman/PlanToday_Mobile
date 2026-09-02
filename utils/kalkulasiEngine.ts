import { KalkulasiState, KomponenKainItem } from '../types/kalkulasiTypes';

/**
 * Pure calculation engine untuk modul kalkulasi harga PlanToday Mobile.
 * Mengikuti 100% rumus dan batasan di Manksi Web / Delphi.
 */
export function calculateKalkulasiPrice(state: KalkulasiState, qtyOrder: number) {
  const qty = Number(qtyOrder) || 0;

  // 1. Hitung Baris Komponen Bahan
  const updatedKomponen: KomponenKainItem[] = (state.GridKomponen || []).map(item => {
    const babaran = Number(item.Babaran) || 0;
    const harga = Number(item.Harga) || 0;

    if (!babaran || !harga) {
      return {
        ...item,
        Kebutuhan: 0,
        Bruto: 0,
        Pcs: 0,
      };
    }

    const kebutuhan = item.Kg ? qty / babaran : qty * babaran;
    const bruto = item.Kg ? harga / babaran : harga * babaran;
    const pcs = item.Pabrik ? bruto / 1.11 : bruto;

    return {
      ...item,
      Kebutuhan: kebutuhan,
      Bruto: bruto,
      Pcs: pcs,
    };
  });

  const totBahan = updatedKomponen.reduce(
    (acc, curr) => acc + (Number(curr.Pcs) || 0),
    0,
  );

  // 2. Hitung Total Cetak & Aksesoris Tambahan
  const totCetak = (state.GridCetak || []).reduce(
    (acc, curr) => acc + (Number(curr.Harga) || 0),
    0,
  );

  const totTambahan = (state.GridAksesoris || []).reduce(
    (acc, curr) => acc + (Number(curr.Harga) || 0),
    0,
  );

  // 3. Hitung Luas & Biaya Bordir (Batas Minimal: Rp 2.500)
  let luasBordir = 0;
  const bd = state.Bordir || ({} as any);
  for (let i = 1; i <= 8; i++) {
    const p = Number(bd[`P${i}`]) || 0;
    const l = Number(bd[`L${i}`]) || 0;
    luasBordir += p * l;
  }
  let rpBordir = (Number(bd.Cm) || 0) * luasBordir;
  if (rpBordir > 0 && rpBordir < 2500) {
    rpBordir = 2500;
  }
  const rpBordirTotal = Math.round(rpBordir);

  // 4. Hitung Luas & Biaya DTF (Batas Minimal: Rp 3.000)
  let luasDtf = 0;
  const df = state.Dtf || ({} as any);
  for (let i = 1; i <= 8; i++) {
    const p = Number(df[`P${i}`]) || 0;
    const l = Number(df[`L${i}`]) || 0;
    luasDtf += p * l;
  }
  let rpDtf = (Number(df.Cm) || 0) * luasDtf;
  if (rpDtf > 0 && rpDtf < 3000) {
    rpDtf = 3000;
  }
  const rpDtfTotal = Math.round(rpDtf);

  // 5. Hitung HPP Murni
  const hppMurni =
    totBahan +
    totCetak +
    rpBordirTotal +
    rpDtfTotal +
    (Number(state.RpPotong) || 0) +
    (Number(state.RpJahit) || 0) +
    (Number(state.RpFinishing) || 0) +
    (Number(state.RpObat) || 0) +
    (Number(state.RpKirim) || 0) +
    totTambahan;

  // 6. Terapkan Allowance
  const persenAllowance = Number(state.PersenAllowance) || 0;
  const rpAllowance = Math.round((hppMurni * persenAllowance) / 100);
  const totalHPP = Math.round(hppMurni + rpAllowance);

  // 7. Terapkan Margin Laba
  let rpLaba = Number(state.RpLaba) || 0;
  const persenLaba = Number(state.PersenLaba) || 0;
  if (persenLaba > 0) {
    rpLaba = Math.round((totalHPP * persenLaba) / 100);
  }
  const hargaSesuai = Math.round(totalHPP + rpLaba);

  // 8. Terapkan PPN
  const persenPpn = Number(state.PersenPpn) || 0;
  let hargaSesuaiPpn = Number(state.HargaSesuaiPpn) || 0;
  if (state.UpdateOtomatis) {
    hargaSesuaiPpn = Math.round(hargaSesuai * (1 + persenPpn / 100));
  }

  return {
    updatedKomponen,
    totBahan,
    totCetak,
    totTambahan,
    luasBordir,
    rpBordirTotal,
    luasDtf,
    rpDtfTotal,
    hppMurni,
    rpAllowance,
    totalHPP,
    rpLaba,
    hargaSesuai,
    hargaSesuaiPpn,
  };
}
