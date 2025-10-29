import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import type { Ingestion } from "@shared/schema";

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
  if (!row.company_name || !row.company_kind) {
    throw new Error('Campos obrigatórios faltando: company_name, company_kind');
  }

  if (!['importer', 'exporter'].includes(row.company_kind.toLowerCase())) {
    throw new Error('company_kind deve ser "importer" ou "exporter"');
  }

  // Get or create company
  const company = await storage.getOrCreateCompany(
    row.company_name.trim(),
    row.company_kind.toLowerCase() as 'importer' | 'exporter',
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
