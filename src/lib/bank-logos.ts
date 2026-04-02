// Mapa de domínios para logos de bancos.
// Usa Google Favicons API (gratuita, confiável) como fonte primária.
// Clearbit foi descontinuado e retorna 403.

export const bankDomains: Record<string, string> = {
  // Ordem importa: mais específico primeiro
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
      // Google Favicons API — gratuita, funciona sempre, retorna PNG
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }
  return null;
}

// Cores geradas 100% por hash do nome — funciona para QUALQUER banco.
const PALETTE = [
  '#820AD1', '#FF7A00', '#006CB7', '#E53935',
  '#00897B', '#F4511E', '#8E24AA', '#3949AB',
  '#00ACC1', '#43A047', '#FFB300', '#6D4C41',
  '#5C6BC0', '#D81B60', '#00838F', '#558B2F',
];

export function getColorFromName(name: string): string {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return PALETTE[hash % PALETTE.length];
}

// Gera gradiente a partir da cor base (20% mais escuro no final)
export function getGradientFromName(name: string): { from: string; to: string } {
  const hex = getColorFromName(name);
  return { from: hex, to: darken(hex, 0.2) };
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
