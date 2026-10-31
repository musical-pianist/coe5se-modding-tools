# CoE5 Modding

[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/musical-pianist/coe5se-modding-tools?label=openssf%20scorecard)](https://scorecard.dev/viewer/?uri=github.com/musical-pianist/coe5se-modding-tools)

CoE5 Modding validates your Conquest of Elysium 5 .c5m and .c5se files as you write them, flagging each line that would end in the game's Mod Error before you launch a game. Autocomplete and hover documentation cover every vanilla and CoE5SE mod command, so you rarely need to reference the manual.

## Install

- **Cursor, VSCodium, Windsurf:** search "CoE5 Modding" in the Extensions panel.
- **VS Code:** download the .vsix from its [Open VSX page](https://open-vsx.org/extension/musical-pianist/coe5se-c5m), then run "Extensions: Install from VSIX...".

## Features

- **Validation.** The extension flags an unknown mod command and a `--` comment, both of which stop the game with its Mod Error, and an unclosed quote, including one the game cuts short at a `#`. Inside a `playerevent` or `squareevent`, an unknown event action or trigger is flagged the same way. A misspelled mod command offers the closest valid commands as quick fixes.
- **CoE5SE placement.** The extension warns when a mod opener such as `modprio` or `requires` sits anywhere but a plain line of your mod file, and when a CoE5SE mod command sits on a line vanilla reads, with the `#!@` prefix as its quick fix. An `include` inside an included file is flagged too, since CoE5SE stops the game there with its Mod Error.
- **Autocomplete.** The extension offers the mod commands valid in the block you are in, vanilla and CoE5SE. Inside quotes, it offers monsters, weapons, items, spells, rituals, magic paths and classes by string, both vanilla and those your mod declares.
- **Hover documentation.** A mod command's hover gives its signature, what it does and each argument by name, linked to its CoE5SE docs entry or, where the manual covers it, its page in Illwinter's modding manual. A number's hover gives its meaning from the 20 number tables in the manual and the docs site, from plane numbers to damage types.
- **Go to definition.** Jump from any name in quotes to the line in your mod that declares it.
- **Event branches.** `if`, `elseif` and `else` each take their own colour, so every decision tree in your events reads at a glance.

Every CoE5SE mod command is documented on the [CoE5SE docs site](https://musical-pianist.github.io/coe5se-docs/).

MIT License.
