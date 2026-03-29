// Tipos TypeScript que refletem o schema do Supabase

export interface PluggyItem {
  id: string;
  item_id: string;
  institution_name: string;
  status: string;
  created_at: string;
}

export interface Account {
  id: string;
  item_id: string;
  pluggy_account_id: string;
  name: string;
  type: string;
  balance: number;
  credit_limit: number;
  currency: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  pluggy_transaction_id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  type: string;
}

export interface CreditCard {
  id: string;
  account_id: string;
  name: string;
  last4: string;
  balance: number;
  credit_limit: number;
  available_limit: number;
  updated_at: string;
}

export interface Investment {
  id: string;
  item_id: string;
  pluggy_investment_id: string | null;
  name: string;
  type: string;
  balance: number;
  quantity: number;
  value: number;
  updated_at: string;
}

export interface Loan {
  id: string;
  item_id: string;
  pluggy_loan_id: string | null;
  institution_name: string;
  name: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  outstanding_balance: number;
  interest_rate: number;
  updated_at: string;
}

export interface InsightsCache {
  id: string;
  type: string;
  content: InsightsContent;
  generated_at: string;
}

export interface InsightsContent {
  resumo_geral: string;
  saude_financeira: { score: number; justificativa: string };
  alertas: Array<{ titulo: string; descricao: string; severidade: "alta" | "media" | "baixa" }>;
  oportunidades: Array<{ titulo: string; descricao: string }>;
  previsao_credito: Array<{ valor: number; probabilidade: number; justificativa: string }>;
  recomendacoes: string[];
  projecao_3meses: { saldo_projetado: number; tendencia: string; dados_mensais: Array<{ mes: string; valor: number }> };
}

export interface CreditScore {
  id: string;
  score: number;
  source: string;
  updated_at: string;
}
