// Mapa de domínios para logos de bancos.
// Usa Google Favicons API (gratuita, confiável) como fonte primária.

export const bankDomains: Record<string, string> = {
  'caixa econômica federal': 'caixa.gov.br',
  'caixa': 'caixa.gov.br',
  'banco inter': 'inter.co',
  'inter': 'inter.co',
  'nubank': 'nubank.com.br',
  'nu pagamentos': 'nubank.com.br',
  'bradesco': 'bradesco.com.br',
  'itaú': 'itau.com.br',
  'itau': 'itau.com.br',
  'santander': 'santander.com.br',
  'banco do brasil': 'bb.com.br',
  'bb': 'bb.com.br',
  'xp': 'xp.com.br',
  'c6 bank': 'c6bank.com.br',
  'c6': 'c6bank.com.br',
  'picpay': 'picpay.com',
  'mercado pago': 'mercadopago.com.br',
  'neon': 'neon.com.br',
  'next': 'next.me',
  'original': 'original.com.br',
  'safra': 'safra.com.br',
  'btg pactual': 'btgpactual.com',
  'btg': 'btgpactual.com',
  'sicoob': 'sicoob.com.br',
  'sicredi': 'sicredi.com.br',
  'will bank': 'willbank.com.br',
  'pagbank': 'pagbank.com.br',
  'pagseguro': 'pagseguro.com.br',
  'stone': 'stone.com.br',
  'banco pan': 'bancopan.com.br',
  'pan': 'bancopan.com.br',
  'realize': 'cartaorealize.com.br',
  'modal': 'modalmais.com.br',
  'daycoval': 'daycoval.com.br',
  'banrisul': 'banrisul.com.br',
  'rico': 'rico.com.vc',
  'clear': 'clear.com.br',
};

export function getBankLogoUrl(bankName: string): string | null {
  const key = bankName.toLowerCase();
  for (const [name, domain] of Object.entries(bankDomains)) {
    if (key.includes(name)) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }
  return null;
}

// Cores reais dos bancos brasileiros — case-insensitive, contains match
// Ordem: mais específico primeiro para evitar matches parciais
const BANK_COLORS: Array<{ match: string; color: string }> = [
  { match: 'nubank empresas', color: '#6A0DAD' },
  { match: 'nubank', color: '#8A05BE' },
  { match: 'nu pagamentos', color: '#8A05BE' },
  { match: 'banco inter', color: '#FF6B00' },
  { match: 'inter', color: '#FF6B00' },
  { match: 'caixa econômica', color: '#005CA9' },
  { match: 'caixa', color: '#005CA9' },
  { match: 'bradesco', color: '#CC0000' },
  { match: 'itaú', color: '#EC7000' },
  { match: 'itau', color: '#EC7000' },
  { match: 'santander', color: '#EC0000' },
  { match: 'banco do brasil', color: '#F9BB00' },
  { match: 'bb', color: '#F9BB00' },
  { match: 'btg pactual', color: '#1A1A1A' },
  { match: 'btg', color: '#1A1A1A' },
  { match: 'c6 bank', color: '#000000' },
  { match: 'c6', color: '#000000' },
  { match: 'sicoob', color: '#006937' },
  { match: 'sicredi', color: '#4CAF50' },
  { match: 'picpay', color: '#21C25E' },
  { match: 'mercado pago', color: '#009EE3' },
  { match: 'next', color: '#00CF72' },
  { match: 'neon', color: '#1FD8C1' },
  { match: 'original', color: '#007A4D' },
  { match: 'banco pan', color: '#034EA2' },
  { match: 'pan', color: '#034EA2' },
  { match: 'safra', color: '#003087' },
  { match: 'modal', color: '#0066CC' },
  { match: 'xp', color: '#1E1E1E' },
  { match: 'will bank', color: '#FFD600' },
  { match: 'pagbank', color: '#00A868' },
  { match: 'pagseguro', color: '#00A868' },
  { match: 'stone', color: '#00A868' },
  { match: 'banrisul', color: '#004B87' },
  { match: 'daycoval', color: '#003366' },
];

// Fallback hash palette para bancos não mapeados
const HASH_PALETTE = [
  '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  '#8B5CF6', '#06B6D4', '#EF4444', '#84CC16',
  '#D946EF', '#0EA5E9', '#F59E0B', '#10B981',
];

// Retorna a cor real do banco (prioridade) ou hash como fallback
export function getColorFromName(name: string): string {
  const lower = name.toLowerCase();
  for (const { match, color } of BANK_COLORS) {
    if (lower.includes(match)) return color;
  }
  // Fallback: hash do nome
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return HASH_PALETTE[hash % HASH_PALETTE.length];
}

// Gera gradiente: cor do banco → 25% mais escuro
export function getGradientFromName(name: string): { from: string; to: string } {
  const hex = getColorFromName(name);
  return { from: hex, to: darken(hex, 0.25) };
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
