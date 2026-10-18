const paths: Record<string, string> = {
  search: "m21 21-4.5-4.5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  calendar: "M4 5h16v16H4z M4 9h16 M8 2v6 M16 2v6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  palette:
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-2-1-1-3 1-3h3c5 0 3-11-6-11Z M7 9h.01 M10 6h.01 M15 7h.01 M18 10h.01",
  cup: "M4 4h12v9a6 6 0 0 1-12 0Z M16 6h2a3 3 0 0 1 0 6h-2 M3 22h15",
  leaf: "M20 3C8 2 2 7 4 15s17 8 16-12Z M4 21 16 8 M9 16v-5 M9 16h5",
  ticket: "M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z M15 5v3 m0 3v2 m0 3v3",
  tools: "m4 20 8-8 M14 3a6 6 0 0 0-2 9 6 6 0 0 0 9-2l-4 1-4-4Z M3 17l4 4",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 m0 16v2 M2 12h2 m16 0h2 M5 5l2 2 m10 10 2 2 M5 19l2-2 M17 7l2-2",
  users:
    "M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3 M19 4a3 3 0 0 1 0 6 M22 20v-3a5 5 0 0 0-2-4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M18 6 6 18",
  chevron: "m8 4 8 8-8 8",
};
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.arrow} />
    </svg>
  );
}
