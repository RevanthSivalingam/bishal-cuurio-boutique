import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectToggle } from "./select-toggle";
import { useSelection } from "@/components/selection-provider";
import type { NewSelectedItem, SelectedItem } from "@/lib/selection";

vi.mock("@/components/selection-provider", () => ({
  useSelection: vi.fn(),
}));

const item: NewSelectedItem = { id: "1", name: "Brass Vase", price: 450 };

/** quantity 0 means unselected; quantity >= 1 means selected at that quantity. */
function mockSelection(quantity: number) {
  const stored: SelectedItem[] = quantity > 0 ? [{ ...item, quantity }] : [];
  const mock = {
    items: stored,
    add: vi.fn<(item: NewSelectedItem) => void>(),
    remove: vi.fn<(id: string) => void>(),
    increment: vi.fn<(id: string) => void>(),
    decrement: vi.fn<(id: string) => void>(),
    clear: vi.fn<() => void>(),
    has: vi.fn<(id: string) => boolean>(() => quantity > 0),
  };
  vi.mocked(useSelection).mockReturnValue(mock);
  return mock;
}

describe("SelectToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unselected state initially", () => {
    mockSelection(0);
    render(<SelectToggle item={item} />);
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.querySelector("svg")).not.toBeNull(); // the Plus icon
  });

  it("calls add (not increment) when clicked while unselected", async () => {
    const mock = mockSelection(0);
    render(<SelectToggle item={item} />);

    await userEvent.click(screen.getByRole("button"));

    expect(mock.add).toHaveBeenCalledWith(item);
    expect(mock.increment).not.toHaveBeenCalled();
  });

  it("calls increment (not add, not remove) when clicked while already selected", async () => {
    const mock = mockSelection(1);
    render(<SelectToggle item={item} />);

    await userEvent.click(screen.getByRole("button"));

    expect(mock.increment).toHaveBeenCalledWith(item.id);
    expect(mock.add).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("displays the current quantity once selected, and updates as it grows", () => {
    mockSelection(1);
    const { rerender } = render(<SelectToggle item={item} />);
    expect(screen.getByText("1")).toBeInTheDocument();

    mockSelection(3);
    rerender(<SelectToggle item={item} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls e.preventDefault() on click", () => {
    mockSelection(0);
    render(<SelectToggle item={item} />);

    // fireEvent.click dispatches a real, cancelable MouseEvent and returns
    // dispatchEvent's result, which is `false` iff preventDefault() was called.
    const notPrevented = fireEvent.click(screen.getByRole("button"));

    expect(notPrevented).toBe(false);
  });

  it("calls e.stopPropagation() so a click never bubbles to a wrapping card/Link", async () => {
    mockSelection(0);
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
    mockSelection(0);
    render(<SelectToggle item={item} size="lg" />);

    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it('renders visible "Selected" text at size="lg" when selected', () => {
    mockSelection(2);
    render(<SelectToggle item={item} size="lg" />);

    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("does not render Select/Selected text at the default (sm) size", () => {
    mockSelection(0);
    const { rerender } = render(<SelectToggle item={item} />);
    expect(screen.queryByText("Select")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();

    mockSelection(1);
    rerender(<SelectToggle item={item} />);
    expect(screen.queryByText("Select")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
  });
});
