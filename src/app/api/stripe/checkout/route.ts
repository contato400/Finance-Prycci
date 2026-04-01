import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Mock Stripe checkout — retorna URL de pagamento
// Quando tiver a chave Stripe, substituir pelo Stripe Checkout Session real
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const body = await request.json();
    const plan = body.plan as string;

    if (!plan || !["pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    // TODO: Quando tiver STRIPE_SECRET_KEY, criar Checkout Session real:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.checkout.sessions.create({
    //   mode: "subscription",
    //   customer_email: user.email,
    //   line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    //   success_url: `${origin}/perfil?upgrade=success`,
    //   cancel_url: `${origin}/pricing`,
    //   metadata: { userId, plan },
    // });
    // return NextResponse.json({ url: session.url });

    // Mock: retorna URL fictícia
    return NextResponse.json({
      url: null,
      mock: true,
      message: `Checkout Stripe para plano ${plan} será ativado quando STRIPE_SECRET_KEY estiver configurada.`,
      userId,
      plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
