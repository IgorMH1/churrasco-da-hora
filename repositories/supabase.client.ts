// repositories/supabase.client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_FALLBACK_CONFIG } from "../config/constants";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_CONFIG.URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  SUPABASE_FALLBACK_CONFIG.PUBLISHABLE_KEY;

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Returns a singleton instance of the Supabase client.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClientInstance;
}

/**
 * Safely reads and parses a JSON key from browser LocalStorage.
 */
export function readLocalStorageJson<T>(key: string, fallbackValue: T): T {
  if (typeof window === "undefined") return fallbackValue;
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallbackValue;
  } catch (error) {
    console.warn(`Failed to parse LocalStorage key "${key}":`, error);
    return fallbackValue;
  }
}

/**
 * Safely serializes and writes a value to browser LocalStorage.
 */
export function writeLocalStorageJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write LocalStorage key "${key}":`, error);
  }
}

/**
 * Safely removes a key from browser LocalStorage.
 */
export function removeLocalStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove LocalStorage key "${key}":`, error);
  }
}