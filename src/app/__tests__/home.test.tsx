import { render, screen } from "@testing-library/react";
import Home from "../page";

describe("Home", () => {
  it("renders the Phase 0 hero message", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /build the pr review quest/i,
      }),
    ).toBeVisible();
  });

  it("lists upcoming quest steps", () => {
    render(<Home />);

    expect(
      screen.getByText(/Phase 1 · PR URL Intake/i),
    ).toBeInTheDocument();
  });
});
