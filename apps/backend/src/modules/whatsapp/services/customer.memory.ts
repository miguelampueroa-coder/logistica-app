import { getSupabaseAdmin } from '../../../config/database.js';
import { MemoryType } from '../types/index.js';

interface ResolvedAddress {
  address: string;
  lat: number;
  lng: number;
}

export class CustomerMemory {
  async resolveAlias(
    companyId: string,
    customerPhone: string,
    alias: string
  ): Promise<ResolvedAddress | undefined> {
    const supabase = getSupabaseAdmin();
    const lowerAlias = alias.toLowerCase().trim();

    const { data } = await supabase
      .from('company_memory')
      .select('value, usage_count')
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .eq('memory_type', 'alias')
      .eq('key', lowerAlias)
      .limit(1)
      .single();

    if (data && data.value && typeof data.value === 'object') {
      const val = data.value as { address?: string; lat?: number; lng?: number };
      if (val.address && val.lat && val.lng) {
        // Increment usage count
        await supabase
          .from('company_memory')
          .update({
            usage_count: (data.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)
          .eq('customer_phone', customerPhone)
          .eq('memory_type', 'alias')
          .eq('key', lowerAlias);

        return { address: val.address, lat: val.lat, lng: val.lng };
      }
    }

    return undefined;
  }

  async saveAlias(
    companyId: string,
    customerPhone: string,
    alias: string,
    address: string,
    lat: number,
    lng: number
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    const lowerAlias = alias.toLowerCase().trim();

    await supabase.from('company_memory').upsert(
      {
        company_id: companyId,
        customer_phone: customerPhone,
        memory_type: 'alias' as MemoryType,
        key: lowerAlias,
        value: { address, lat, lng },
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,customer_phone,memory_type,key' }
    );
  }

  async saveFrequentAddress(
    companyId: string,
    customerPhone: string,
    label: string,
    address: string,
    lat: number,
    lng: number
  ): Promise<void> {
    const supabase = getSupabaseAdmin();

    await supabase.from('company_memory').upsert(
      {
        company_id: companyId,
        customer_phone: customerPhone,
        memory_type: 'frequent_address' as MemoryType,
        key: label.toLowerCase().trim(),
        value: { label, address, lat, lng },
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,customer_phone,memory_type,key' }
    );
  }

  async saveFrequentRecipient(
    companyId: string,
    customerPhone: string,
    recipientName: string,
    recipientPhone: string,
    address?: string
  ): Promise<void> {
    const supabase = getSupabaseAdmin();

    await supabase.from('company_memory').upsert(
      {
        company_id: companyId,
        customer_phone: customerPhone,
        memory_type: 'frequent_recipient' as MemoryType,
        key: recipientName.toLowerCase().trim(),
        value: { name: recipientName, phone: recipientPhone, address },
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,customer_phone,memory_type,key' }
    );
  }

  async getMemory(
    companyId: string,
    customerPhone: string,
    memoryType?: MemoryType
  ): Promise<Array<{ key: string; value: unknown; usage_count: number }>> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('company_memory')
      .select('key, value, usage_count')
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .order('usage_count', { ascending: false });

    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }

    const { data } = await query;
    return data || [];
  }

  async deleteMemory(
    companyId: string,
    customerPhone: string,
    memoryType: MemoryType,
    key: string
  ): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('company_memory')
      .delete()
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .eq('memory_type', memoryType)
      .eq('key', key);

    return !error;
  }

  /**
   * Fuzzy alias resolution — tries exact match first, then prefix/suffix matching.
   * "mi casa" → tries "mi casa", then "casa" if not found.
   */
  async resolveAliasFuzzy(
    companyId: string,
    customerPhone: string,
    alias: string
  ): Promise<ResolvedAddress | undefined> {
    // Try exact match first
    const exact = await this.resolveAlias(companyId, customerPhone, alias);
    if (exact) return exact;

    // Try fuzzy: strip common prefixes like "mi ", "la ", "el ", "nuestro "
    const stripped = alias.toLowerCase().trim()
      .replace(/^(mi|la|el|nuestro|nuestra|los|las|mis)\s+/i, '');

    if (stripped !== alias.toLowerCase().trim()) {
      const fuzzy = await this.resolveAlias(companyId, customerPhone, stripped);
      if (fuzzy) return fuzzy;
    }

    // Try partial match — find any alias that contains the input
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('company_memory')
      .select('key, value, usage_count')
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .eq('memory_type', 'alias')
      .order('usage_count', { ascending: false })
      .limit(20);

    if (data) {
      for (const row of data) {
        if (row.key.includes(stripped) || stripped.includes(row.key)) {
          const val = row.value as { address?: string; lat?: number; lng?: number };
          if (val.address && val.lat && val.lng) {
            return { address: val.address, lat: val.lat, lng: val.lng };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Auto-save addresses from a confirmed order as aliases.
   * Uses short labels: origin becomes "origen1", destination becomes "destino1".
   */
  async autoSaveFromOrder(
    companyId: string,
    customerPhone: string,
    draft: {
      originAddress?: string;
      originLat?: number;
      originLng?: number;
      destAddress?: string;
      destLat?: number;
      destLng?: number;
    }
  ): Promise<void> {
    if (draft.originAddress && draft.originLat && draft.originLng) {
      // Check if this address already has an alias
      const existing = await this.findAliasByAddress(
        companyId, customerPhone, draft.originAddress
      );
      if (!existing) {
        const count = await this.countAliases(companyId, customerPhone);
        await this.saveAlias(
          companyId, customerPhone,
          `origen${count + 1}`,
          draft.originAddress, draft.originLat, draft.originLng
        );
      }
    }

    if (draft.destAddress && draft.destLat && draft.destLng) {
      const existing = await this.findAliasByAddress(
        companyId, customerPhone, draft.destAddress
      );
      if (!existing) {
        const count = await this.countAliases(companyId, customerPhone);
        await this.saveAlias(
          companyId, customerPhone,
          `destino${count + 1}`,
          draft.destAddress, draft.destLat, draft.destLng
        );
      }
    }
  }

  private async findAliasByAddress(
    companyId: string,
    customerPhone: string,
    address: string
  ): Promise<string | undefined> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('company_memory')
      .select('key, value')
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .eq('memory_type', 'alias')
      .order('usage_count', { ascending: false })
      .limit(50);

    if (data) {
      for (const row of data) {
        const val = row.value as { address?: string };
        if (val.address && this.addressesMatch(val.address, address)) {
          return row.key;
        }
      }
    }
    return undefined;
  }

  private addressesMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    return normalize(a) === normalize(b);
  }

  private async countAliases(companyId: string, customerPhone: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from('company_memory')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('customer_phone', customerPhone)
      .eq('memory_type', 'alias');
    return count || 0;
  }
}
