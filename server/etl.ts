import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import type { InsertCompany, InsertShipment, InsertErrorLog } from "@shared/schema";
import { storage, buildCompanyKey } from "./storage";

interface ShipmentRow {
  company_name?: string;
  company_kind?: string;
  company_country?: string;
  importer_name?: string;
  importer_country?: string;
  exporter_name?: string;
  exporter_country?: string;
  shipment_no?: string;
  ets?: string;
  eta?: string;
  partner_name?: string;
  partner_country?: string;
  origin_country?: string;
  origin_port?: string;
  destination_country?: string;
  destination_port?: string;
  hs_code?: string;
  hs_description?: string;
  teus?: string | number;
  weight_kg?: string | number;
}

type CanonicalShipmentField = keyof ShipmentRow;

const HEADER_MAPPINGS: Record<string, CanonicalShipmentField> = {
  companyname: "company_name",
  nomedaempresa: "company_name",
  razaosocial: "company_name",
  empresanome: "company_name",
  nomeexportador: "exporter_name",
  exportador: "exporter_name",
  exportername: "exporter_name",
  exportercountry: "exporter_country",
  paisexportador: "exporter_country",
  consignatario: "importer_name",
  importador: "importer_name",
  importername: "importer_name",
  importercountry: "importer_country",
  paisimportador: "importer_country",
  companykind: "company_kind",
  tipodeempresa: "company_kind",
  tipoempresa: "company_kind",
  importadorouexportador: "company_kind",
  companycountry: "company_country",
  paisdaempresa: "company_country",
  paisempresa: "company_country",
  paisdeprocedencia: "company_country",
  shipmentno: "shipment_no",
  numerodoembarque: "shipment_no",
  conhecimento: "shipment_no",
  embarque: "shipment_no",
  ets: "ets",
  dataets: "ets",
  eta: "eta",
  dataeta: "eta",
  partnername: "partner_name",
  nomeparceiro: "partner_name",
  parceiro: "partner_name",
  partnercountry: "partner_country",
  paisparceiro: "partner_country",
  origincountry: "origin_country",
  paisorigem: "origin_country",
  paisdeembarque: "origin_country",
  originport: "origin_port",
  portoorigem: "origin_port",
  portoembarque: "origin_port",
  destinationcountry: "destination_country",
  paisdestino: "destination_country",
  destinationport: "destination_port",
  portodestino: "destination_port",
  portodescarga: "destination_port",
  hscode: "hs_code",
  ncm: "hs_code",
  hsdescription: "hs_description",
  descricaoncm: "hs_description",
  mercadoria: "hs_description",
  teus: "teus",
  teu: "teus",
  weightkg: "weight_kg",
  pesokg: "weight_kg",
  peso: "weight_kg",
  pesobruto: "weight_kg",
};

const BATCH_SIZE = 500;

type TradeRole = 'importer' | 'exporter';

const COMPANY_KIND_MAPPINGS: Record<string, "importer" | "exporter"> = {
  importer: "importer",
  importador: "importer",
  importadores: "importer",
  comprador: "importer",
  buyer: "importer",
  exporter: "exporter",
  exportador: "exporter",
  exportadores: "exporter",
  vendedor: "exporter",
  seller: "exporter",
};

function normalizeKey(rawKey: string): string {
  return rawKey
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCompanyKind(kind: string | undefined): string | undefined {
  if (!kind) return undefined;
  const normalized = normalizeKey(kind);
  return COMPANY_KIND_MAPPINGS[normalized] ?? kind.trim().toLowerCase();
}

function normalizeShipmentRow(row: ShipmentRow): ShipmentRow {
  const normalizedRow: ShipmentRow = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    const normalizedKey = normalizeKey(key);
    const mappedKey = HEADER_MAPPINGS[normalizedKey] ?? key;
    (normalizedRow as Record<string, unknown>)[mappedKey] =
      typeof value === "string" ? value.trim() : value;
  }

  if (!normalizedRow.company_kind && normalizedRow.company_name) {
    normalizedRow.company_kind = "exporter";
  }
  
  if (normalizedRow.company_kind) {
    normalizedRow.company_kind = normalizeCompanyKind(
      normalizedRow.company_kind
    );
  }

  return normalizedRow;
}

