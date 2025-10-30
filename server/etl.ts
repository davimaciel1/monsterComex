import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

interface ShipmentRow {
  company_name?: string;
  company_kind?: string;
  company_country?: string;
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
  nomeexportador: "company_name",
  exportador: "company_name",
  consignatario: "partner_name",
  importador: "partner_name",
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

  // Infer company_kind if not present: if we have company_name, assume exporter
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
    // Update ingestion status to processing
    await storage.updateIngestion(ingestionId, {
      status: 'processing',
      startedAt: new Date(),
    });

    // Read the file based on extension
    const ext = path.extname(filePath).toLowerCase();
    let rows: ShipmentRow[] = [];

    if (ext === '.csv') {
      rows = await readCSVFile(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = await readExcelFile(filePath);
    } else {
      throw new Error('Formato de arquivo não suportado');
    }

    rows = normalizeShipmentRows(rows);

    // Process each row
    let rowsOk = 0;
    let rowsFailed = 0;
    const totalRows = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        await processShipmentRow(row, ingestionId);
        rowsOk++;
      } catch (error: any) {
        rowsFailed++;
        
        // Log the error
        await storage.createErrorLog({
          ingestionId,
          rowNumber,
          errorMessage: error.message,
          rowData: JSON.stringify(row),
        });
      }
    }

    // Update ingestion as done
    await storage.updateIngestion(ingestionId, {
      status: 'done',
      completedAt: new Date(),
      rowsTotal: totalRows,
      rowsOk,
      rowsFailed,
    });

    // Delete the uploaded file
    fs.unlinkSync(filePath);

  } catch (error: any) {
    // Update ingestion as failed
    await storage.updateIngestion(ingestionId, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: error.message,
    });

    // Try to delete the file even if processing failed
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
}

async function readExcelFile(filePath: string): Promise<ShipmentRow[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const data = XLSX.utils.sheet_to_json<ShipmentRow>(worksheet, {
    raw: false,
    defval: undefined,
  });
  
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

async function processShipmentRow(row: ShipmentRow, ingestionId: number): Promise<void> {
  // Validate required fields
  const companyKind = normalizeCompanyKind(row.company_kind);

  if (!row.company_name || !companyKind) {
    throw new Error('Campos obrigatórios faltando: company_name, company_kind');
  }

  if (!['importer', 'exporter'].includes(companyKind)) {
    throw new Error('company_kind deve ser "importer" ou "exporter"');
  }

  // Get or create company
  const company = await storage.getOrCreateCompany(
    row.company_name.trim(),
    companyKind as 'importer' | 'exporter',
    row.company_country?.trim() || 'Unknown'
  );

  // Get or create partner company (if provided)
  let partnerId: number | undefined = undefined;
  if (row.partner_name) {
    const partnerKind = company.kind === 'importer' ? 'exporter' : 'importer';
    const partner = await storage.getOrCreateCompany(
      row.partner_name.trim(),
      partnerKind,
      row.partner_country?.trim() || 'Unknown'
    );
    partnerId = partner.id;
  }

  // Parse dates
  const ets = row.ets ? parseDate(row.ets) : undefined;
  const eta = row.eta ? parseDate(row.eta) : undefined;

  // Parse numeric fields
  const teus = row.teus ? parseInt(String(row.teus)) : undefined;
  const weightKg = row.weight_kg ? parseFloat(String(row.weight_kg)) : undefined;

  // Create shipment
  await storage.createShipment({
    companyId: company.id,
    shipmentNo: row.shipment_no?.trim() || `SH-${Date.now()}-${Math.random()}`,
    ets,
    eta,
    partnerId,
    originCountry: row.origin_country?.trim(),
    originPort: row.origin_port?.trim(),
    destinationCountry: row.destination_country?.trim(),
    destinationPort: row.destination_port?.trim(),
    hsCode: row.hs_code?.trim(),
    hsDescription: row.hs_description?.trim(),
    teus: teus && !isNaN(teus) ? teus : undefined,
    weightKg: weightKg && !isNaN(weightKg) ? String(weightKg) : undefined,
    ingestionId,
  });
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  // Try to parse the date
  try {
    // Excel serial date number
    if (!isNaN(Number(dateStr))) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Number(dateStr);
      const date = new Date(excelEpoch.getTime() + days * 86400000);
      return date;
    }

    // ISO date string
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {}

  return undefined;
}

// Simple in-memory job queue
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
