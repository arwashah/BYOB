"use client";

import { useSyncExternalStore } from "react";
import { touchLocal } from "./useProfile";

// BYOB never touches the money: the user sets up a recurring transfer in their own
// bank app, and ticks a box here. That tick lives only in this browser.

const key = (name: string) => `byob-autosave:${name}`;
const EVENT = "byob-autosave";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
};

export function useAutoSave(name: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key(name)) === "on";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (value: boolean) => {
    try {
      if (value) localStorage.setItem(key(name), "on");
      else localStorage.removeItem(key(name));
    } catch {}
    touchLocal();
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

// Next date (today or later) that falls on this day of the month.
export function nextDayOfMonth(day: number, from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), day);
  if (d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) d.setMonth(d.getMonth() + 1);
  return d;
}

// Monthly all-day calendar reminder (.ics). Works in Google Calendar, Outlook and Apple Calendar.
export function buildReminder(amount: number, day: number, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BYOB//Auto-save reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:byob-autosave-${now.getTime()}@byob`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(nextDayOfMonth(day, now))}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
    `SUMMARY:BYOB: move $${amount} to your BYOB fund`,
    "DESCRIPTION:Check your recurring transfer went through. BYOB never moves or holds your money.",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadReminder(amount: number, day: number) {
  const url = URL.createObjectURL(new Blob([buildReminder(amount, day)], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "byob-reminder.ics" });
  document.body.appendChild(a); // Firefox only follows links that are in the page
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // revoking right away can cancel the download
}
