// Mapa de domínios para logos via Clearbit e fallback de cores por hash.

export const bankDomains: Record<string, string> = {
  'nubank': 'nubank.com.br',
  'nu pagamentos': 'nubank.com.br',
  'nubank empresas': 'nubank.com.br',
  'banco inter': 'inter.co',
  'inter': 'inter.co',
  'caixa econômica federal': 'caixa.gov.br',
  'caixa': 'caixa.gov.br',
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
  'sicoob': 'sicoob.com.br',
  'sicredi': 'sicredi.com.br',
  'will bank': 'willbank.com.br',
  'pagbank': 'pagbank.com.br',
  'pagseguro': 'pagseguro.com.br',
  'stone': 'stone.com.br',
  'banco pan': 'bancopan.com.br',
  'realize': 'cartaorealize.com.br',
};

export function getBankLogoUrl(bankName: string): string | null {
  const key = bankName.toLowerCase();
  for (const [name, domain] of Object.entries(bankDomains)) {
    if (key.includes(name)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }
  return null;
}

const FALLBACK_COLORS = [
  '#820AD1', '#FF7A00', '#006CB7', '#E53935',
  '#00897B', '#F4511E', '#8E24AA', '#3949AB',
  '#00ACC1', '#43A047', '#FFB300', '#6D4C41',
];

export function getColorFromName(name: string): string {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
