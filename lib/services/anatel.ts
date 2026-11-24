// lib/services/anatel.ts

export const ANATEL_DDD_TO_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF/GO", "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

export interface AnatelValidationResult {
  valid: boolean;
  formatted?: string;
  ddd?: string;
  regionUf?: string;
  type?: "MOVEL" | "FIXO";
  error?: string;
}

/**
 * Formats a raw phone string into the Brazilian ANATEL mask: (DD) 9XXXX-XXXX or (DD) XXXX-XXXX.
 */
export function formatAnatelPhone(rawInput: string): string {
  const digits = (rawInput || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Retrocompatibility alias
export const maskAnatelPhone = formatAnatelPhone;

/**
 * Validates a Brazilian phone number against the 67 official ANATEL area codes (DDDs).
 */
export function validateAnatelPhone(rawInput: string): AnatelValidationResult {
  const digits = (rawInput || "").replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 11) {
    return {
      valid: false,
      error: "O telefone deve conter DDD (2 dígitos) + 8 ou 9 dígitos numéricos.",
    };
  }

  const ddd = digits.slice(0, 2);
  const regionUf = ANATEL_DDD_TO_UF[ddd];

  if (!regionUf) {
    return {
      valid: false,
      error: `O DDD (${ddd}) não pertence aos 67 códigos nacionais homologados pela ANATEL.`,
    };
  }

  const subscriberNumber = digits.slice(2);

  if (digits.length === 11) {
    if (!subscriberNumber.startsWith("9")) {
      return {
        valid: false,
        error: "Telemóveis de 11 dígitos devem iniciar obrigatoriamente pelo nono dígito (9).",
      };
    }
    return {
      valid: true,
      formatted: formatAnatelPhone(digits),
      ddd,
      regionUf,
      type: "MOVEL",
    };
  }

  const firstFixedDigit = subscriberNumber[0];
  if (!["2", "3", "4", "5"].includes(firstFixedDigit)) {
    return {
      valid: false,
      error: "Telefones fixos de 10 dígitos devem iniciar com 2, 3, 4 ou 5 após o DDD.",
    };
  }

  return {
    valid: true,
    formatted: formatAnatelPhone(digits),
    ddd,
    regionUf,
    type: "FIXO",
  };
}