// Mapeamento de nomes de conectores da Pluggy para nomes reais de instituições.
// O conector "MeuPluggy" (sandbox) e outros nomes genéricos são mapeados aqui.

const INSTITUTION_MAP: Record<string, string> = {
  // Sandbox — inferir do nome da conta no sync, fallback genérico
  "MeuPluggy": "MeuPluggy",

  // Nomes de conectores Pluggy → nomes de exibição amigáveis
  "Nu Pagamentos S.A.": "Nubank",
  "Nu Pagamentos": "Nubank",
  "Nu Pagamentos S.A. - Instituição de Pagamento": "Nubank",
  "Nu Invest": "Nubank Investimentos",
  "Nubank": "Nubank",
  "Banco Inter S.A.": "Banco Inter",
  "Banco Inter": "Banco Inter",
  "Inter": "Banco Inter",
  "Itaú Unibanco S.A.": "Itaú",
  "Itaú Unibanco": "Itaú",
  "Itaú": "Itaú",
  "Banco Bradesco S.A.": "Bradesco",
  "Bradesco": "Bradesco",
  "Banco Santander (Brasil) S.A.": "Santander",
  "Santander": "Santander",
  "Banco do Brasil S.A.": "Banco do Brasil",
  "Banco do Brasil": "Banco do Brasil",
  "Caixa Econômica Federal": "Caixa Econômica Federal",
  "Caixa": "Caixa Econômica Federal",
  "C6 Bank": "C6 Bank",
  "Banco C6 S.A.": "C6 Bank",
  "BTG Pactual": "BTG Pactual",
  "Banco BTG Pactual S.A.": "BTG Pactual",
  "XP Investimentos": "XP",
  "XP": "XP",
  "Rico Investimentos": "Rico",
  "Clear Corretora": "Clear",
  "Banco Original": "Banco Original",
  "Banco Pan S.A.": "Banco Pan",
  "Banco Pan": "Banco Pan",
  "Neon": "Neon",
  "PagBank": "PagBank",
  "PicPay": "PicPay",
  "Mercado Pago": "Mercado Pago",
  "Sicoob": "Sicoob",
  "Sicredi": "Sicredi",
  "Banrisul": "Banrisul",
  "Safra": "Banco Safra",
  "Banco Safra S.A.": "Banco Safra",
  "Modal": "Banco Modal",
  "Banco Modal": "Banco Modal",
  "Daycoval": "Banco Daycoval",
  "Banco Daycoval": "Banco Daycoval",
};

// Traduz nome do conector Pluggy para nome de exibição amigável.
// Se não encontrar no mapa, retorna o nome original.
export function translateInstitution(name: string | null | undefined): string {
  if (!name) return "Desconhecido";
  return INSTITUTION_MAP[name] || name;
}
