import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  run: () => void;
};

type CommandBarProps = {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
};

export default function CommandBar({ open, commands, onClose }: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 120);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const filteredCommands = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter(
      (command) =>
        command.title.toLowerCase().includes(normalized) ||
        (command.subtitle ?? "").toLowerCase().includes(normalized)
    );
  }, [commands, debouncedQuery]);

  useEffect(() => {
    if (!open || filteredCommands.length === 0) {
      return;
    }
    setSelectedIndex((prev) => Math.min(prev, filteredCommands.length - 1));
  }, [filteredCommands.length, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedIndex(0);
  }, [debouncedQuery, open]);

  const runSelectedCommand = () => {
    const command = filteredCommands[selectedIndex];
    if (!command) {
      return;
    }
    command.run();
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, filteredCommands.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runSelectedCommand();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="command-bar"
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          autoFocus
          className="command-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command..."
        />

        <div className="command-list" role="listbox" aria-label="Commands">
          {filteredCommands.map((command, index) => (
            <button
              key={command.id}
              className={`command-item ${index === selectedIndex ? "active" : ""}`}
              role="option"
              aria-selected={index === selectedIndex}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              <span className="command-item-main">
                <span className="command-item-title">{command.title}</span>
                {command.subtitle && <span className="command-item-subtitle">{command.subtitle}</span>}
              </span>
              {command.shortcut && <span className="command-item-shortcut">{command.shortcut}</span>}
            </button>
          ))}
          {filteredCommands.length === 0 && <div className="muted">No command found</div>}
        </div>
      </div>
    </div>
  );
}
