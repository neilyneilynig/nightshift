/**
 * Clean clipboard text before it reaches the shell: drop ESC (so a paste can't
 * close bracketed-paste mode and run commands) and other C0 controls such as
 * Ctrl+C/Ctrl+D, keeping tab, CR and LF.
 */
export function sanitizePaste(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
}
