import type { 
  Company, InsertCompany,
  Shipment, InsertShipment,
  Ingestion, InsertIngestion,
  ErrorLog, InsertErrorLog
} from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // Company operations
  searchCompanies(query: string, limit?: number): Promise<{ company: Company; score: number }[]>;
  getCompanyById(id: number): Promise<Company | null>;
  createCompany(company: InsertCompany): Promise<Company>;
  getOrCreateCompany(name: string, kind: 'importer' | 'exporter', countryCode: string): Promise<Company>;
  
  // Shipment operations
  getShipmentsByCompanyId(companyId: number, limit?: number, offset?: number): Promise<{ shipments: Shipment[]; total: number }>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
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
  getErrorLogsByIngestionId(ingestionId: number): Promise<ErrorLog[]>;
}

export class DatabaseStorage implements IStorage {
  constructor(private db: any) {}
  
  async searchCompanies(query: string, limit = 10): Promise<{ company: Company; score: number }[]> {
    const { companies } = await import("@shared/schema");
    const { ilike, sql, desc } = await import("drizzle-orm");
    
    // Simple fuzzy search using ILIKE with % wildcard
    const results = await this.db
      .select()
      .from(companies)
      .where(ilike(companies.name, `%${query}%`))
      .limit(limit);
    
    // Calculate simple similarity score based on position of match
    return results.map((company: Company) => {
      const lowerName = company.name.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const index = lowerName.indexOf(lowerQuery);
      
      // Score: 1.0 if exact match at start, decreasing based on position
      const score = index === 0 ? 1.0 : 
                   index > 0 ? 1.0 - (index / lowerName.length) * 0.5 : 
                   0.5;
      
      return { company, score };
    }).sort((a: { score: number }, b: { score: number }) => b.score - a.score);
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
    const { companies } = await import("@shared/schema");
    
    const result = await this.db
      .insert(companies)
      .values(company)
      .returning();
    
    return result[0];
  }
  
  async getOrCreateCompany(name: string, kind: 'importer' | 'exporter', countryCode: string): Promise<Company> {
    const { companies } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    // Try to find existing company
    const existing = await this.db
      .select()
      .from(companies)
      .where(and(
        eq(companies.name, name),
        eq(companies.kind, kind)
      ))
      .limit(1);
    
    if (existing[0]) {
      return existing[0];
    }
    
    // Create new company
    return this.createCompany({ name, kind, countryCode });
  }
  
  async getShipmentsByCompanyId(companyId: number, limit = 10, offset = 0): Promise<{ shipments: any[]; total: number }> {
    const { shipments, companies } = await import("@shared/schema");
    const { eq, count, desc, or } = await import("drizzle-orm");
    
    // Check if this company is an importer or exporter
    const company = await this.getCompanyById(companyId);
    if (!company) {
      return { shipments: [], total: 0 };
    }
    
    // If importer, search by partner_id; if exporter, search by company_id
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
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
        .leftJoin(companies, company.kind === 'importer' 
          ? eq(shipments.companyId, companies.id)
          : eq(shipments.partnerId, companies.id))
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
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
    const partnerColumn = company.kind === 'importer'
      ? shipments.companyId
      : shipments.partnerId;
    
    const result = await this.db
      .select({
        totalShipments: count(),
        totalTEUs: sum(shipments.teus),
        totalWeightKg: sum(shipments.weightKg),
        uniquePartners: countDistinct(partnerColumn)
      })
      .from(shipments)
      .where(whereCondition);
    
    const stats = result[0];
    return {
      totalShipments: stats?.totalShipments || 0,
      totalTEUs: Number(stats?.totalTEUs || 0),
      totalWeightKg: Number(stats?.totalWeightKg || 0),
      uniquePartners: stats?.uniquePartners || 0
    };
  }
  
  async getCompanyShipmentsOverTime(companyId: number): Promise<Array<{ month: string; shipments: number }>> {
    const { shipments } = await import("@shared/schema");
    const { eq, count, sql } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
    const result = await this.db
      .select({
        month: sql<string>`TO_CHAR(${shipments.ets}, 'YYYY-MM')`,
        shipments: count()
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
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
    const joinCondition = company.kind === 'importer'
      ? eq(shipments.companyId, companies.id)
      : eq(shipments.partnerId, companies.id);
    
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
    const { eq, count, desc, isNotNull } = await import("drizzle-orm");
    
    const company = await this.getCompanyById(companyId);
    if (!company) return [];
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
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
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
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
    
    const whereCondition = company.kind === 'importer' 
      ? eq(shipments.partnerId, companyId)
      : eq(shipments.companyId, companyId);
    
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
  
  async getErrorLogsByIngestionId(ingestionId: number): Promise<ErrorLog[]> {
    const { errorLogs } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    return await this.db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.ingestionId, ingestionId))
      .orderBy(errorLogs.rowNumber);
  }
}

export const storage = new DatabaseStorage(db);
