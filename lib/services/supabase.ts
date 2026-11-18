// lib/services/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fgyaeefzpaxivrekyhhq.supabase.co"
).trim();

const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_2PQxwv1WGsznqEQ8bD3eNA_E36YbO_T"
).trim();

export const supabase = createClient(supabaseUrl, supabaseKey);