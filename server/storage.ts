import type {
  Company, InsertCompany,
  Shipment, InsertShipment,
  Ingestion, InsertIngestion,
  ErrorLog, InsertErrorLog,
  User, InsertUser,
  UserPlan, InsertUserPlan,
  UserEntitlement
} from "@shared/schema";
import { db } from "./db";

export function buildCompanyKey(name: string, kind: string): string {
  return `${kind.trim().toLowerCase()}::${name.trim()}`;
}

export interface IStorage {
  // Company operations
  searchCompanies(query: string, limit?: number): Promise<{ company: Company; score: number }[]>;
  getCompanyById(id: number): Promise<Company | null>;
  createCompany(company: InsertCompany): Promise<Company>;
  getOrCreateCompany(name: string, kind: 'importer' | 'exporter', countryCode: string): Promise<Company>;
  upsertCompaniesBatch(companies: InsertCompany[], tx?: any): Promise<Map<string, Company>>;
  withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;

  // Shipment operations
  getShipmentsByCompanyId(companyId: number, limit?: number, offset?: number): Promise<{ shipments: Shipment[]; total: number }>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  createShipmentsBatch(shipments: InsertShipment[], tx?: any): Promise<void>;
  getCompanyStats(companyId: number): Promise<{
    totalShipments: number;
    totalTEUs: number;
    totalWeightKg: number;
    uniquePartners: number;
  }>;
  getCompanyShipmentsOverTime(companyId: number): Promise<Array<{ month: string; shipments: number }>>;
  getTopPartners(companyId: number, limit?: number): Promise<Array<{ name: string; count: number }>>;
  getTopOriginCountries(companyId: number, limit?: number): Promise<Array<{ name: string; count: number }>>;
  getTopDestinationPorts(companyId: number, limit?: number): Promise<Array<{ name: string; count: number }>>;
  getTopHSCodes(companyId: number, limit?: number): Promise<Array<{ name: string; count: number }>>;
  
  // Ingestion operations
  createIngestion(ingestion: InsertIngestion): Promise<Ingestion>;
  updateIngestion(id: number, updates: Partial<Ingestion>): Promise<Ingestion>;
  getIngestions(limit?: number, offset?: number): Promise<{ ingestions: Ingestion[]; total: number }>;
  getIngestionById(id: number): Promise<Ingestion | null>;
  
  // Error log operations
  createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog>;
  createErrorLogsBatch(errorLogs: InsertErrorLog[], tx?: any): Promise<void>;
  getErrorLogsByIngestionId(ingestionId: number): Promise<ErrorLog[]>;

  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;

  // Plan operations
  setActivePlan(userId: number, plan: Omit<InsertUserPlan, "userId" | "status" | "monthlyPrice" | "annualPrice"> & { billingCycle: string; monthlyPrice: number; annualPrice: number }): Promise<UserPlan>;
  getActivePlanByUserId(userId: number): Promise<UserPlan | null>;

  // Entitlement operations
  listEntitlementsByUser(userId: number): Promise<UserEntitlement[]>;
  getCompanyEntitlement(userId: number, companyId: number): Promise<UserEntitlement | null>;
  grantCompanyEntitlement(userId: number, companyId: number, kind: 'importer' | 'exporter', label: string): Promise<UserEntitlement>;
  getNcmEntitlement(userId: number, ncmCode: string): Promise<UserEntitlement | null>;
  grantNcmEntitlement(userId: number, ncmCode: string, label: string): Promise<UserEntitlement>;
  countEntitlementsByKind(userId: number): Promise<Record<'importer' | 'exporter' | 'ncm', number>>;

  // NCM operations
  searchNcm(query: string, limit?: number): Promise<Array<{ code: string; description: string | null; totalShipments: number }>>;
  getNcmSummary(code: string): Promise<{ code: string; description: string | null; totalShipments: number; totalWeightKg: number; totalTeus: number } | null>;
}

export class DatabaseStorage implements IStorage {
  constructor(private db: any) {}

