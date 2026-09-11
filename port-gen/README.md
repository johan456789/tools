# port-gen

Deterministic port generator: type a project name, get a stable port in range 1024–49151.

## Algorithm

1. Compute CRC-32 (IEEE, polynomial `0xEDB88320`) over the UTF-8 bytes of the exact project name (case-sensitive, spaces count).
2. Take the unsigned decimal representation (e.g. `1234567890`).
3. Slide a 4-digit window from right to left; the first window within 1024–49151 wins.
4. If no 4-digit window matches, repeat with a 5-digit window.
5. If still nothing matches, the UI reports: "No deterministic port can be generated for …".

## Notes

- Fully static, runs in the browser, no dependencies.
- Small state (project name) is shared via `?name=…`; the last-used name is also kept in localStorage under `tools:port-gen:last-name`.
