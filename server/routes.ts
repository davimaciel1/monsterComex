import type { Express, Request, Response } from "express";
import type { User, Company, UserPlan, UserEntitlement } from "@shared/schema";
import type { SessionResponse } from "@shared/auth";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { upload } from "./upload";
import { enqueueJob } from "./etl";
import { hashPassword, verifyPassword } from "./auth";
import { calculatePlanQuote } from "@shared/pricing";
import {
  getSampleCompanyById,
  getSampleNcmByCode,
  searchSampleCompanies,
  searchSampleNcms,
} from "@shared/sample-data";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

type UsageCounts = Record<'importer' | 'exporter' | 'ncm', number>;

interface EntitlementContext {
  plan: UserPlan | null;
  entitlements: UserEntitlement[];
  usage: UsageCounts;
}

const AUTH_REQUIRED_MESSAGE = "Faça login para acessar essa funcionalidade.";
const PLAN_REQUIRED_MESSAGE = "Você ainda não contratou um plano para esse tipo de consulta. Acesse a página de planos para continuar.";
const PLAN_LIMIT_MESSAGE = "Você atingiu o limite de consultas do seu plano para esse tipo. Amplie sua franquia para seguir consultando.";

function normalizeKind(kind: string | null | undefined): 'importer' | 'exporter' | 'ncm' | null {
  if (!kind) return null;
  const value = kind.toLowerCase();
  if (value === 'importer' || value === 'exporter' || value === 'ncm') {
    return value;
  }
  return null;
}

function computeUsage(entitlements: UserEntitlement[]): UsageCounts {
  const usage: UsageCounts = { importer: 0, exporter: 0, ncm: 0 };

  for (const entitlement of entitlements) {
    const kind = normalizeKind(entitlement.targetKind);
    if (kind) {
      usage[kind] += 1;
    }
  }

  return usage;
}

async function getEntitlementContext(userId: number): Promise<EntitlementContext> {
  const user = await storage.getUserById(userId);
  
  if (user?.isAdmin) {
    return {
      plan: {
        id: -1,
        userId,
        importerQuota: 999999,
        exporterQuota: 999999,
        ncmQuota: 999999,
        billingCycle: 'monthly',
        monthlyPrice: '0',
        annualPrice: '0',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      entitlements: [],
      usage: { importer: 0, exporter: 0, ncm: 0 },
    };
  }

  const [plan, entitlements] = await Promise.all([
    storage.getActivePlanByUserId(userId),
    storage.listEntitlementsByUser(userId),
  ]);

  return {
    plan,
    entitlements,
    usage: computeUsage(entitlements),
  };
}

function numberFromNumeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function summarizePlan(plan: UserPlan | null): SessionResponse["plan"] {
  if (!plan) {
    return null;
  }

  const billingCycle = plan.billingCycle === 'annual' ? 'annual' : 'monthly';

  return {
    id: plan.id,
    importerQuota: plan.importerQuota,
    exporterQuota: plan.exporterQuota,
    ncmQuota: plan.ncmQuota,
    billingCycle,
    monthlyPrice: numberFromNumeric(plan.monthlyPrice),
    annualPrice: numberFromNumeric(plan.annualPrice),
    status: plan.status,
  };
}

async function buildSessionResponse(userId: number): Promise<SessionResponse> {
  const user = await storage.getUserById(userId);
  if (!user) {
    throw new Error("Usuário não encontrado para a sessão ativa");
  }

  const context = await getEntitlementContext(userId);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    plan: summarizePlan(context.plan),
    usage: {
      importerUsed: context.usage.importer,
      exporterUsed: context.usage.exporter,
      ncmUsed: context.usage.ncm,
    },
  };
}

async function ensureAuthenticated(
  req: Request,
  res: Response,
  options: { loadContext?: boolean } = {},
): Promise<{ user: User; context?: EntitlementContext } | null> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
    return null;
  }

  const user = await storage.getUserById(userId);
  if (!user) {
    if (req.session) {
      req.session.userId = undefined;
    }
    res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
    return null;
  }

  if (options.loadContext) {
    const context = await getEntitlementContext(user.id);
    return { user, context };
  }

  return { user };
}

