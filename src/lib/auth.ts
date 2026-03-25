import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

async function ensureOAuthUser(email: string, name?: string | null, image?: string | null) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: name || existingUser.name,
        avatar: image || existingUser.avatar,
      },
    });

    return updatedUser;
  }

  const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 12);

  return prisma.user.create({
    data: {
      name: name || email.split("@")[0] || "CricGeek User",
      email,
      avatar: image || null,
      password: placeholderPassword,
      writerProfile: {
        create: {
          averageBQS: 0,
          totalBlogs: 0,
          totalViews: 0,
          archetype: "fan",
          level: 1,
          xp: 0,
        },
      },
      writerDNA: {
        create: {
          analyst: 25,
          fan: 25,
          storyteller: 25,
          debater: 25,
        },
      },
    },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      if (!user.email) {
        return false;
      }

      const appUser = await ensureOAuthUser(user.email, user.name, user.image);
      const appAuthUser = user as typeof user & { id: string; role: string };
      appAuthUser.id = appUser.id;
      appAuthUser.role = appUser.role;
      user.name = appUser.name;
      user.email = appUser.email;
      user.image = appUser.avatar || user.image;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      } else if ((!token.id || !token.role) && token.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, name: true, avatar: true },
        });

        if (existingUser) {
          token.id = existingUser.id;
          token.role = existingUser.role;
          token.name = existingUser.name;
          token.picture = existingUser.avatar || token.picture;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { role: string }).role = token.role as string;
        (session.user as unknown as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
});
