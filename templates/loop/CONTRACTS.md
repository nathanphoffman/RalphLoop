# Contracts

The shared interfaces the areas build against. Round 0 (if enabled) turns the interfaces below into compiling stubs.
After that nobody edits the shared interfaces except the merge/plan step: to change one, add a line under "Requests"
at the bottom and the next merge applies it. Areas may only *add* to a shared interface, never change or remove.

## Ownership (disjoint)
| Area | Owns (may edit freely) |
|---|---|
| `<area-1>` | `<path/**>` |
| `<area-2>` | `<path/**>` |

Each area also owns its own `tasks/<area>.md`. Nobody else touches it.

**Integration points** (shared files many areas edit): append-only, one line or one small change each, mention it in the commit message.
- `<file>`

## Shared interfaces
List every type, function signature, message or file format that more than one area depends on. Be exact: names, fields, units.
- ...

## Requests
(Workers add one line here when they need a shared interface changed. The merge step applies and clears them.)