  async withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async searchCompanies(query: string, limit = 10): Promise<{ company: Company; score: number }[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const { companies } = await import("@shared/schema");
    const { sql, ilike } = await import("drizzle-orm");

    const likePattern = `%${trimmedQuery}%`;
    const trigramResults = await this.db.execute(sql`
      select
        c.id,
        c.name,
        c.kind,
        c.country_code as "countryCode",
        c.created_at as "createdAt",
        word_similarity(${trimmedQuery}, c.name) as score
      from companies c
      where ${trimmedQuery} <% c.name OR LOWER(c.name) LIKE LOWER(${likePattern})
      order by score desc
      limit ${limit}
    `);

    const scoredResults: { company: Company; score: number }[] = trigramResults.rows.map((row: any) => ({
      company: {
        id: row.id,
        name: row.name,
        kind: row.kind,
        countryCode: row.countryCode,
        createdAt: row.createdAt,
      },
      score: typeof row.score === "number" ? row.score : Number(row.score ?? 0),
    }));

    const seenIds = new Set(scoredResults.map((entry) => entry.company.id));

    if (scoredResults.length < limit) {
      const fallbackCandidates = await this.db
        .select()
        .from(companies)
        .where(ilike(companies.name, `%${trimmedQuery}%`))
        .orderBy(companies.name)
        .limit(limit * 2);

      const calculateFallbackScore = (name: string, search: string): number => {
        const lowerName = name.toLowerCase();
        const lowerQuery = search.toLowerCase();
        const index = lowerName.indexOf(lowerQuery);

        if (index === -1) return 0.1;
        if (index === 0 && lowerName === lowerQuery) return 1;
        if (index === 0) return 0.9;
        return Math.max(0.1, 0.7 - (index / Math.max(lowerName.length, 1)) * 0.5);
      };

      for (const company of fallbackCandidates) {
        if (seenIds.has(company.id)) continue;
        scoredResults.push({
          company,
          score: calculateFallbackScore(company.name, trimmedQuery),
        });
        seenIds.add(company.id);
        if (scoredResults.length >= limit) break;
      }
    }

    return scoredResults.slice(0, limit);
  }
  
