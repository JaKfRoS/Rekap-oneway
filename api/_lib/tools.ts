import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getScopedSupabaseClient } from './supabaseAdmin';
import { getActualIncomeAmount, getPiutangAmount, formatIDR } from './finance';

interface SessionExtra {
  userId: string;
  supabaseAccessToken: string;
}

function getSession(ctx: any): SessionExtra | null {
  const authInfo = ctx?.http?.authInfo;
  const extra = authInfo?.extra as SessionExtra | undefined;
  if (!extra?.userId || !extra?.supabaseAccessToken) return null;
  return extra;
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function toolText(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

const TransactionType = z.enum(['income', 'expense']);
const PaymentStatus = z.enum(['paid', 'unpaid', 'partial']);
const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export function registerKasUsahaTools(server: McpServer) {
  server.registerTool(
    'list_transactions',
    {
      title: 'Lihat Transaksi',
      description:
        'Mengambil daftar transaksi pemasukan/pengeluaran KasUsaha milik pengguna yang sedang login, dengan filter opsional.',
      inputSchema: z.object({
        type: TransactionType.optional().describe('Filter jenis transaksi: income atau expense'),
        payment_status: PaymentStatus.optional().describe('Filter status pembayaran'),
        category: z.string().optional().describe('Filter kategori persis (case-sensitive)'),
        start_date: DateString.optional().describe('Tanggal mulai (inklusif), format YYYY-MM-DD'),
        end_date: DateString.optional().describe('Tanggal akhir (inklusif), format YYYY-MM-DD'),
        search: z.string().optional().describe('Cari di nama klien, catatan, atau kategori'),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      let query = supabase.from('transactions').select('*').order('date', { ascending: false }).limit(args.limit);

      if (args.type) query = query.eq('type', args.type);
      if (args.payment_status) query = query.eq('payment_status', args.payment_status);
      if (args.category) query = query.eq('category', args.category);
      if (args.start_date) query = query.gte('date', args.start_date);
      if (args.end_date) query = query.lte('date', args.end_date);
      if (args.search) {
        const term = args.search.replace(/[%,]/g, '');
        query = query.or(`client_name.ilike.%${term}%,notes.ilike.%${term}%,category.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) return toolError(`Gagal mengambil transaksi: ${error.message}`);

      return toolText(JSON.stringify(data, null, 2));
    }
  );

  server.registerTool(
    'add_transaction',
    {
      title: 'Tambah Transaksi',
      description:
        'Mencatat transaksi pemasukan atau pengeluaran baru. Untuk pemasukan, nama klien wajib diisi. Untuk status "partial" (DP), dp_amount (nominal yang sudah diterima) wajib diisi dan harus lebih kecil dari amount.',
      inputSchema: z.object({
        date: DateString,
        type: TransactionType,
        category: z.string().min(1),
        client_name: z.string().min(1).optional().describe('Wajib untuk transaksi type=income'),
        amount: z.number().positive().describe('Total nilai transaksi/deal'),
        dp_amount: z
          .number()
          .nonnegative()
          .optional()
          .describe('Nominal yang sudah diterima, wajib jika payment_status=partial'),
        payment_status: PaymentStatus.default('paid').describe('Hanya relevan untuk type=income; expense selalu paid'),
        notes: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      if (args.type === 'income' && !args.client_name) {
        return toolError('Nama klien wajib diisi untuk transaksi pemasukan (type=income).');
      }

      const paymentStatus = args.type === 'income' ? args.payment_status : 'paid';
      let dpAmount: number | null = null;
      if (args.type === 'income' && paymentStatus === 'partial') {
        if (args.dp_amount == null || args.dp_amount <= 0) {
          return toolError('dp_amount wajib diisi (angka positif) untuk payment_status=partial.');
        }
        if (args.dp_amount >= args.amount) {
          return toolError('dp_amount harus lebih kecil dari amount. Jika sudah lunas, gunakan payment_status=paid.');
        }
        dpAmount = args.dp_amount;
      } else if (paymentStatus === 'paid') {
        dpAmount = args.amount;
      }

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          date: args.date,
          type: args.type,
          category: args.category,
          client_name: args.type === 'income' ? args.client_name : null,
          amount: args.amount,
          dp_amount: dpAmount,
          payment_status: paymentStatus,
          notes: args.notes || '',
          user_id: session.userId,
        })
        .select()
        .single();

      if (error) return toolError(`Gagal menambah transaksi: ${error.message}`);

      return toolText(`Transaksi berhasil ditambahkan.\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.registerTool(
    'update_transaction',
    {
      title: 'Ubah Transaksi',
      description: 'Mengubah sebagian atau seluruh data transaksi yang sudah ada, berdasarkan id.',
      inputSchema: z.object({
        id: z.string().uuid(),
        date: DateString.optional(),
        type: TransactionType.optional(),
        category: z.string().min(1).optional(),
        client_name: z.string().nullable().optional(),
        amount: z.number().positive().optional(),
        dp_amount: z.number().nonnegative().nullable().optional(),
        payment_status: PaymentStatus.optional(),
        notes: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const { id, ...fields } = args;
      const updatePayload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updatePayload[key] = value;
      }
      if (Object.keys(updatePayload).length === 0) {
        return toolError('Tidak ada field yang diubah. Sertakan minimal satu field selain id.');
      }

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) return toolError(`Gagal mengubah transaksi: ${error.message}`);
      if (!data) return toolError('Transaksi tidak ditemukan (mungkin id salah atau bukan milik akun ini).');

      return toolText(`Transaksi berhasil diubah.\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.registerTool(
    'delete_transaction',
    {
      title: 'Hapus Transaksi',
      description: 'Menghapus satu transaksi berdasarkan id. Tindakan ini permanen.',
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase.from('transactions').delete().eq('id', args.id).select().maybeSingle();

      if (error) return toolError(`Gagal menghapus transaksi: ${error.message}`);
      if (!data) return toolError('Transaksi tidak ditemukan (mungkin id salah atau bukan milik akun ini).');

      return toolText(`Transaksi berhasil dihapus (id: ${args.id}).`);
    }
  );

  server.registerTool(
    'get_financial_summary',
    {
      title: 'Ringkasan Keuangan',
      description:
        'Menghitung total pemasukan (kas diterima), pengeluaran, laba bersih, dan piutang (tagihan belum lunas) pada rentang tanggal tertentu (atau semua waktu jika tidak diisi).',
      inputSchema: z.object({
        start_date: DateString.optional(),
        end_date: DateString.optional(),
      }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      let query = supabase.from('transactions').select('*');
      if (args.start_date) query = query.gte('date', args.start_date);
      if (args.end_date) query = query.lte('date', args.end_date);

      const { data, error } = await query;
      if (error) return toolError(`Gagal menghitung ringkasan: ${error.message}`);

      let income = 0;
      let expense = 0;
      let piutang = 0;
      for (const t of data || []) {
        if (t.type === 'income') {
          income += getActualIncomeAmount(t);
          piutang += getPiutangAmount(t);
        } else {
          expense += t.amount;
        }
      }

      const summary = {
        period: { start_date: args.start_date || null, end_date: args.end_date || null },
        income,
        income_formatted: formatIDR(income),
        expense,
        expense_formatted: formatIDR(expense),
        net_profit: income - expense,
        net_profit_formatted: formatIDR(income - expense),
        outstanding_piutang: piutang,
        outstanding_piutang_formatted: formatIDR(piutang),
        transaction_count: data?.length || 0,
      };

      return toolText(JSON.stringify(summary, null, 2));
    }
  );

  server.registerTool(
    'list_categories',
    {
      title: 'Lihat Kategori',
      description: 'Mengambil daftar kategori pemasukan dan pengeluaran milik pengguna.',
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase
        .from('categories')
        .select('type, name')
        .order('created_at', { ascending: true });

      if (error) return toolError(`Gagal mengambil kategori: ${error.message}`);

      const income = (data || []).filter((c) => c.type === 'income').map((c) => c.name);
      const expense = (data || []).filter((c) => c.type === 'expense').map((c) => c.name);

      return toolText(JSON.stringify({ income, expense }, null, 2));
    }
  );

  server.registerTool(
    'add_category',
    {
      title: 'Tambah Kategori',
      description: 'Menambahkan kategori pemasukan atau pengeluaran baru.',
      inputSchema: z.object({ type: TransactionType, name: z.string().min(1) }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { error } = await supabase
        .from('categories')
        .insert({ type: args.type, name: args.name, user_id: session.userId });

      if (error) return toolError(`Gagal menambah kategori: ${error.message}`);

      return toolText(`Kategori "${args.name}" (${args.type}) berhasil ditambahkan.`);
    }
  );

  server.registerTool(
    'update_category',
    {
      title: 'Ubah Nama Kategori',
      description: 'Mengganti nama sebuah kategori yang sudah ada.',
      inputSchema: z.object({
        type: TransactionType,
        old_name: z.string().min(1),
        new_name: z.string().min(1),
      }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase
        .from('categories')
        .update({ name: args.new_name })
        .eq('type', args.type)
        .eq('name', args.old_name)
        .select()
        .maybeSingle();

      if (error) return toolError(`Gagal mengubah kategori: ${error.message}`);
      if (!data) return toolError(`Kategori "${args.old_name}" (${args.type}) tidak ditemukan.`);

      return toolText(`Kategori berhasil diubah dari "${args.old_name}" menjadi "${args.new_name}".`);
    }
  );

  server.registerTool(
    'delete_category',
    {
      title: 'Hapus Kategori',
      description: 'Menghapus sebuah kategori pemasukan/pengeluaran.',
      inputSchema: z.object({ type: TransactionType, name: z.string().min(1) }),
    },
    async (args, ctx) => {
      const session = getSession(ctx);
      if (!session) return toolError('Sesi tidak valid. Silakan hubungkan ulang connector KasUsaha.');

      const supabase = getScopedSupabaseClient(session.supabaseAccessToken);
      const { data, error } = await supabase
        .from('categories')
        .delete()
        .eq('type', args.type)
        .eq('name', args.name)
        .select()
        .maybeSingle();

      if (error) return toolError(`Gagal menghapus kategori: ${error.message}`);
      if (!data) return toolError(`Kategori "${args.name}" (${args.type}) tidak ditemukan.`);

      return toolText(`Kategori "${args.name}" (${args.type}) berhasil dihapus.`);
    }
  );
}
