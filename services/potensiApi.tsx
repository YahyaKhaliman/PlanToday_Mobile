import api from './api';

export type PotensiListItem = {
    pot_nomor: string;
    pot_sal_kode?: string;
    sales_kode?: string;
    sal_nama?: string;
    sales_nama?: string;
    pot_cus_kode?: string;
    customer_kode?: string;
    cus_nama?: string;
    customer_nama?: string;
    pot_pen_nomor?: string | null;
    pen_nomor?: string | null;
    pot_mspk_nomor?: string | null;
    mspk_nomor?: string | null;
    pot_nama_item?: string;
    nama_item?: string;
    pot_harga?: number;
    harga?: number;
    pot_status?: 'OPEN' | 'CLOSE' | 'BATAL' | string;
    status?: 'OPEN' | 'CLOSE' | 'BATAL' | string;
    pot_alasan_batal?: string | null;
    alasan_batal?: string | null;
    pot_tanggal?: string | null;
    user_create?: string | null;
    date_create?: string | null;
    user_modified?: string | null;
    date_modified?: string | null;
};

export type PotensiKpiSummary = {
    total_count: number;
    open_count: number;
    close_count: number;
    batal_count: number;
    total_nominal: number;
    open_nominal: number;
    close_nominal: number;
    batal_nominal: number;
    closing_rate_pct: number;
};

export type PotensiListResponse = {
    data: PotensiListItem[];
    meta: {
        startDate: string;
        endDate: string;
        count: number;
        kpi_summary: PotensiKpiSummary;
        filter_options: {
            sales: string[];
            customers: string[];
        };
    };
};

export type PotensiListParams = {
    startDate?: string;
    endDate?: string;
    status?: string;
    sales?: string;
    customer?: string;
    search?: string;
    limit?: number;
};

export type PotensiKandidatItem = {
    tipe_sumber: 'PENAWARAN' | 'MAP';
    pen_nomor?: string | null;
    mspk_nomor?: string | null;
    item_id?: string | null;
    nama_item: string;
    harga: number;
    harga_satuan?: number | null;
    qty?: number | null;
    satuan?: string | null;
    ukuran?: string | null;
    bahan?: string | null;
    tanggal?: string | null;
    sales_kode?: string | null;
    sales_nama?: string | null;
    customer_kode?: string | null;
    customer_nama?: string | null;
    perush_kode?: string | null;
    jo_kode?: string | null;
};

export type PotensiKandidatParams = {
    sales?: string;
    search?: string;
    sumber?: 'ALL' | 'PENAWARAN' | 'MAP';
};

export type CreatePotensiPayload = {
    pot_sal_kode?: string;
    pot_cus_kode?: string;
    pot_pen_nomor?: string | null;
    pot_mspk_nomor?: string | null;
    pot_nama_item: string;
    pot_harga: number;
    pot_perush_kode?: string;
    pot_jo_kode?: string;
};

export const getPotensiList = async (
    params: PotensiListParams = {},
    token?: string | null,
): Promise<PotensiListResponse> => {
    const response = await api.get('/potensi', {
        params: {
            ...params,
            search: params.search?.trim() || undefined,
            sales: params.sales?.trim() || undefined,
            customer: params.customer?.trim() || undefined,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    const resData = response?.data || {};
    const dataList: PotensiListItem[] = Array.isArray(resData.data) ? resData.data : [];
    const summary = resData.summary || {};
    const metaKpi: PotensiKpiSummary = resData.meta?.kpi_summary || {
        total_count: Number(summary.total_item || 0),
        open_count: Number(summary.total_potensi || 0),
        close_count: Number(summary.total_close || 0),
        batal_count: Number(summary.total_batal || 0),
        total_nominal: Number(summary.nominal_total || 0),
        open_nominal: Number(summary.nominal_potensi || 0),
        close_nominal: Number(summary.nominal_close || 0),
        batal_nominal: 0,
        closing_rate_pct: Number(summary.conversion_rate || 0),
    };

    return {
        data: dataList,
        meta: {
            startDate: resData.meta?.startDate || '',
            endDate: resData.meta?.endDate || '',
            count: dataList.length,
            kpi_summary: metaKpi,
            filter_options: {
                sales: resData.meta?.filter_options?.sales || [],
                customers: resData.meta?.filter_options?.customers || [],
            },
        },
    };
};

export const getPotensiKandidatList = async (
    params: PotensiKandidatParams = {},
    token?: string | null,
): Promise<PotensiKandidatItem[]> => {
    const response = await api.get('/potensi/kandidat', {
        params: {
            ...params,
            search: params.search?.trim() || undefined,
            sales: params.sales?.trim() || undefined,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return (response?.data?.data ?? []) as PotensiKandidatItem[];
};

export const createPotensiBatch = async (
    items: CreatePotensiPayload[],
    token?: string | null,
) => {
    const response = await api.post(
        '/potensi',
        { items },
        {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
    );
    return response?.data;
};

export const batalPotensi = async (
    pot_nomor: string,
    alasan: string,
    token?: string | null,
) => {
    const response = await api.post(
        `/potensi/${encodeURIComponent(pot_nomor)}/batal`,
        { alasan },
        {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
    );
    return response?.data;
};