  async getCompanyById(id: number): Promise<Company | null> {
    const { companies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const result = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    
    return result[0] || null;
  }
  
  async createCompany(company: InsertCompany): Promise<Company> {
    const sanitizedName = company.name.trim();
    const sanitizedKind = company.kind.trim().toLowerCase();
    const sanitizedCountry = company.countryCode.trim() || "Unknown";

    const companiesMap = await this.upsertCompaniesBatch([
      {
        ...company,
        name: sanitizedName,
        kind: sanitizedKind,
        countryCode: sanitizedCountry,
      },
    ]);

    const created = companiesMap.get(buildCompanyKey(sanitizedName, sanitizedKind));
    if (!created) {
      throw new Error(`Falha ao criar empresa ${sanitizedName}`);
    }

    return created;
  }

  async getOrCreateCompany(name: string, kind: 'importer' | 'exporter', countryCode: string): Promise<Company> {
    const sanitizedName = name.trim();
    const normalizedKind = kind.trim().toLowerCase() as typeof kind;
    const sanitizedCountry = countryCode.trim() || "Unknown";

    const companiesMap = await this.upsertCompaniesBatch([
      { name: sanitizedName, kind: normalizedKind, countryCode: sanitizedCountry },
    ]);

    const company = companiesMap.get(buildCompanyKey(sanitizedName, normalizedKind));
    if (!company) {
      throw new Error(`Falha ao recuperar empresa ${sanitizedName}`);
    }

    return company;
  }

  async upsertCompaniesBatch(companiesToUpsert: InsertCompany[], tx: any = this.db): Promise<Map<string, Company>> {
    const deduped = new Map<string, InsertCompany>();

    for (const entry of companiesToUpsert) {
      if (!entry) continue;
      const sanitizedName = entry.name.trim();
      if (!sanitizedName) continue;
      const sanitizedKind = entry.kind.trim().toLowerCase();
      if (!sanitizedKind) continue;
      const sanitizedCountry = (entry.countryCode ?? "").trim() || "Unknown";

      const normalized: InsertCompany = {
        ...entry,
        name: sanitizedName,
        kind: sanitizedKind,
        countryCode: sanitizedCountry,
      };

      deduped.set(buildCompanyKey(normalized.name, normalized.kind), normalized);
    }

    if (deduped.size === 0) {
      return new Map();
    }

    const values = Array.from(deduped.values());
    const { companies } = await import("@shared/schema");
    const { sql } = await import("drizzle-orm");

    const rows = await tx
      .insert(companies)
      .values(values)
      .onConflictDoUpdate({
        target: [companies.name, companies.kind],
        set: {
          countryCode: sql`coalesce(nullif(excluded.country_code, 'Unknown'), ${companies.countryCode})`,
        },
      })
      .returning();

    const resultMap = new Map<string, Company>();
    for (const row of rows) {
      resultMap.set(buildCompanyKey(row.name, row.kind), row);
    }

    if (resultMap.size < deduped.size) {
      const missingValues = values.filter((value) => !resultMap.has(buildCompanyKey(value.name, value.kind)));
      if (missingValues.length > 0) {
        const conditions = missingValues.map((item) => sql`(${companies.name} = ${item.name} and ${companies.kind} = ${item.kind})`);
        const existing = await tx
          .select()
          .from(companies)
          .where(sql.join(conditions, sql` or `));

        for (const row of existing) {
          resultMap.set(buildCompanyKey(row.name, row.kind), row);
        }
      }
    }

    return resultMap;
  }
  
  async getShipmentsByCompanyId(companyId: number, limit = 10, offset = 0): Promise<{ shipments: any[]; total: number }> {
    const { shipments, companies } = await import("@shared/schema");
    const { eq, count, desc } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) {
      return { shipments: [], total: 0 };
    }
    
    const whereCondition = eq(shipments.companyId, companyId);
    
    const [shipmentsResult, totalResult] = await Promise.all([
      this.db
        .select({
          id: shipments.id,
          shipmentNo: shipments.shipmentNo,
          ets: shipments.ets,
          eta: shipments.eta,
          originCountry: shipments.originCountry,
          originPort: shipments.originPort,
          destinationCountry: shipments.destinationCountry,
          destinationPort: shipments.destinationPort,
          hsCode: shipments.hsCode,
          hsDescription: shipments.hsDescription,
          teus: shipments.teus,
          weightKg: shipments.weightKg,
          partner: {
            id: companies.id,
            name: companies.name,
          }
        })
        .from(shipments)
        .leftJoin(companies, eq(shipments.partnerId, companies.id))
        .where(whereCondition)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(shipments.ets)),
      this.db
        .select({ count: count() })
        .from(shipments)
        .where(whereCondition)
    ]);
    
