# Stage background clips

One looping clip per tab, played behind the lit slab at the top of each screen.

| File | Tab | Look |
|---|---|---|
| `dashboard.mp4` | Дашборд | three slow lights drifting over carbon, the widest palette |
| `workouts.mp4` | Тренировки | hot volt and flame, fast diagonal sweep reading as speed |
| `nutrition.mp4` | Питание | cool aqua rising slowly, like steam off a plate |
| `profile.mp4` | Профиль | one barely-moving volt light, the quietest of the four |

## Rules

- **Optional.** Delete any file and that tab silently falls back to the painted
  CSS backdrop, which carries the same palette and motion. Nothing breaks.
- **Seamless.** Each clip is a palindrome (forward then reversed), so it loops
  with no visible cut.
- **Muted and decorative.** They carry no information, sit behind a dark veil,
  and are skipped entirely under `prefers-reduced-motion`.
- **Keep them small.** These are ~200-400 KB each at 1280x720. A multi-megabyte
  clip would wreck first paint for a background nobody looks at directly.

## Replacing one

Drop a new `.mp4` with the same filename. Recommended: 1280x720, 24 fps,
10-20 seconds, H.264, `-movflags +faststart`, no audio track. Dark source
footage works best, since the veil above it is what keeps the text readable.
