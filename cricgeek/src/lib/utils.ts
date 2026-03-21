import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function getMatchTypeColor(type: string): string {
  switch (type?.toUpperCase()) {
    case "T20":
    case "T20I":
    case "T10":
      return "bg-green-600";
    case "ODI":
    case "ODI-W":
    case "LIST A":
      return "bg-blue-600";
    case "TEST":
    case "TEST-W":
    case "4-DAY":
    case "FC":
      return "bg-red-700";
    case "IPL":
    case "100-BALL":
      return "bg-amber-500";
    default:
      return "bg-gray-600";
  }
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