    return {
      shipments: shipmentsResult,
      total: totalResult[0]?.count || 0
    };
  }
  
  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    const { shipments } = await import("@shared/schema");

    const result = await this.db
      .insert(shipments)
      .values(shipment)
      .returning();

    return result[0];
  }

  async createShipmentsBatch(shipmentsToInsert: InsertShipment[], tx: any = this.db): Promise<void> {
    if (!shipmentsToInsert.length) {
      return;
    }

    const { shipments } = await import("@shared/schema");
    await tx.insert(shipments).values(shipmentsToInsert);
  }
  
  async getCompanyStats(companyId: number): Promise<{
    totalShipments: number;
    totalTEUs: number;
    totalWeightKg: number;
    uniquePartners: number;
  }> {
    const { shipments } = await import("@shared/schema");
    const { eq, count, sum, countDistinct, sql } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) {
      return { totalShipments: 0, totalTEUs: 0, totalWeightKg: 0, uniquePartners: 0 };
    }
    
    const whereCondition = eq(shipments.companyId, companyId);

    const partnerColumn = shipments.partnerId;
    
    const result = await this.db
      .select({
        totalShipments: count(),
        totalTEUs: sum(shipments.teus),
        totalWeightKg: sql<string>`sum(CAST(${shipments.weightKg} AS DECIMAL))`,
        uniquePartners: countDistinct(partnerColumn),
      })
      .from(shipments)
      .where(whereCondition);
    
    return {
      totalShipments: result[0]?.totalShipments || 0,
      totalTEUs: result[0]?.totalTEUs || 0,
      totalWeightKg: parseFloat(result[0]?.totalWeightKg || '0'),
      uniquePartners: result[0]?.uniquePartners || 0,
    };
  }
  
  async getCompanyShipmentsOverTime(companyId: number): Promise<Array<{ month: string; shipments: number }>> {
    const { shipments } = await import("@shared/schema");
    const { eq, sql, desc } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = eq(shipments.companyId, companyId);
    
    const result = await this.db
      .select({
        month: sql<string>`TO_CHAR(${shipments.ets}, 'YYYY-MM')`,
        shipments: sql<number>`count(*)::int`,
      })
      .from(shipments)
      .where(whereCondition)
      .groupBy(sql`TO_CHAR(${shipments.ets}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${shipments.ets}, 'YYYY-MM')`);
    
    return result.map((r: any) => ({
      month: r.month || '',
      shipments: r.shipments || 0
    }));
  }
  
  async getTopPartners(companyId: number, limit = 5): Promise<Array<{ name: string; count: number }>> {
    const { shipments, companies } = await import("@shared/schema");
    const { eq, count, sql, desc } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = eq(shipments.companyId, companyId);

    const joinCondition = eq(shipments.partnerId, companies.id);
    
    const result = await this.db
      .select({
        name: companies.name,
        count: count()
      })
      .from(shipments)
      .innerJoin(companies, joinCondition)
      .where(whereCondition)
      .groupBy(companies.name)
      .orderBy(desc(count()))
      .limit(limit);
    
    return result.map((r: any) => ({
      name: r.name || '',
      count: r.count || 0
    }));
  }
  
  async getTopOriginCountries(companyId: number, limit = 5): Promise<Array<{ name: string; count: number }>> {
    const { shipments } = await import("@shared/schema");
    const { eq, count, desc } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = eq(shipments.companyId, companyId);
    
    const result = await this.db
      .select({
        name: shipments.originCountry,
        count: count()
      })
      .from(shipments)
      .where(whereCondition)
      .groupBy(shipments.originCountry)
      .orderBy(desc(count()))
      .limit(limit);
    
    return result
      .filter((r: any) => r.name)
      .map((r: any) => ({
        name: r.name || '',
        count: r.count || 0
      }));
  }
  
  async getTopDestinationPorts(companyId: number, limit = 5): Promise<Array<{ name: string; count: number }>> {
    const { shipments } = await import("@shared/schema");
    const { eq, count, desc } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = eq(shipments.companyId, companyId);
    
    const result = await this.db
      .select({
        name: shipments.destinationPort,
        count: count()
      })
      .from(shipments)
      .where(whereCondition)
      .groupBy(shipments.destinationPort)
      .orderBy(desc(count()))
      .limit(limit);
    
    return result
      .filter((r: any) => r.name)
      .map((r: any) => ({
        name: r.name || '',
        count: r.count || 0
      }));
  }
  
  async getTopHSCodes(companyId: number, limit = 5): Promise<Array<{ name: string; count: number }>> {
    const { shipments } = await import("@shared/schema");
    const { eq, count, desc, sql } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = eq(shipments.companyId, companyId);
    
    const result = await this.db
      .select({
        hsCode: shipments.hsCode,
        hsDescription: shipments.hsDescription,
        count: count()
      })
      .from(shipments)
      .where(whereCondition)
      .groupBy(shipments.hsCode, shipments.hsDescription)
      .orderBy(desc(count()))
      .limit(limit);
    
    return result
      .filter((r: any) => r.hsCode)
      .map((r: any) => ({
        name: r.hsDescription ? `${r.hsCode} - ${r.hsDescription}` : r.hsCode || '',
        count: r.count || 0
      }));
  }
  
  async createIngestion(ingestion: InsertIngestion): Promise<Ingestion> {
    const { ingestions } = await import("@shared/schema");
    
    const result = await this.db
      .insert(ingestions)
      .values(ingestion)
      .returning();
    
    return result[0];
  }
  
  async updateIngestion(id: number, updates: Partial<Ingestion>): Promise<Ingestion> {
    const { ingestions } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const result = await this.db
      .update(ingestions)
      .set(updates)
      .where(eq(ingestions.id, id))
      .returning();
    
    return result[0];
  }
  
  async getIngestions(limit = 20, offset = 0): Promise<{ ingestions: Ingestion[]; total: number }> {
    const { ingestions } = await import("@shared/schema");
    const { count, desc } = await import("drizzle-orm");
    
    const [ingestionsResult, totalResult] = await Promise.all([
      this.db
        .select()
        .from(ingestions)
        .orderBy(desc(ingestions.uploadedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(ingestions)
    ]);
    
    return {
      ingestions: ingestionsResult,
      total: totalResult[0]?.count || 0
    };
  }
  
  async getIngestionById(id: number): Promise<Ingestion | null> {
    const { ingestions } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const result = await this.db
      .select()
      .from(ingestions)
      .where(eq(ingestions.id, id))
      .limit(1);
    
    return result[0] || null;
  }
  
  async createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog> {
    const { errorLogs } = await import("@shared/schema");

    const result = await this.db
      .insert(errorLogs)
      .values(errorLog)
      .returning();

    return result[0];
  }

  async createErrorLogsBatch(errorLogsToInsert: InsertErrorLog[], tx: any = this.db): Promise<void> {
    if (!errorLogsToInsert.length) {
      return;
    }

    const { errorLogs } = await import("@shared/schema");
    await tx.insert(errorLogs).values(errorLogsToInsert);
  }

  async getErrorLogsByIngestionId(ingestionId: number): Promise<ErrorLog[]> {
    const { errorLogs } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    return await this.db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.ingestionId, ingestionId))
      .orderBy(errorLogs.rowNumber);
  }

  async createUser(user: InsertUser): Promise<User> {
    const sanitizedName = user.name.trim();
    const sanitizedEmail = user.email.trim().toLowerCase();
    const passwordHash = user.passwordHash.trim();

    const { users } = await import("@shared/schema");

    const result = await this.db
      .insert(users)
      .values({
        name: sanitizedName,
        email: sanitizedEmail,
        passwordHash,
      })
      .returning();

    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return null;

    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, trimmed))
      .limit(1);

    return result[0] || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] || null;
  }

  async setActivePlan(
    userId: number,
    plan: Omit<InsertUserPlan, "userId" | "status" | "monthlyPrice" | "annualPrice"> & { billingCycle: string; monthlyPrice: number; annualPrice: number }
  ): Promise<UserPlan> {
    const { userPlans } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const sanitizedPlan = {
      importerQuota: Math.max(0, plan.importerQuota ?? 0),
      exporterQuota: Math.max(0, plan.exporterQuota ?? 0),
      ncmQuota: Math.max(0, plan.ncmQuota ?? 0),
      billingCycle: plan.billingCycle,
      monthlyPrice: plan.monthlyPrice.toFixed(2),
      annualPrice: plan.annualPrice.toFixed(2),
    };

    return await this.db.transaction(async (tx: any) => {
      await tx
        .update(userPlans)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(userPlans.userId, userId), eq(userPlans.status, "active")));

      const result = await tx
        .insert(userPlans)
        .values({
          userId,
          status: "active",
          ...sanitizedPlan,
        })
        .returning();

      return result[0];
    });
  }

  async getActivePlanByUserId(userId: number): Promise<UserPlan | null> {
    const { userPlans } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");

    const result: UserPlan[] = await this.db
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, userId))
      .orderBy(desc(userPlans.createdAt));

    return result.find((planEntry) => planEntry.status === "active") || null;
  }

  async listEntitlementsByUser(userId: number): Promise<UserEntitlement[]> {
    const { userEntitlements } = await import("@shared/schema");
    const { eq, asc } = await import("drizzle-orm");

    return await this.db
      .select()
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, userId))
      .orderBy(asc(userEntitlements.createdAt));
  }

  async getCompanyEntitlement(userId: number, companyId: number): Promise<UserEntitlement | null> {
    const { userEntitlements } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    if (!companyId) return null;

    const result = await this.db
      .select()
      .from(userEntitlements)
      .where(and(
        eq(userEntitlements.userId, userId),
        eq(userEntitlements.companyId, companyId)
      ))
      .limit(1);

    return result[0] || null;
  }

  async grantCompanyEntitlement(
    userId: number,
    companyId: number,
    kind: 'importer' | 'exporter',
    label: string
  ): Promise<UserEntitlement> {
    const existing = await this.getCompanyEntitlement(userId, companyId);
    if (existing) {
      return existing;
    }

    const { userEntitlements } = await import("@shared/schema");

    const result = await this.db
      .insert(userEntitlements)
      .values({
        userId,
        companyId,
        targetKind: kind,
        label,
      })
      .returning();

    return result[0];
  }

  async getNcmEntitlement(userId: number, ncmCode: string): Promise<UserEntitlement | null> {
    const trimmed = (ncmCode || "").trim();
    if (!trimmed) return null;

    const { userEntitlements } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const result = await this.db
      .select()
      .from(userEntitlements)
      .where(and(
        eq(userEntitlements.userId, userId),
        eq(userEntitlements.ncmCode, trimmed)
      ))
      .limit(1);

    return result[0] || null;
  }

  async grantNcmEntitlement(userId: number, ncmCode: string, label: string): Promise<UserEntitlement> {
    const trimmedCode = (ncmCode || "").trim();
    if (!trimmedCode) {
      throw new Error("Código NCM inválido");
    }

    const existing = await this.getNcmEntitlement(userId, trimmedCode);
    if (existing) {
      return existing;
    }

    const { userEntitlements } = await import("@shared/schema");

    const result = await this.db
      .insert(userEntitlements)
      .values({
        userId,
        targetKind: 'ncm',
        ncmCode: trimmedCode,
        label,
      })
      .returning();

    return result[0];
  }

  async countEntitlementsByKind(userId: number): Promise<Record<'importer' | 'exporter' | 'ncm', number>> {
    const { userEntitlements } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    const rows = await this.db
      .select({
        targetKind: userEntitlements.targetKind,
        total: sql<number>`count(*)::int`,
      })
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, userId))
      .groupBy(userEntitlements.targetKind);

    const counts: Record<'importer' | 'exporter' | 'ncm', number> = {
      importer: 0,
      exporter: 0,
      ncm: 0,
    };

    for (const row of rows) {
      const kind = row.targetKind as 'importer' | 'exporter' | 'ncm';
      if (counts[kind] !== undefined) {
        counts[kind] = Number(row.total) || 0;
      }
    }

    return counts;
  }

  async searchNcm(query: string, limit = 10): Promise<Array<{ code: string; description: string | null; totalShipments: number }>> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const { sql } = await import("drizzle-orm");

    const results = await this.db.execute(sql`
      select
        hs_code as code,
        max(nullif(hs_description, '')) as description,
        count(*) as total_shipments
      from shipments
      where hs_code is not null
        and (hs_code ilike ${'%' + trimmedQuery + '%'} or hs_description ilike ${'%' + trimmedQuery + '%'})
      group by hs_code
      order by total_shipments desc
      limit ${limit}
    `);

    return results.rows.map((row: any) => ({
      code: row.code,
      description: row.description ?? null,
      totalShipments: typeof row.total_shipments === "number" ? row.total_shipments : Number(row.total_shipments || 0),
    }));
  }

  async getNcmSummary(code: string): Promise<{ code: string; description: string | null; totalShipments: number; totalWeightKg: number; totalTeus: number } | null> {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return null;
    }

    const { shipments } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    const rows = await this.db
      .select({
        code: shipments.hsCode,
        description: sql<string | null>`max(nullif(${shipments.hsDescription}, ''))`,
        totalShipments: sql<number>`count(*)::int`,
        totalWeightKg: sql<string>`sum(CAST(${shipments.weightKg} AS DECIMAL))`,
        totalTeus: sql<number>`sum(coalesce(${shipments.teus},0))::int`,
      })
      .from(shipments)
      .where(eq(shipments.hsCode, trimmedCode))
      .groupBy(shipments.hsCode);

    if (!rows.length) {
      return null;
    }

    const row = rows[0];
    return {
      code: row.code,
      description: row.description,
      totalShipments: row.totalShipments || 0,
      totalWeightKg: parseFloat(row.totalWeightKg || '0'),
      totalTeus: row.totalTeus || 0,
    };
  }
}

export const storage = new DatabaseStorage(db);
