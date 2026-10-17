// Languages the user can get their AI answers in. The value is what the server
// puts in the prompt ("Write all text for the user in {language}").
export const LANGUAGES: { value: string; label: string }[] = [
  { value: "English", label: "English" },
  { value: "French", label: "Français" },
  { value: "Punjabi", label: "ਪੰਜਾਬੀ" },
  { value: "Tagalog", label: "Tagalog" },
  { value: "Arabic", label: "العربية" },
  { value: "Chinese", label: "中文" },
  { value: "Spanish", label: "Español" },
];

const RTL = new Set(["Arabic"]);

// For blocks of AI-written text only; numbers and the English claim letter stay LTR.
export const textDir = (language?: string): "rtl" | "ltr" => (language && RTL.has(language) ? "rtl" : "ltr");