function quotaForKind(plan: UserPlan | null, kind: 'importer' | 'exporter' | 'ncm'): number {
  if (!plan) return 0;
  if (kind === 'importer') return plan.importerQuota;
  if (kind === 'exporter') return plan.exporterQuota;
  return plan.ncmQuota;
}

async function ensureCompanyAccess(
  userId: number,
  companyId: number,
  existingContext?: EntitlementContext,
): Promise<{ company?: Company; context: EntitlementContext; error?: { status: number; message: string } }> {
  const company = await storage.getCompanyById(companyId);
  if (!company) {
    const context = existingContext ?? await getEntitlementContext(userId);
    return { context, error: { status: 404, message: "Empresa não encontrada." } };
  }

  const context = existingContext ?? await getEntitlementContext(userId);
  
  const user = await storage.getUserById(userId);
  if (user?.isAdmin) {
    return { company, context };
  }

  const entitlement = context.entitlements.find((entry) => entry.companyId === companyId);

  const kind: 'importer' | 'exporter' = company.kind === 'importer' ? 'importer' : 'exporter';

  if (entitlement) {
    return { company, context };
  }

  const quota = quotaForKind(context.plan, kind);
  if (!context.plan || quota <= context.usage[kind]) {
    return {
      context,
      error: {
        status: 403,
        message: context.plan ? PLAN_LIMIT_MESSAGE : PLAN_REQUIRED_MESSAGE,
      },
    };
  }

  const granted = await storage.grantCompanyEntitlement(userId, companyId, kind, company.name);
  context.entitlements.push(granted);
  context.usage[kind] += 1;

  return { company, context };
}

async function ensureNcmAccess(
  userId: number,
  code: string,
  label: string | null,
  existingContext?: EntitlementContext,
): Promise<{ context: EntitlementContext; error?: { status: number; message: string } }> {
  const normalizedCode = code.trim();
  const context = existingContext ?? await getEntitlementContext(userId);
  
  const user = await storage.getUserById(userId);
  if (user?.isAdmin) {
    return { context };
  }

  const entitlement = context.entitlements.find((entry) => entry.ncmCode === normalizedCode);

  if (entitlement) {
    return { context };
  }

  const quota = quotaForKind(context.plan, 'ncm');
  if (!context.plan || quota <= context.usage.ncm) {
    return {
      context,
      error: {
        status: 403,
        message: context.plan ? PLAN_LIMIT_MESSAGE : PLAN_REQUIRED_MESSAGE,
      },
    };
  }

  const granted = await storage.grantNcmEntitlement(userId, normalizedCode, label || normalizedCode);
  context.entitlements.push(granted);
  context.usage.ncm += 1;

  return { context };
}

function regenerateSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const registerSchema = z.object({
    name: z.string().min(2, "Informe seu nome"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const planSchema = z.object({
    importerQuota: z.number().int().min(0).max(500),
    exporterQuota: z.number().int().min(0).max(500),
    ncmQuota: z.number().int().min(0).max(500),
    billingCycle: z.enum(['monthly', 'annual']),
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const payload = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(payload.email);

      if (existing) {
        return res.status(409).json({ message: "Já existe uma conta com este e-mail." });
      }

      const passwordHash = hashPassword(payload.password);
      const user = await storage.createUser({
        name: payload.name,
        email: payload.email.toLowerCase(),
        passwordHash,
      });

      await regenerateSession(req, user.id);
      const session = await buildSessionResponse(user.id);

      res.status(201).json(session);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }

      res.status(500).json({ message: error.message || "Não foi possível criar a conta." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const payload = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(payload.email);

      if (!user || !verifyPassword(payload.password, user.passwordHash)) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      await regenerateSession(req, user.id);
      const session = await buildSessionResponse(user.id);

      res.json(session);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos." });
      }

      res.status(500).json({ message: error.message || "Não foi possível realizar o login." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(204).end();
    }

    try {
      await destroySession(req);
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível encerrar a sessão." });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      const session = await buildSessionResponse(userId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar a sessão." });
    }
  });

  app.post("/api/plans/quote", async (req, res) => {
    const auth = await ensureAuthenticated(req, res, { loadContext: false });
    if (!auth) return;

    try {
      const payload = planSchema.parse(req.body);
      const quote = calculatePlanQuote({
        importerSlots: payload.importerQuota,
        exporterSlots: payload.exporterQuota,
        ncmSlots: payload.ncmQuota,
      });

      res.json({
        selection: payload,
        quote: {
          totalUnits: quote.totalUnits,
          unitPrice: quote.unitPrice,
          monthlyTotal: quote.monthlyTotal,
          annualTotal: quote.annualTotal,
          discountPercentage: quote.discountPercentage,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Seleção de plano inválida." });
      }

      res.status(500).json({ message: error.message || "Não foi possível calcular o plano." });
    }
  });

  app.post("/api/plans/subscribe", async (req, res) => {
    const auth = await ensureAuthenticated(req, res, { loadContext: false });
    if (!auth) return;

    try {
      const payload = planSchema.parse(req.body);
      const totalUnits = payload.importerQuota + payload.exporterQuota + payload.ncmQuota;
      if (totalUnits <= 0) {
        return res.status(400).json({ message: "Selecione ao menos uma unidade de consulta." });
      }

      const quote = calculatePlanQuote({
        importerSlots: payload.importerQuota,
        exporterSlots: payload.exporterQuota,
        ncmSlots: payload.ncmQuota,
      });

      await storage.setActivePlan(auth.user.id, {
        importerQuota: payload.importerQuota,
        exporterQuota: payload.exporterQuota,
        ncmQuota: payload.ncmQuota,
        billingCycle: payload.billingCycle,
        monthlyPrice: quote.monthlyTotal,
        annualPrice: quote.annualTotal,
      });

      const session = await buildSessionResponse(auth.user.id);
      res.status(201).json(session);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Seleção de plano inválida." });
      }

      res.status(500).json({ message: error.message || "Não foi possível contratar o plano." });
    }
  });

  app.get("/api/companies/search", async (req, res) => {
    try {
      const query = String(req.query.q || "");
      const limit = parseInt(String(req.query.limit || "10"), 10);

      if (!req.session?.userId) {
        const sampleResults = searchSampleCompanies(query, Number.isNaN(limit) ? 10 : limit).map((company) => ({
          company: {
            id: company.id,
            name: company.name,
            kind: company.kind,
            countryCode: company.countryCode,
          },
          score: company.score,
          allowed: true,
          reason: undefined,
          remainingSlots: 0,
        }));

        return res.json({
          results: sampleResults,
          summary: {
            plan: null,
            usage: { importer: 0, exporter: 0, ncm: 0 },
            remaining: { importer: 0, exporter: 0 },
          },
          mode: "guest",
        });
      }

      const auth = await ensureAuthenticated(req, res, { loadContext: true });
      if (!auth || !auth.context) return;
      const context = auth.context;

      if (!query.trim()) {
        return res.json({
          results: [],
          summary: {
            plan: summarizePlan(context.plan),
            usage: context.usage,
            remaining: {
              importer: Math.max(quotaForKind(context.plan, 'importer') - context.usage.importer, 0),
              exporter: Math.max(quotaForKind(context.plan, 'exporter') - context.usage.exporter, 0),
            },
          },
        });
      }

      const results = await storage.searchCompanies(query, Number.isNaN(limit) ? 10 : limit);
      const entitlementCompanyIds = new Set(
        context.entitlements
          .filter((entry) => entry.companyId != null)
          .map((entry) => entry.companyId as number),
      );

      const mapped = results.map(({ company, score }) => {
        const kind: 'importer' | 'exporter' = company.kind === 'importer' ? 'importer' : 'exporter';
        const hasEntitlement = entitlementCompanyIds.has(company.id);
        const quota = quotaForKind(context.plan, kind);
        const remaining = Math.max(quota - context.usage[kind], 0);
        const allowed = hasEntitlement || (context.plan ? remaining > 0 : false);

        return {
          company,
          score,
          allowed,
          reason: allowed ? undefined : (context.plan ? PLAN_LIMIT_MESSAGE : PLAN_REQUIRED_MESSAGE),
          remainingSlots: remaining,
        };
      });

      res.json({
        results: mapped,
        summary: {
          plan: summarizePlan(context.plan),
          usage: context.usage,
          remaining: {
            importer: Math.max(quotaForKind(context.plan, 'importer') - context.usage.importer, 0),
            exporter: Math.max(quotaForKind(context.plan, 'exporter') - context.usage.exporter, 0),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Erro ao buscar empresas." });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json({
        id: sample.id,
        name: sample.name,
        kind: sample.kind,
        countryCode: sample.countryCode,
      });
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error || !access.company) {
        return res.status(access.error?.status ?? 500).json({ message: access.error?.message || "Falha ao consultar a empresa." });
      }

      res.json(access.company);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar a empresa." });
    }
  });

  app.get("/api/companies/:id/stats", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.metrics);
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const stats = await storage.getCompanyStats(companyId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os indicadores." });
    }
  });

  app.get("/api/companies/:id/shipments-over-time", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.shipmentsOverTime);
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const data = await storage.getCompanyShipmentsOverTime(companyId);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar o histórico." });
    }
  });

  app.get("/api/companies/:id/top-partners", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    const limit = Number.parseInt(String(req.query.limit ?? "5"), 10);

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.topPartners.slice(0, Number.isNaN(limit) ? 5 : limit));
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const data = await storage.getTopPartners(companyId, Number.isNaN(limit) ? 5 : limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os parceiros." });
    }
  });

  app.get("/api/companies/:id/top-origin-countries", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    const limit = Number.parseInt(String(req.query.limit ?? "5"), 10);

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.topOriginCountries.slice(0, Number.isNaN(limit) ? 5 : limit));
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const data = await storage.getTopOriginCountries(companyId, Number.isNaN(limit) ? 5 : limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os países de origem." });
    }
  });

  app.get("/api/companies/:id/top-destination-ports", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    const limit = Number.parseInt(String(req.query.limit ?? "5"), 10);

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.topDestinationPorts.slice(0, Number.isNaN(limit) ? 5 : limit));
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const data = await storage.getTopDestinationPorts(companyId, Number.isNaN(limit) ? 5 : limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os portos." });
    }
  });

  app.get("/api/companies/:id/top-hs-codes", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    const limit = Number.parseInt(String(req.query.limit ?? "5"), 10);

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      return res.json(sample.topHSCodes.slice(0, Number.isNaN(limit) ? 5 : limit));
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const data = await storage.getTopHSCodes(companyId, Number.isNaN(limit) ? 5 : limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os códigos HS." });
    }
  });

  app.get("/api/companies/:id/shipments", async (req, res) => {
    const companyId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Identificador inválido." });
    }

    const limit = Number.parseInt(String(req.query.limit ?? "10"), 10);
    const offset = Number.parseInt(String(req.query.offset ?? "0"), 10);

    if (!req.session?.userId) {
      const sample = getSampleCompanyById(companyId);
      if (!sample) {
        return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
      }

      const shipments = sample.shipments.slice(Number.isNaN(offset) ? 0 : offset, Number.isNaN(offset) ? 0 : offset + (Number.isNaN(limit) ? 10 : limit));

      return res.json({
        shipments,
        total: sample.shipments.length,
      });
    }

    const auth = await ensureAuthenticated(req, res, { loadContext: true });
    if (!auth || !auth.context) return;

    try {
      const access = await ensureCompanyAccess(auth.user.id, companyId, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      const result = await storage.getShipmentsByCompanyId(
        companyId,
        Number.isNaN(limit) ? 10 : limit,
        Number.isNaN(offset) ? 0 : offset,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os embarques." });
    }
  });

  app.get("/api/ncm/search", async (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      const limit = Number.parseInt(String(req.query.limit ?? "10"), 10);

      if (!req.session?.userId) {
        const sampleResults = searchSampleNcms(query, Number.isNaN(limit) ? 10 : limit).map((ncm) => ({
          code: ncm.code,
          description: ncm.description,
          totalShipments: ncm.totalShipments,
          allowed: true,
          reason: undefined,
          remainingSlots: 0,
        }));

        return res.json({
          results: sampleResults,
          summary: {
            plan: null,
            usage: { importer: 0, exporter: 0, ncm: 0 },
            remaining: { ncm: 0 },
          },
          mode: "guest",
        });
      }

      const auth = await ensureAuthenticated(req, res, { loadContext: true });
      if (!auth || !auth.context) return;
      const context = auth.context;

      if (!query) {
        return res.json({
          results: [],
          summary: {
            plan: summarizePlan(context.plan),
            usage: context.usage,
            remaining: {
              ncm: Math.max(quotaForKind(context.plan, 'ncm') - context.usage.ncm, 0),
            },
          },
        });
      }

      const results = await storage.searchNcm(query, Number.isNaN(limit) ? 10 : limit);
      const entitlementCodes = new Set(
        context.entitlements
          .filter((entry) => entry.ncmCode)
          .map((entry) => entry.ncmCode as string),
      );
      const quota = quotaForKind(context.plan, 'ncm');
      const remaining = Math.max(quota - context.usage.ncm, 0);

      const mapped = results.map((item) => {
        const normalizedCode = (item.code || "").trim();
        const hasEntitlement = entitlementCodes.has(normalizedCode);
        const allowed = hasEntitlement || (context.plan ? remaining > 0 : false);

        return {
          ...item,
          allowed,
          reason: allowed ? undefined : (context.plan ? PLAN_LIMIT_MESSAGE : PLAN_REQUIRED_MESSAGE),
          remainingSlots: remaining,
        };
      });

      res.json({
        results: mapped,
        summary: {
          plan: summarizePlan(context.plan),
          usage: context.usage,
          remaining: {
            ncm: remaining,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Erro ao buscar NCMs." });
    }
  });

  app.get("/api/ncm/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "");

      if (!req.session?.userId) {
        const sample = getSampleNcmByCode(code);
        if (!sample) {
          return res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
        }

        return res.json({
          code: sample.code,
          description: sample.description,
          totalShipments: sample.totalShipments,
          totalWeightKg: sample.totalWeightKg,
          totalTeus: sample.totalTeus,
        });
      }

      const auth = await ensureAuthenticated(req, res, { loadContext: true });
      if (!auth || !auth.context) return;

      const summary = await storage.getNcmSummary(code);

      if (!summary) {
        return res.status(404).json({ message: "Não encontramos esse NCM em nossa base." });
      }

      const access = await ensureNcmAccess(auth.user.id, summary.code, summary.description, auth.context);
      if (access.error) {
        return res.status(access.error.status).json({ message: access.error.message });
      }

      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar o NCM." });
    }
  });

  app.get("/api/ingestions", async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);
      const offset = Number.parseInt(String(req.query.offset ?? "0"), 10);

      const result = await storage.getIngestions(Number.isNaN(limit) ? 20 : limit, Number.isNaN(offset) ? 0 : offset);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar as importações." });
    }
  });

  app.get("/api/ingestions/:id", async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Identificador inválido." });
      }

      const ingestion = await storage.getIngestionById(id);

      if (!ingestion) {
        return res.status(404).json({ message: "Ingestão não encontrada." });
      }

      res.json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar a ingestão." });
    }
  });

  app.get("/api/ingestions/:id/errors", async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Identificador inválido." });
      }

      const errors = await storage.getErrorLogsByIngestionId(id);
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível carregar os erros." });
    }
  });

  app.post("/api/ingestions", async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const ingestion = await storage.createIngestion({
        filename: req.body.filename,
        status: 'queued',
        rowsTotal: 0,
        rowsOk: 0,
        rowsFailed: 0,
      });

      res.status(201).json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível criar a ingestão." });
    }
  });

  app.patch("/api/ingestions/:id", async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Identificador inválido." });
      }

      const ingestion = await storage.updateIngestion(id, req.body);
      res.json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível atualizar a ingestão." });
    }
  });

  app.post("/api/upload", upload.single('file'), async (req, res) => {
    const auth = await ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const ingestion = await storage.createIngestion({
        filename: req.file.originalname,
        status: 'queued',
        rowsTotal: 0,
        rowsOk: 0,
        rowsFailed: 0,
      });

      enqueueJob(req.file.path, ingestion.id);

      res.status(201).json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Não foi possível processar o upload." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
