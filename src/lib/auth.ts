import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Configuração do NextAuth — autenticação simples com senha fixa (app pessoal)
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Senha",
      credentials: {
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (credentials?.password === process.env.APP_PASSWORD) {
          return { id: "1", name: "Usuário", email: "user@financeos.app" };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
