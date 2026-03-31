// Mapeamento de categorias da Pluggy (inglês) para português brasileiro.
// Usado em todas as telas que exibem categorias de transações.

const CATEGORY_MAP: Record<string, string> = {
  // Alimentação
  "Food and drinks": "Alimentação",
  "Food and Beverage": "Alimentação",
  "Food": "Alimentação",
  "Food delivery": "Delivery de comida",
  "Restaurants": "Restaurantes",
  "Supermarket": "Supermercado",
  "Groceries": "Supermercado",
  "Grocery": "Mercado",

  // Transporte
  "Taxi and ride-hailing": "Transporte (app)",
  "Transport": "Transporte",
  "Transportation": "Transporte",
  "Fuel": "Combustível",
  "Parking": "Estacionamento",
  "Toll": "Pedágio",

  // Transferências
  "Same person transfer": "Transferência própria",
  "Transfer": "Transferência",
  "Transfers": "Transferências",
  "Transferências": "Transferências",
  "Transfer - PIX": "Pix enviado",
  "Transferência - PIX": "Pix enviado",

  // Saúde
  "Hospital clinics and labs": "Saúde",
  "Health": "Saúde",
  "Health and Fitness": "Saúde e Bem-estar",
  "Pharmacy": "Farmácia",

  // Digital / Serviços
  "Digital services": "Serviços digitais",
  "Subscription": "Assinatura",
  "Subscriptions": "Assinaturas",
  "Streaming": "Streaming",
  "Communication": "Comunicação",

  // Financeiro
  "Credit card payment": "Pagamento de cartão",
  "Investments": "Aporte / Aplicação",
  "Bank slip": "Boleto",
  "Loan": "Empréstimo",
  "Loans": "Empréstimos",
  "Loan Payment": "Pagamento de empréstimo",
  "Interest": "Juros",
  "Fees": "Taxas",
  "Bank Fees": "Taxas bancárias",
  "Financial Services": "Serviços Financeiros",

  // Casa
  "Home": "Casa",
  "Home Improvement": "Casa e Reformas",
  "Rent": "Aluguel",
  "Insurance": "Seguro",

  // Compras e lazer
  "Shopping": "Compras",
  "Entertainment": "Entretenimento",
  "Education": "Educação",
  "Travel": "Viagem",
  "Recreation": "Lazer",
  "Sports": "Esportes",
  "Clothing": "Vestuário",
  "Electronics": "Eletrônicos",
  "Gifts": "Presentes",
  "Donations": "Doações",
  "Personal Care": "Cuidados Pessoais",
  "Pets": "Pets",

  // Renda
  "Salary": "Salário",
  "Income": "Renda",
  "Rewards": "Recompensas",
  "Cashback": "Cashback",
  "Refund": "Reembolso",

  // Outros
  "Bills and Utilities": "Contas e Serviços",
  "Bills": "Contas",
  "Utilities": "Serviços",
  "Services": "Serviços",
  "Government": "Governo",
  "Taxes": "Impostos",
  "Tax": "Impostos",
  "ATM": "Saque",
  "Cash": "Dinheiro",
  "Deposit": "Depósito",
  "Withdrawal": "Saque",
  "Others": "Outros",
  "Other": "Outros",
  "Uncategorized": "Sem categoria",
};

// Tooltips explicativos para categorias que podem causar confusão
export const CATEGORY_TOOLTIPS: Record<string, string> = {
  "Aporte / Aplicação": "Valores enviados para aplicações financeiras (CDB, Tesouro, etc.)",
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
