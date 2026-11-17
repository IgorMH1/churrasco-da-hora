// Regra RN-01: Mapa Oficial dos 67 DDDs válidos pela ANATEL e Máscara Dinâmica

export const ANATEL_VALID_DDDS: Record<number, string> = {
  11: 'SP - São Paulo', 12: 'SP - Vale do Paraíba', 13: 'SP - Baixada Santista', 14: 'SP - Bauru',
  15: 'SP - Sorocaba', 16: 'SP - Ribeirão Preto', 17: 'SP - S. J. Rio Preto', 18: 'SP - Pres. Prudente',
  19: 'SP - Campinas', 21: 'RJ - Rio de Janeiro', 22: 'RJ - Campos/Cabo Frio', 24: 'RJ - Volta Redonda',
  27: 'ES - Vitória', 28: 'ES - Cachoeiro', 31: 'MG - Belo Horizonte', 32: 'MG - Juiz de Fora',
  33: 'MG - Gov. Valadares', 34: 'MG - Uberlândia', 35: 'MG - Poços de Caldas', 37: 'MG - Divinópolis',
  38: 'MG - Montes Claros', 41: 'PR - Curitiba', 42: 'PR - Ponta Grossa', 43: 'PR - Londrina',
  44: 'PR - Maringá', 45: 'PR - Foz do Iguaçu', 46: 'PR - Francisco Beltrão', 47: 'SC - Joinville',
  48: 'SC - Florianópolis', 49: 'SC - Chapecó', 51: 'RS - Porto Alegre', 53: 'RS - Pelotas',
  54: 'RS - Caxias do Sul', 55: 'RS - Santa Maria', 61: 'DF - Brasília', 62: 'GO - Goiânia',
  63: 'TO - Palmas', 64: 'GO - Rio Verde', 65: 'MT - Cuiabá', 66: 'MT - Rondonópolis',
  67: 'MS - Campo Grande', 68: 'AC - Rio Branco', 69: 'RO - Porto Velho', 71: 'BA - Salvador',
  73: 'BA - Ilhéus', 74: 'BA - Juazeiro', 75: 'BA - Feira de Santana', 77: 'BA - Vitória da Conquista',
  79: 'SE - Aracaju', 81: 'PE - Recife', 82: 'AL - Maceió', 83: 'PB - João Pessoa',
  84: 'RN - Natal', 85: 'CE - Fortaleza', 86: 'PI - Teresina', 87: 'PE - Petrolina',
  88: 'CE - Juazeiro do Norte', 89: 'PI - Picos', 91: 'PA - Belém', 92: 'AM - Manaus',
  93: 'PA - Santarém', 94: 'PA - Marabá', 95: 'RR - Boa Vista', 96: 'AP - Macapá',
  97: 'AM - Interior', 98: 'MA - São Luís', 99: 'MA - Imperatriz'
};

// Função que coloca os parênteses e o traço automaticamente enquanto a pessoa digita
export function applyAnatelPhoneMask(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Função que verifica se o DDD existe na ANATEL e se o número segue a regra de celular ou fixo
export function validateAnatelPhone(rawInput: string): {
  valid: boolean;
  error?: string;
  regionUf?: string;
  formatted?: string;
} {
  const digits = rawInput.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) {
    return { valid: false, error: 'Digite os 2 números do DDD + 8 dígitos (fixo) ou 9 dígitos (celular).' };
  }

  const ddd = parseInt(digits.slice(0, 2), 10);
  const regionUf = ANATEL_VALID_DDDS[ddd];
  if (!regionUf) {
    return { valid: false, error: `O DDD (${ddd}) não existe segundo a tabela oficial da ANATEL.` };
  }

  const localNumber = digits.slice(2);
  if (digits.length === 11) {
    if (!/^9[1-9]\d{7}$/.test(localNumber)) {
      return { valid: false, error: 'Celular inválido. Pela regra da ANATEL, todo celular deve começar com 9.' };
    }
  } else {
    if (!/^[2-5]\d{7}$/.test(localNumber)) {
      return { valid: false, error: 'Telefone fixo inválido. Números fixos devem começar entre 2 e 5.' };
    }
  }

  return {
    valid: true,
    regionUf,
    formatted: applyAnatelPhoneMask(digits)
  };
}