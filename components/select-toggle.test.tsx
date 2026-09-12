import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectToggle } from "./select-toggle";
import { useSelection } from "@/components/selection-provider";
import type { SelectedItem } from "@/lib/selection";

vi.mock("@/components/selection-provider", () => ({
  useSelection: vi.fn(),
}));

const item: SelectedItem = { id: "1", name: "Brass Vase", price: 450 };

function mockSelection(selected: boolean) {
  const mock = {
    items: selected ? [item] : [],
    add: vi.fn<(item: SelectedItem) => void>(),
    remove: vi.fn<(id: string) => void>(),
    clear: vi.fn<() => void>(),
    has: vi.fn<(id: string) => boolean>(() => selected),
  };
  vi.mocked(useSelection).mockReturnValue(mock);
  return mock;
}

describe("SelectToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unselected state initially", () => {
    mockSelection(false);
    render(<SelectToggle item={item} />);
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("calls add (not remove) when clicked while unselected", async () => {
    const mock = mockSelection(false);
    render(<SelectToggle item={item} />);

    await userEvent.click(screen.getByRole("button"));

    expect(mock.add).toHaveBeenCalledWith(item);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("calls remove (not add) when clicked while selected", async () => {
    const mock = mockSelection(true);
    render(<SelectToggle item={item} />);

    await userEvent.click(screen.getByRole("button"));

    expect(mock.remove).toHaveBeenCalledWith(item.id);
    expect(mock.add).not.toHaveBeenCalled();
  });

  it("calls e.preventDefault() on click", () => {
    mockSelection(false);
    render(<SelectToggle item={item} />);

    // fireEvent.click dispatches a real, cancelable MouseEvent and returns
    // dispatchEvent's result, which is `false` iff preventDefault() was called.
    const notPrevented = fireEvent.click(screen.getByRole("button"));

    expect(notPrevented).toBe(false);
  });

  it("calls e.stopPropagation() so a click never bubbles to a wrapping card/Link", async () => {
    mockSelection(false);
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick}>
        <SelectToggle item={item} />
      </div>
    );

    await userEvent.click(screen.getByRole("button"));

    expect(outerClick).not.toHaveBeenCalled();
  });

  it('renders visible "Select" text at size="lg" when unselected', () => {
    mockSelection(false);
    render(<SelectToggle item={item} size="lg" />);

    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it('renders visible "Selected" text at size="lg" when selected', () => {
    mockSelection(true);
    render(<SelectToggle item={item} size="lg" />);

    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("does not render Select/Selected text at the default (sm) size", () => {
    mockSelection(false);
    const { rerender } = render(<SelectToggle item={item} />);
    expect(screen.queryByText("Select")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();

    mockSelection(true);
    rerender(<SelectToggle item={item} />);
    expect(screen.queryByText("Select")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
  });
});
