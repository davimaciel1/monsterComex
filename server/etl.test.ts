import { describe, expect, it } from "vitest";
import { prepareShipmentEntry, parseIntegerValue, parseNumericAsString } from "./etl";

describe("prepareShipmentEntry", () => {
  it("uses ingestion target importer and maps exporter as partner", () => {
    const row: any = {
      importer_name: "TRD",
      importer_country: "BR",
      exporter_name: "ACME EXPORT",
      exporter_country: "US",
      company_country: "BR",
      teus: "1,00",
      weight_kg: "27.300,00",
    };

    const prepared = prepareShipmentEntry(row, 1, 99, "TRD", "importer");

    expect(prepared.company.name).toBe("TRD");
    expect(prepared.company.kind).toBe("importer");
    expect(prepared.company.countryCode).toBe("BR");
    expect(prepared.partner?.name).toBe("ACME EXPORT");
    expect(prepared.partner?.kind).toBe("exporter");
    expect(prepared.partner?.countryCode).toBe("US");
    expect(prepared.shipment.teus).toBe(1);
    expect(prepared.shipment.weightKg).toBe("27300");
  });

  it("infers importer company when company kind is absent", () => {
    const row: any = {
      importer_name: "TRD COMERCIO",
      importer_country: "BR",
      exporter_name: "ACME EXPORT",
      exporter_country: "US",
      weight_kg: "1.250,50",
      teus: "2",
    };

    const prepared = prepareShipmentEntry(row, 2, 99);

    expect(prepared.company.name).toBe("TRD COMERCIO");
    expect(prepared.company.kind).toBe("importer");
    expect(prepared.partner?.name).toBe("ACME EXPORT");
    expect(prepared.partner?.kind).toBe("exporter");
    expect(prepared.partner?.countryCode).toBe("US");
    expect(prepared.shipment.teus).toBe(2);
    expect(prepared.shipment.weightKg).toBe("1250.5");
  });

  it("uses exporter as target and maps importer as partner", () => {
    const row: any = {
      importer_name: "ACME IMPORTS",
      importer_country: "US",
      exporter_name: "GLOBAL EXPORTS",
      exporter_country: "BR",
      teus: "2",
      weight_kg: "1,234.56",
    };

    const prepared = prepareShipmentEntry(row, 3, 99, "GLOBAL EXPORTS", "exporter");

    expect(prepared.company.name).toBe("GLOBAL EXPORTS");
    expect(prepared.company.kind).toBe("exporter");
    expect(prepared.partner?.name).toBe("ACME IMPORTS");
    expect(prepared.partner?.kind).toBe("importer");
    expect(prepared.shipment.teus).toBe(2);
  });

  it("falls back to partner_name when importer/exporter fields are missing", () => {
    const row: any = {
      importer_name: "TRD",
      importer_country: "BR",
      partner_name: "FALLBACK PARTNER",
      partner_country: "US",
      teus: "1",
    };

    const prepared = prepareShipmentEntry(row, 4, 99, "TRD", "importer");

    expect(prepared.company.name).toBe("TRD");
    expect(prepared.partner?.name).toBe("FALLBACK PARTNER");
    expect(prepared.partner?.kind).toBe("exporter");
    expect(prepared.partner?.countryCode).toBe("US");
  });
});

describe("numeric parsing helpers", () => {
  it("parses Brazilian format with comma as decimal", () => {
    expect(parseIntegerValue("1,00")).toBe(1);
    expect(parseNumericAsString("12,5")).toBe("12.5");
  });

  it("parses Brazilian format with dot as thousands", () => {
    expect(parseIntegerValue("12.345")).toBe(12345);
    expect(parseNumericAsString("27.300,00")).toBe("27300");
  });

  it("parses US format with comma and dot", () => {
    expect(parseNumericAsString("1,234.56")).toBe("1234.56");
    expect(parseIntegerValue("1,234.56")).toBe(1235);
  });

  it("handles Brazilian format with both separators", () => {
    expect(parseIntegerValue("1.234,56")).toBe(1235);
    expect(parseNumericAsString("1.234,56")).toBe("1234.56");
  });
});
