import { render, screen } from "@testing-library/react";
import { ShipmentsTable } from "../ShipmentsTable";
import "@testing-library/jest-dom/vitest";

describe("ShipmentsTable", () => {
  it("renders empty state and locks pagination when there are no shipments", () => {
    render(<ShipmentsTable shipments={[]} />);

    expect(screen.getByText("Nenhum embarque encontrado.")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 0-0 de 0 embarques/i)).toBeInTheDocument();
    expect(screen.getByText(/Página 0 de 0/i)).toBeInTheDocument();
    expect(screen.getByTestId("button-prev-page")).toBeDisabled();
    expect(screen.getByTestId("button-next-page")).toBeDisabled();
  });
});
