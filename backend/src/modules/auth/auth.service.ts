import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../config/db";
import { createError } from "../../middleware/errorHandler";
import { JwtPayload } from "../../types";

// ─── Token helpers ────────────────────────────────────────────────────────────

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  } as jwt.SignOptions);
}

function generateRefreshToken(): string {
  return uuidv4() + uuidv4(); // 72-char opaque token
}

async function saveRefreshToken(
  userId: string,
  token: string,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export const AuthService = {
  async register(email: string, username: string, password: string) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      if (existing.email === email) {
        throw createError("Email already in use", 409);
      }
      throw createError("Username already taken", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, displayName: true },
    });

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw createError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw createError("Invalid email or password", 401);

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken,
    };
  },

  async refresh(token: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored) throw createError("Invalid refresh token", 401);
    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token } });
      throw createError("Refresh token expired", 401);
    }

    const payload: JwtPayload = {
      userId: stored.user.id,
      email: stored.user.email,
    };
    const accessToken = generateAccessToken(payload);

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });
    const newRefreshToken = generateRefreshToken();
    await saveRefreshToken(stored.user.id, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(token: string) {
    await prisma.refreshToken
      .delete({ where: { token } })
      .catch(() => null); // ignore if already deleted
  },

  // ── OAuth ───────────────────────────────────────────────────────────────────
  // Called after verifying the OAuth token on the provider's side.
  // Creates user if first time, links OAuth account, returns tokens.
  async oauthLogin(
    provider: "google" | "apple",
    providerId: string,
    email: string,
    displayName?: string,
  ) {
    // Check if OAuth account already linked
    let oauthAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });

    let user = oauthAccount?.user;

    if (!user) {
      // Check if email already registered (link accounts)
      user = (await prisma.user.findUnique({ where: { email } })) ?? undefined;

      if (!user) {
        // New user — create account
        const username = email.split("@")[0] + "_" + uuidv4().slice(0, 6);
        user = await prisma.user.create({
          data: { email, username, displayName },
        });
      }

      // Link OAuth account to user
      await prisma.oAuthAccount.create({
        data: { provider, providerId, userId: user.id },
      });
    }

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken,
    };
  },
};
