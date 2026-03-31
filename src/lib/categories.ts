// Mapeamento de categorias da Pluggy (inglês) para português brasileiro.
// Usado em todas as telas que exibem categorias de transações.

const CATEGORY_MAP: Record<string, string> = {
  "Credit card payment": "Pagamento de cartão",
  "Transfers": "Transferências",
  "Transfer": "Transferência",
  "Transfer - PIX": "Transferência - PIX",
  "Food and Beverage": "Alimentação",
  "Food": "Alimentação",
  "Shopping": "Compras",
  "Entertainment": "Entretenimento",
  "Health": "Saúde",
  "Health and Fitness": "Saúde e Bem-estar",
  "Transport": "Transporte",
  "Transportation": "Transporte",
  "Education": "Educação",
  "Bills and Utilities": "Contas e Serviços",
  "Bills": "Contas",
  "Utilities": "Serviços",
  "Others": "Outros",
  "Other": "Outros",
  "Uncategorized": "Sem categoria",
  "Travel": "Viagens",
  "Subscriptions": "Assinaturas",
  "Personal Care": "Cuidados Pessoais",
  "Pets": "Pets",
  "Home": "Casa",
  "Home Improvement": "Casa e Reformas",
  "Insurance": "Seguros",
  "Taxes": "Impostos",
  "Tax": "Impostos",
  "Investments": "Investimentos",
  "Salary": "Salário",
  "Income": "Renda",
  "Loans": "Empréstimos",
  "Loan Payment": "Pagamento de empréstimo",
  "Rent": "Aluguel",
  "Groceries": "Supermercado",
  "Restaurants": "Restaurantes",
  "Clothing": "Vestuário",
  "Electronics": "Eletrônicos",
  "Gifts": "Presentes",
  "Donations": "Doações",
  "Fees": "Taxas",
  "Bank Fees": "Taxas bancárias",
  "ATM": "Saque",
  "Cash": "Dinheiro",
  "Deposit": "Depósito",
  "Withdrawal": "Saque",
  "Interest": "Juros",
  "Rewards": "Recompensas",
  "Cashback": "Cashback",
  "Refund": "Reembolso",
  "Government": "Governo",
  "Services": "Serviços",
  "Financial Services": "Serviços Financeiros",
  "Communication": "Comunicação",
  "Recreation": "Lazer",
  "Sports": "Esportes",
  "Food and drinks": "Alimentação",
  "Food delivery": "Delivery",
  "Taxi and ride-hailing": "Transporte (app)",
  "Same person transfer": "Transferência própria",
  "Digital services": "Serviços digitais",
  "Hospital clinics and labs": "Saúde",
  "Supermarket": "Supermercado",
};

// Traduz uma categoria para pt-BR. Se não encontrar no mapa, retorna original.
export function translateCategory(category: string | null | undefined): string {
  if (!category) return "Sem categoria";
  return CATEGORY_MAP[category] || category;
}

// Traduz um array de dados de categoria (usado nos gráficos)
export function translateCategoryData<T extends { category: string }>(data: T[]): T[] {
  return data.map((item) => ({
    ...item,
    category: translateCategory(item.category),
  }));
}
