

import React from "react";

type IconProps = {
  className?: string;
};

export function InstagramIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function TikTokIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M14.5 3c.35 1.82 1.41 3.2 3.5 3.54V9.1c-1.24-.04-2.37-.38-3.5-1.05v6.35c0 3.2-2.03 5.6-5.45 5.6-1.39 0-2.56-.43-3.5-1.18C4.48 17.93 4 16.63 4 15.2c0-3.12 2.3-5.51 5.65-5.51.3 0 .56.02.83.08v2.74a3.56 3.56 0 0 0-.8-.1c-1.78 0-2.92 1.25-2.92 2.76 0 1.62 1.17 2.73 2.71 2.73 1.62 0 2.51-1.03 2.51-3.2V3h2.52z" />
    </svg>
  );
}

export function FacebookIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.25-1.46 1.5-1.46H16.7V5a22.6 22.6 0 0 0-2.43-.12c-2.4 0-4.04 1.47-4.04 4.17V11H7.5v3h2.73v8h3.27z" />
    </svg>
  );
}

export function WhatsAppIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.97L0 24l6.32-1.66a11.9 11.9 0 0 0 5.74 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42Zm-8.45 18.3h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.75.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.23c0-5.46 4.44-9.9 9.91-9.9 2.64 0 5.11 1.02 6.98 2.89a9.8 9.8 0 0 1 2.9 7c0 5.46-4.45 9.9-9.88 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.37-1.47-.88-.78-1.47-1.74-1.64-2.04-.17-.3-.02-.46.12-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.08-.8.38-.27.3-1.05 1.03-1.05 2.5 0 1.47 1.08 2.89 1.23 3.1.15.2 2.11 3.22 5.12 4.52.72.31 1.29.5 1.72.64.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.31.17-1.43-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}