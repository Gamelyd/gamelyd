"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export type DateFieldChange = { target: { value: string } };

type FieldProps = {
  label?: string;
  value: string;
  onChange: (event: DateFieldChange) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  className?: string;
  placeholder?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function parseTime(value: string): { h: number; min: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

function toDateValue(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function toTimeValue(h: number, min: number): string {
  return `${pad(h)}:${pad(min)}`;
}

function formatDateLabel(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return `${parsed.d} ${MONTHS_SHORT[parsed.m - 1]} ${parsed.y}`;
}

function formatTimeLabel(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return "";
  return toTimeValue(parsed.h, parsed.min);
}

function formatDateTimeLabel(value: string): string {
  const date = formatDateLabel(value);
  const timePart = value.includes("T") ? value.slice(value.indexOf("T") + 1) : "";
  const time = formatTimeLabel(timePart);
  if (date && time) return `${date} · ${time}`;
  return date || time;
}

function dateKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

function compareDate(value: string, bound?: string): number {
  if (!bound) return 0;
  const a = parseDate(value);
  const b = parseDate(bound);
  if (!a || !b) return 0;
  return dateKey(a.y, a.m, a.d) - dateKey(b.y, b.m, b.d);
}

function monthCells(y: number, m: number): Array<{ y: number; m: number; d: number } | null> {
  const first = new Date(y, m - 1, 1);
  const padStart = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: Array<{ y: number; m: number; d: number } | null> = [];
  for (let i = 0; i < padStart; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push({ y, m, d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function todayParts(): { y: number; m: number; d: number; h: number; min: number } {
  const now = new Date();
  return {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
    h: now.getHours(),
    min: now.getMinutes(),
  };
}

function emit(onChange: (event: DateFieldChange) => void, value: string) {
  onChange({ target: { value } });
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.5 10h17M8 3.5v4M16 3.5v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5V12l3.2 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldShell({
  label,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="block w-full">
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-label">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-xs text-lose">{error}</span> : null}
    </div>
  );
}

function PickerPopover({
  open,
  trigger,
  onClose,
  children,
}: {
  open: boolean;
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 8,
    width: 320,
    place: "bottom" as "bottom" | "top",
    mobile: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const update = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 640;
      if (mobile) {
        setPos({ top: 0, left: 0, width: vw, place: "bottom", mobile: true });
        return;
      }
      const width = Math.min(340, Math.max(rect.width, 300));
      const spaceBelow = vh - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const place = spaceBelow < 300 && spaceAbove > spaceBelow ? "top" : "bottom";
      let left = rect.left;
      if (left + width > vw - 8) left = vw - 8 - width;
      if (left < 8) left = 8;
      setPos({
        top: place === "bottom" ? rect.bottom + 8 : rect.top - 8,
        left,
        width,
        place,
        mobile: false,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, trigger]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (trigger.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, onClose, trigger]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250]">
      {pos.mobile ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Close picker"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={pos.mobile}
        className={`border border-surface-2 bg-surface shadow-2xl ${
          pos.mobile
            ? "absolute inset-x-0 bottom-0 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "absolute rounded-2xl p-4"
        }`}
        style={
          pos.mobile
            ? undefined
            : {
                top: pos.place === "bottom" ? pos.top : undefined,
                bottom: pos.place === "top" ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: pos.width,
              }
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CalendarGrid({
  value,
  min,
  max,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  onPick: (next: string) => void;
}) {
  const selected = parseDate(value);
  const today = todayParts();
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.y,
    m: selected?.m ?? today.m,
  }));

  useEffect(() => {
    if (selected) setView({ y: selected.y, m: selected.m });
  }, [selected?.y, selected?.m]);

  const shift = (delta: number) => {
    const date = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: date.getFullYear(), m: date.getMonth() + 1 });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-11 w-11 place-items-center rounded-lg text-white hover:bg-white/5"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-white">
          {MONTHS[view.m - 1]} {view.y}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-11 w-11 place-items-center rounded-lg text-white hover:bg-white/5"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-body"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthCells(view.y, view.m).map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} />;
          }
          const next = toDateValue(cell.y, cell.m, cell.d);
          const isSelected =
            selected &&
            selected.y === cell.y &&
            selected.m === cell.m &&
            selected.d === cell.d;
          const isToday =
            today.y === cell.y && today.m === cell.m && today.d === cell.d;
          const blocked =
            compareDate(next, min) < 0 || compareDate(next, max) > 0;
          return (
            <button
              key={next}
              type="button"
              disabled={blocked}
              onClick={() => onPick(next)}
              className={`grid h-11 place-items-center rounded-lg text-sm transition-colors ${
                isSelected
                  ? "bg-primary font-semibold text-on-primary"
                  : blocked
                    ? "cursor-not-allowed text-body/30"
                    : isToday
                      ? "text-white ring-1 ring-primary/50 hover:bg-white/5"
                      : "text-white hover:bg-white/5"
              }`}
            >
              {cell.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  value,
  onPick,
}: {
  value: string;
  onPick: (next: string) => void;
}) {
  const parsed = parseTime(value);
  const hour = parsed ? pad(parsed.h) : "";
  const minute = parsed ? pad(parsed.min) : "";
  const minuteOptions = MINUTES.includes(minute) || !minute
    ? MINUTES
    : [...MINUTES, minute].sort();

  const pick = (nextHour: string, nextMinute: string) => {
    if (!nextHour || !nextMinute) return;
    onPick(`${nextHour}:${nextMinute}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <ScrollChoices
        label="Hour"
        options={HOURS}
        value={hour}
        onPick={(next) => pick(next, minute || "00")}
      />
      <ScrollChoices
        label="Minute"
        options={minuteOptions}
        value={minute}
        onPick={(next) => pick(hour || pad(todayParts().h), next)}
      />
    </div>
  );
}

function ScrollChoices({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: string[];
  value: string;
  onPick: (next: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = activeRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    parent.scrollTop =
      node.offsetTop - parent.clientHeight / 2 + node.clientHeight / 2;
  }, [value]);

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-body">
        {label}
      </p>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-surface-2 bg-input p-1">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onPick(option)}
              className={`flex h-10 w-full items-center justify-center rounded-lg text-sm ${
                active
                  ? "bg-primary font-semibold text-on-primary"
                  : "text-white hover:bg-white/5"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function usePicker(onBlur?: () => void) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (!open) return;
    setOpen(false);
    onBlur?.();
  };

  return { open, setOpen, close, triggerRef };
}

function TriggerButton({
  id,
  open,
  disabled,
  error,
  className,
  display,
  placeholder,
  icon,
  triggerRef,
  onClick,
}: {
  id?: string;
  open: boolean;
  disabled?: boolean;
  error?: string;
  className: string;
  display: string;
  placeholder: string;
  icon: ReactNode;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-input px-4 py-3 text-left text-sm outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
        error ? "border-lose" : open ? "border-primary" : "border-primary/25"
      } ${className}`}
    >
      <span className={display ? "text-white" : "text-body/50"}>
        {display || placeholder}
      </span>
      {icon}
    </button>
  );
}

export function DateInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  required,
  min,
  max,
  name,
  id,
  className = "",
  placeholder = "Select date",
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const { open, setOpen, close, triggerRef } = usePicker(onBlur);

  return (
    <FieldShell label={label} error={error} htmlFor={fieldId}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <TriggerButton
        id={fieldId}
        open={open}
        disabled={disabled}
        error={error}
        className={className}
        display={formatDateLabel(value)}
        placeholder={placeholder}
        icon={<CalendarIcon />}
        triggerRef={triggerRef}
        onClick={() => (open ? close() : setOpen(true))}
      />
      <PickerPopover open={open} trigger={triggerRef} onClose={close}>
        <CalendarGrid
          value={value}
          min={min}
          max={max}
          onPick={(next) => {
            emit(onChange, next);
            close();
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          {!required ? (
            <button
              type="button"
              className="text-xs text-body hover:text-white"
              onClick={() => {
                emit(onChange, "");
                close();
              }}
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => {
              const today = todayParts();
              const next = toDateValue(today.y, today.m, today.d);
              if (compareDate(next, min) < 0 || compareDate(next, max) > 0) return;
              emit(onChange, next);
              close();
            }}
          >
            Today
          </button>
        </div>
      </PickerPopover>
    </FieldShell>
  );
}

export function TimeInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  required,
  name,
  id,
  className = "",
  placeholder = "Select time",
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const { open, setOpen, close, triggerRef } = usePicker(onBlur);

  return (
    <FieldShell label={label} error={error} htmlFor={fieldId}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <TriggerButton
        id={fieldId}
        open={open}
        disabled={disabled}
        error={error}
        className={className}
        display={formatTimeLabel(value)}
        placeholder={placeholder}
        icon={<ClockIcon />}
        triggerRef={triggerRef}
        onClick={() => (open ? close() : setOpen(true))}
      />
      <PickerPopover open={open} trigger={triggerRef} onClose={close}>
        <TimeGrid value={value} onPick={(next) => emit(onChange, next)} />
        <div className="mt-3 flex items-center justify-between gap-2">
          {!required ? (
            <button
              type="button"
              className="text-xs text-body hover:text-white"
              onClick={() => {
                emit(onChange, "");
                close();
              }}
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
            onClick={close}
          >
            Done
          </button>
        </div>
      </PickerPopover>
    </FieldShell>
  );
}

export function DateTimeInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  required,
  min,
  max,
  name,
  id,
  className = "",
  placeholder = "Select date and time",
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const { open, setOpen, close, triggerRef } = usePicker(onBlur);
  const dateValue = parseDate(value) ? value.slice(0, 10) : "";
  const timeValue = parseTime(value.slice(value.indexOf("T") + 1))
    ? formatTimeLabel(value.slice(value.indexOf("T") + 1))
    : "";

  const commit = (date: string, time: string) => {
    if (!date) {
      emit(onChange, "");
      return;
    }
    emit(onChange, `${date}T${time || "00:00"}`);
  };

  return (
    <FieldShell label={label} error={error} htmlFor={fieldId}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <TriggerButton
        id={fieldId}
        open={open}
        disabled={disabled}
        error={error}
        className={className}
        display={formatDateTimeLabel(value)}
        placeholder={placeholder}
        icon={<CalendarIcon />}
        triggerRef={triggerRef}
        onClick={() => (open ? close() : setOpen(true))}
      />
      <PickerPopover open={open} trigger={triggerRef} onClose={close}>
        <CalendarGrid
          value={dateValue}
          min={min}
          max={max}
          onPick={(next) => commit(next, timeValue)}
        />
        <div className="mt-4">
          <TimeGrid
            value={timeValue}
            onPick={(next) => commit(dateValue || toDateValue(todayParts().y, todayParts().m, todayParts().d), next)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {!required ? (
            <button
              type="button"
              className="text-xs text-body hover:text-white"
              onClick={() => {
                emit(onChange, "");
                close();
              }}
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
            onClick={close}
          >
            Done
          </button>
        </div>
      </PickerPopover>
    </FieldShell>
  );
}
