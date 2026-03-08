import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest } from "../../types";

// ─── Validators ───────────────────────────────────────────────────────────────

export const registerValidators = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("username")
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username must be 3–30 chars, letters/numbers/underscores only"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

export const loginValidators = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction) {
    if (handleValidationErrors(req, res)) return;
    try {
      const { email, username, password } = req.body;
      const result = await AuthService.register(email, username, password);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    if (handleValidationErrors(req, res)) return;
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, error: "Refresh token required" });
        return;
      }
      const result = await AuthService.refresh(refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) await AuthService.logout(refreshToken);
      res.json({ success: true, message: "Logged out" });
    } catch (err) {
      next(err);
    }
  },

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: req.user });
    } catch (err) {
      next(err);
    }
  },

  // ── OAuth ───────────────────────────────────────────────────────────────────
  // The mobile app verifies the OAuth token with Google/Apple directly,
  // then sends us the verified user info. We trust it and issue our own tokens.
  async oauthLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider, providerId, email, displayName } = req.body;

      if (!["google", "apple"].includes(provider)) {
        res.status(400).json({ success: false, error: "Invalid provider" });
        return;
      }
      if (!providerId || !email) {
        res.status(400).json({ success: false, error: "providerId and email required" });
        return;
      }

      const result = await AuthService.oauthLogin(
        provider,
        providerId,
        email,
        displayName,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