function normalizeShipmentRows(rows: ShipmentRow[]): ShipmentRow[] {
  return rows.map((row) => normalizeShipmentRow(row));
}

export async function processShipmentFile(filePath: string, ingestionId: number): Promise<void> {
  try {
    console.log(`[ETL] Processing file: ${filePath}, ingestion ID: ${ingestionId}`);
    
    const ingestion = await storage.getIngestionById(ingestionId);
    if (!ingestion) {
      throw new Error(`Ingestão ID ${ingestionId} não encontrada`);
    }

    const targetCompanyName = ingestion.targetCompanyName;
    const targetCompanyKind = ingestion.targetCompanyKind as 'importer' | 'exporter' | null;

    console.log(`[ETL] Target company: ${targetCompanyName} (${targetCompanyKind})`);
    
    await storage.updateIngestion(ingestionId, {
      status: 'processing',
      startedAt: new Date(),
    });

    const ext = path.extname(filePath).toLowerCase();
    let rows: ShipmentRow[] = [];

    if (ext === '.csv') {
      rows = await readCSVFile(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = await readExcelFile(filePath);
    } else {
      throw new Error('Formato de arquivo não suportado');
    }

    console.log(`[ETL] Read ${rows.length} raw rows from file`);

    rows = normalizeShipmentRows(rows);
    
    console.log(`[ETL] After normalization: ${rows.length} rows`);

    let rowsOk = 0;
    let rowsFailed = 0;
    const totalRows = rows.length;

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);
      const { ok, failed } = await processShipmentBatch(batch, ingestionId, start, targetCompanyName, targetCompanyKind);
      rowsOk += ok;
      rowsFailed += failed;
    }

    await storage.updateIngestion(ingestionId, {
      status: 'done',
      completedAt: new Date(),
      rowsTotal: totalRows,
      rowsOk,
      rowsFailed,
    });

    fs.unlinkSync(filePath);

  } catch (error: any) {
    await storage.updateIngestion(ingestionId, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: error.message,
    });

    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
}

async function readExcelFile(filePath: string): Promise<ShipmentRow[]> {
  console.log(`[ETL] Reading Excel file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[ETL] File not found: ${filePath}`);
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  console.log(`[ETL] Workbook sheets: ${workbook.SheetNames.join(', ')}`);
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json<ShipmentRow>(worksheet, {
    raw: false,
    defval: undefined,
  });
  
  console.log(`[ETL] Parsed ${data.length} rows from sheet "${sheetName}"`);
  if (data.length > 0) {
    console.log(`[ETL] First row keys:`, Object.keys(data[0]));
  }
  
  return data;
}

async function readCSVFile(filePath: string): Promise<ShipmentRow[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json<ShipmentRow>(worksheet, {
    raw: false,
    defval: undefined,
  });
  
  return data;
}

type ShipmentInsertBase = Omit<InsertShipment, "companyId" | "partnerId">;

interface PreparedShipmentEntry {
  rowNumber: number;
  originalRow: ShipmentRow;
  company: InsertCompany;
  partner?: InsertCompany;
  companyKey: string;
  partnerKey?: string;
  shipment: ShipmentInsertBase;
}

