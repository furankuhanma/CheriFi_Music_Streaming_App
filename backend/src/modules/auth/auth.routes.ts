import { Router } from "express";
import { AuthController, registerValidators, loginValidators } from "./auth.controller";
import { requireAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

const router = Router();

// Public
router.post("/register", registerValidators, AuthController.register);
router.post("/login", loginValidators, AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.post("/oauth", AuthController.oauthLogin);

// Protected
router.get("/me", requireAuth as any, (req, res, next) =>
  AuthController.me(req as AuthenticatedRequest, res, next),
);

export default router;
