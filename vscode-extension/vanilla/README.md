# CoE5 Modding (.c5m)

[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/musical-pianist/coe5se-modding-tools?label=openssf%20scorecard)](https://scorecard.dev/viewer/?uri=github.com/musical-pianist/coe5se-modding-tools)

CoE5 Modding validates your Conquest of Elysium 5 .c5m files as you write them, flagging each line that would end in the game's Mod Error before you launch a game. Autocomplete and hover documentation cover every vanilla mod command, so you rarely need to reference the manual.

## Install

- **Cursor, VSCodium, Windsurf:** search "CoE5 Modding" in the Extensions panel.
- **VS Code:** download the .vsix from its [Open VSX page](https://open-vsx.org/extension/musical-pianist/coe5-c5m), then run "Extensions: Install from VSIX...".

## Features

- **Validation.** The extension flags an unknown mod command and a `--` comment, both of which stop the game with its Mod Error, and an unclosed quote, including one the game cuts short at a `#`. Inside a `playerevent` or `squareevent`, an unknown event action or trigger is flagged the same way. A misspelled mod command offers the closest valid commands as quick fixes.
- **Autocomplete.** The extension offers the mod commands valid in the block you are in. Inside quotes, it offers monsters, weapons, items, spells, rituals, magic paths and classes by string, both vanilla and those your mod declares.
- **Hover documentation.** A mod command's hover gives its signature, what it does and each argument by name, linked to its page in Illwinter's modding manual where the manual covers it. A number's hover gives its meaning from the manual's 18 number tables, from plane numbers to damage types.
- **Go to definition.** Jump from any name in quotes to the line in your mod that declares it.

Using CoE5SE? Install CoE5 Modding (.c5m and .c5se) instead. It covers every vanilla mod command as well, and this edition disables itself once that one is installed.

MIT License.