async function processShipmentBatch(
  batch: ShipmentRow[],
  ingestionId: number,
  startIndex: number,
  targetCompanyName?: string | null,
  targetCompanyKind?: 'importer' | 'exporter' | null,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  const validationErrors: InsertErrorLog[] = [];
  const processingErrors: InsertErrorLog[] = [];
  const loggedRows = new Set<number>();
  const preparedEntries: PreparedShipmentEntry[] = [];

  for (let idx = 0; idx < batch.length; idx++) {
    const row = batch[idx];
    const rowNumber = startIndex + idx + 1;

    try {
      const prepared = prepareShipmentEntry(row, rowNumber, ingestionId, targetCompanyName, targetCompanyKind);
      preparedEntries.push(prepared);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : 'Erro ao validar linha';
      validationErrors.push(createErrorLogEntry(ingestionId, rowNumber, message, row));
      loggedRows.add(rowNumber);
    }
  }

  if (preparedEntries.length === 0) {
    if (validationErrors.length) {
      await storage.createErrorLogsBatch(validationErrors);
    }
    return { ok, failed };
  }

  try {
    const insertedCount = await storage.withTransaction(async (tx) => {
      const companyInputs: InsertCompany[] = [];
      for (const entry of preparedEntries) {
        companyInputs.push(entry.company);
        if (entry.partner) {
          companyInputs.push(entry.partner);
        }
      }

      const companyMap = await storage.upsertCompaniesBatch(companyInputs, tx);

      const shipmentsToInsert: InsertShipment[] = [];

      for (const entry of preparedEntries) {
        const company = companyMap.get(entry.companyKey);
        if (!company) {
          processingErrors.push(createErrorLogEntry(
            ingestionId,
            entry.rowNumber,
            'Empresa não encontrada após upsert',
            entry.originalRow,
          ));
          loggedRows.add(entry.rowNumber);
          failed++;
          continue;
        }

        let partnerId: number | undefined;
        if (entry.partner && entry.partnerKey) {
          const partner = companyMap.get(entry.partnerKey);
          if (!partner) {
            processingErrors.push(createErrorLogEntry(
              ingestionId,
              entry.rowNumber,
              'Parceiro não encontrado após upsert',
              entry.originalRow,
            ));
            loggedRows.add(entry.rowNumber);
            failed++;
            continue;
          }
          partnerId = partner.id;
        }

        shipmentsToInsert.push({
          ...entry.shipment,
          companyId: company.id,
          partnerId,
        });
      }

      if (!shipmentsToInsert.length) {
        return 0;
      }

      await storage.createShipmentsBatch(shipmentsToInsert, tx);
      return shipmentsToInsert.length;
    });

    ok += insertedCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao salvar lote';
    for (const entry of preparedEntries) {
      if (loggedRows.has(entry.rowNumber)) continue;
      processingErrors.push(createErrorLogEntry(
        ingestionId,
        entry.rowNumber,
        `Erro ao salvar lote: ${message}`,
        entry.originalRow,
      ));
      loggedRows.add(entry.rowNumber);
      failed++;
    }
  }

  const allErrors = [...validationErrors, ...processingErrors];
  if (allErrors.length) {
    await storage.createErrorLogsBatch(allErrors);
  }

  return { ok, failed };
}

export function prepareShipmentEntry(
  row: ShipmentRow, 
  rowNumber: number, 
  ingestionId: number,
  targetCompanyName?: string | null,
  targetCompanyKind?: 'importer' | 'exporter' | null
): PreparedShipmentEntry {
  let companyKind: string | undefined;
  let companyName: string | undefined;
  let companyCountry: string | undefined;

  if (targetCompanyName && targetCompanyKind) {
    companyName = targetCompanyName;
    companyKind = targetCompanyKind;
    companyCountry = targetCompanyKind === 'importer' 
      ? (sanitizeString(row.importer_country) ?? sanitizeString(row.company_country))
      : (sanitizeString(row.exporter_country) ?? sanitizeString(row.company_country));
  } else {
    if (row.importer_name && !row.exporter_name) {
      companyName = sanitizeString(row.importer_name);
      companyKind = 'importer';
      companyCountry = sanitizeString(row.importer_country);
    } else if (row.exporter_name && !row.importer_name) {
      companyName = sanitizeString(row.exporter_name);
      companyKind = 'exporter';
      companyCountry = sanitizeString(row.exporter_country);
    } else if (row.importer_name && row.exporter_name) {
      companyName = sanitizeString(row.importer_name);
      companyKind = 'importer';
      companyCountry = sanitizeString(row.importer_country);
    } else {
      companyKind = normalizeCompanyKind(row.company_kind);
      companyName = sanitizeString(row.company_name);
      companyCountry = sanitizeString(row.company_country);
    }

    if (!companyName || !companyKind) {
      throw new Error('Campos obrigatórios faltando: company_name, company_kind');
    }
  }

  const normalizedKind = companyKind.toLowerCase() as TradeRole;
  if (normalizedKind !== 'importer' && normalizedKind !== 'exporter') {
    throw new Error('company_kind deve ser "importer" ou "exporter"');
  }

  const company: InsertCompany = {
    name: companyName,
    kind: normalizedKind,
    countryCode: companyCountry ?? 'Unknown',
  };

  let partner: InsertCompany | undefined;
  let partnerKey: string | undefined;

  const partnerKind: TradeRole = normalizedKind === 'importer' ? 'exporter' : 'importer';
  
  let partnerName: string | undefined;
  let partnerCountry: string | undefined;

  if (row.importer_name || row.exporter_name) {
    partnerName = partnerKind === 'exporter' 
      ? sanitizeString(row.exporter_name)
      : sanitizeString(row.importer_name);
    partnerCountry = partnerKind === 'exporter'
      ? sanitizeString(row.exporter_country)
      : sanitizeString(row.importer_country);
  }
  
  if (!partnerName) {
    partnerName = sanitizeString(row.partner_name);
    partnerCountry = sanitizeString(row.partner_country);
  }

  if (partnerName) {
    partner = {
      name: partnerName,
      kind: partnerKind,
      countryCode: partnerCountry ?? 'Unknown',
    };
    partnerKey = buildCompanyKey(partner.name, partner.kind);
  }

  const ets = row.ets ? parseDate(row.ets) : undefined;
  const eta = row.eta ? parseDate(row.eta) : undefined;
  const teus = parseIntegerValue(row.teus);
  const weightKg = parseNumericAsString(row.weight_kg);

  const shipment: ShipmentInsertBase = {
    shipmentNo: sanitizeString(row.shipment_no) ?? generateFallbackShipmentNo(ingestionId, rowNumber),
    ets,
    eta,
    originCountry: sanitizeString(row.origin_country),
    originPort: sanitizeString(row.origin_port),
    destinationCountry: sanitizeString(row.destination_country),
    destinationPort: sanitizeString(row.destination_port),
    hsCode: sanitizeString(row.hs_code),
    hsDescription: sanitizeString(row.hs_description),
    teus,
    weightKg,
    ingestionId,
  };

  return {
    rowNumber,
    originalRow: row,
    company,
    partner,
    companyKey: buildCompanyKey(company.name, company.kind),
    partnerKey,
    shipment,
  };
}

