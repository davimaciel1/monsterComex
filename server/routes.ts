import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { upload } from "./upload";
import { enqueueJob } from "./etl";

export async function registerRoutes(app: Express): Promise<Server> {
  // Company search API
  app.get("/api/companies/search", async (req, res) => {
    try {
      const query = String(req.query.q || "");
      const limit = parseInt(String(req.query.limit || "10"));
      
      if (!query.trim()) {
        return res.json([]);
      }
      
      const results = await storage.searchCompanies(query, limit);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company by ID
  app.get("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompanyById(id);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company stats (KPIs)
  app.get("/api/companies/:id/stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await storage.getCompanyStats(id);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company shipments over time (for charts)
  app.get("/api/companies/:id/shipments-over-time", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getCompanyShipmentsOverTime(id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company top partners
  app.get("/api/companies/:id/top-partners", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || "5"));
      const data = await storage.getTopPartners(id, limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company top origin countries
  app.get("/api/companies/:id/top-origin-countries", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || "5"));
      const data = await storage.getTopOriginCountries(id, limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company top destination ports
  app.get("/api/companies/:id/top-destination-ports", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || "5"));
      const data = await storage.getTopDestinationPorts(id, limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company top HS codes
  app.get("/api/companies/:id/top-hs-codes", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || "5"));
      const data = await storage.getTopHSCodes(id, limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get company shipments (paginated)
  app.get("/api/companies/:id/shipments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(String(req.query.limit || "10"));
      const offset = parseInt(String(req.query.offset || "0"));
      
      const result = await storage.getShipmentsByCompanyId(id, limit, offset);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all ingestions
  app.get("/api/ingestions", async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit || "20"));
      const offset = parseInt(String(req.query.offset || "0"));
      
      const result = await storage.getIngestions(limit, offset);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get ingestion by ID
  app.get("/api/ingestions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ingestion = await storage.getIngestionById(id);
      
      if (!ingestion) {
        return res.status(404).json({ message: "Ingestion not found" });
      }
      
      res.json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get ingestion error logs
  app.get("/api/ingestions/:id/errors", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const errors = await storage.getErrorLogsByIngestionId(id);
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create new ingestion (file upload will be handled separately)
  app.post("/api/ingestions", async (req, res) => {
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
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update ingestion status
  app.patch("/api/ingestions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ingestion = await storage.updateIngestion(id, req.body);
      res.json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Upload file for processing
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      // Create ingestion record
      const ingestion = await storage.createIngestion({
        filename: req.file.originalname,
        status: 'queued',
        rowsTotal: 0,
        rowsOk: 0,
        rowsFailed: 0,
      });
      
      // Enqueue job for background processing
      enqueueJob(req.file.path, ingestion.id);
      
      res.status(201).json(ingestion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
