# CoE5 Modding

Write Conquest of Elysium 5 mods with the editor at your side: every mod command, vanilla and CoE5SE, completes as you type, explains itself on hover, and gets checked before the game ever reads it.

## Install

- **Cursor, VSCodium, Windsurf:** search "CoE5 Modding" in the Extensions panel.
- **VS Code:** download `coe5-modding.vsix` from the [latest release](https://github.com/musical-pianist/coe5se-modding/releases/latest), then run "Extensions: Install from VSIX...".

## Features

- **Autocomplete.** Start a line and pick from every mod command that fits the block you're in. Open a quote and pick a monster, weapon, item or spell by string, from vanilla or from your own mod's files.
- **Hover help.** Hover a mod command for what it does and each argument by name, with a link to its docs entry. A number that stands for a resource, plane or terrain shows what it means.
- **Go to definition.** Jump from a name in quotes to where your mod declares it, in any file of your workspace.
- **Errors before the game sees them.** A misspelled mod command, a quote that never closes, or `--` used as a comment is flagged where you typed it, with the fix one click away.
- **CoE5SE's rules.** It knows which mod commands stay in your .c5m, which go in your .c5se, and which lines need `#!@`, and adds the prefix for you. `if`, `elseif` and `else` each get their own colour.

Every CoE5SE mod command is documented on the [CoE5SE docs site](https://musical-pianist.github.io/coe5se-docs/).

MIT License.