function createErrorLogEntry(
  ingestionId: number,
  rowNumber: number,
  errorMessage: string,
  row: ShipmentRow,
): InsertErrorLog {
  return {
    ingestionId,
    rowNumber,
    errorMessage,
    rowData: JSON.stringify(row),
  };
}

function sanitizeString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function parseIntegerValue(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      const normalized = str.replace(/\./g, '').replace(',', '.');
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    } else {
      const normalized = str.replace(/,/g, '');
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
  } else if (hasComma) {
    const commaPos = str.indexOf(',');
    const digitsAfterComma = str.substring(commaPos + 1).replace(/[^0-9]/g, '').length;
    
    if (digitsAfterComma <= 2) {
      const normalized = str.replace(',', '.');
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    } else {
      const normalized = str.replace(/,/g, '');
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
  }
  
  const normalized = str.replace(/[^0-9-]/g, "");
  if (!normalized) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseNumericAsString(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      const normalized = str.replace(/\./g, '').replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed.toString();
    } else {
      const normalized = str.replace(/,/g, '');
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed.toString();
    }
  } else if (hasComma) {
    const commaPos = str.indexOf(',');
    const digitsAfterComma = str.substring(commaPos + 1).replace(/[^0-9]/g, '').length;
    
    if (digitsAfterComma <= 2) {
      const normalized = str.replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed.toString();
    } else {
      const normalized = str.replace(/,/g, '');
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed.toString();
    }
  }
  
  const normalized = str.replace(/\s+/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed.toString();
}

function generateFallbackShipmentNo(ingestionId: number, rowNumber: number): string {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `SH-${ingestionId}-${rowNumber}-${randomSuffix}`;
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  try {
    if (!isNaN(Number(dateStr))) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Number(dateStr);
      const date = new Date(excelEpoch.getTime() + days * 86400000);
      return date;
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {}

  return undefined;
}

const jobQueue: Array<{ filePath: string; ingestionId: number }> = [];
let isProcessing = false;

export function enqueueJob(filePath: string, ingestionId: number): void {
  jobQueue.push({ filePath, ingestionId });
  processQueue();
}

async function processQueue(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (job) {
      try {
        await processShipmentFile(job.filePath, job.ingestionId);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  }

  isProcessing = false;
}
