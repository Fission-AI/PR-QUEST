import { fireEvent, render, screen } from "@testing-library/react";
import Home from "../page";

describe("Home", () => {
  it("renders the hero masthead", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /pr quest/i,
      }),
    ).toBeVisible();
  });

  it("shows the onboarding subtitle", () => {
    render(<Home />);

    expect(
      screen.getByText(/transform boring code reviews into epic adventures/i),
    ).toBeInTheDocument();
  });

  it("enables Analyze only when the PR URL is valid", () => {
    render(<Home />);

    const analyzeButton = screen.getByRole("button", { name: /begin your quest/i });
    const input = screen.getByLabelText(/github pull request url/i);

    expect(analyzeButton).toBeDisabled();

    fireEvent.change(input, {
      target: { value: "https://github.com/octocat/hello-world/pull/101" },
    });

    expect(analyzeButton).not.toBeDisabled();
    expect(
      screen.getByText(/Derived diff endpoint/i),
    ).toHaveTextContent("https://github.com/octocat/hello-world/pull/101.diff");
  });
});
