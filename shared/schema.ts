import { sql } from "drizzle-orm";
import { pgTable, text, integer, serial, timestamp, numeric, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table - stores importers and exporters
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'importer' or 'exporter'
  countryCode: text("country_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  kindIdx: index("companies_kind_idx").on(table.kind),
  countryIdx: index("companies_country_idx").on(table.countryCode),
  nameKindUniqueIdx: uniqueIndex("companies_name_kind_unique_idx").on(table.name, table.kind),
  nameTrgmIdx: index("companies_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Users table - handles authentication and account metadata
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailUniqueIdx: uniqueIndex("users_email_unique_idx").on(table.email),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userPlans = pgTable("user_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  importerQuota: integer("importer_quota").notNull().default(0),
  exporterQuota: integer("exporter_quota").notNull().default(0),
  ncmQuota: integer("ncm_quota").notNull().default(0),
  billingCycle: text("billing_cycle").notNull(),
  monthlyPrice: numeric("monthly_price").notNull().default("0"),
  annualPrice: numeric("annual_price").notNull().default("0"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_plans_user_idx").on(table.userId),
  statusIdx: index("user_plans_status_idx").on(table.status),
}));

export const insertUserPlanSchema = createInsertSchema(userPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPlan = z.infer<typeof insertUserPlanSchema>;
export type UserPlan = typeof userPlans.$inferSelect;

export const userEntitlements = pgTable("user_entitlements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  targetKind: text("target_kind").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  ncmCode: text("ncm_code"),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userKindIdx: index("user_entitlements_kind_idx").on(table.userId, table.targetKind),
  userCompanyIdx: index("user_entitlements_company_idx").on(table.userId, table.companyId),
  userNcmIdx: index("user_entitlements_ncm_idx").on(table.userId, table.ncmCode),
}));

export const insertUserEntitlementSchema = createInsertSchema(userEntitlements).omit({
  id: true,
  createdAt: true,
});
export type InsertUserEntitlement = z.infer<typeof insertUserEntitlementSchema>;
export type UserEntitlement = typeof userEntitlements.$inferSelect;

// Shipments table - stores maritime trade shipment data
export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  shipmentNo: text("shipment_no").notNull(),
  ets: timestamp("ets"), // Estimated Time of Sailing
  eta: timestamp("eta"), // Estimated Time of Arrival
  partnerId: integer("partner_id").references(() => companies.id),
  originCountry: text("origin_country"),
  originPort: text("origin_port"),
  destinationCountry: text("destination_country"),
  destinationPort: text("destination_port"),
  hsCode: text("hs_code"),
  hsDescription: text("hs_description"),
  teus: integer("teus"),
  weightKg: numeric("weight_kg"),
  ingestionId: integer("ingestion_id").references(() => ingestions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("shipments_company_idx").on(table.companyId),
  partnerIdx: index("shipments_partner_idx").on(table.partnerId),
  shipmentNoIdx: index("shipments_no_idx").on(table.shipmentNo),
  etsIdx: index("shipments_ets_idx").on(table.ets),
  hsCodeIdx: index("shipments_hs_code_idx").on(table.hsCode),
}));

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
});
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;

// Ingestions table - tracks file upload and processing jobs
export const ingestions = pgTable("ingestions", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  status: text("status").notNull(), // 'queued', 'processing', 'done', 'failed', 'canceled'
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsOk: integer("rows_ok").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
}, (table) => ({
  statusIdx: index("ingestions_status_idx").on(table.status),
  uploadedIdx: index("ingestions_uploaded_idx").on(table.uploadedAt),
}));

export const insertIngestionSchema = createInsertSchema(ingestions).omit({
  id: true,
  uploadedAt: true,
});
export type InsertIngestion = z.infer<typeof insertIngestionSchema>;
export type Ingestion = typeof ingestions.$inferSelect;

// Error logs table - stores validation errors from ETL processing
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  ingestionId: integer("ingestion_id").notNull().references(() => ingestions.id),
  rowNumber: integer("row_number").notNull(),
  fieldName: text("field_name"),
  errorMessage: text("error_message").notNull(),
  rowData: text("row_data"), // JSON string of the problematic row
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ingestionIdx: index("error_logs_ingestion_idx").on(table.ingestionId),
}));

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
