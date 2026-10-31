# Security policy

## Reporting a vulnerability

Report a security problem privately through GitHub's form, not in a public issue:
https://github.com/musical-pianist/coe5se-modding-tools/security/advisories/new

Name the tool and its version, what happened, and the file or steps that make it happen. You should get a first reply within 14 days. musical_pianist discloses the vulnerability once a fix is released, in a published advisory that credits you unless you ask otherwise.

## Supported versions

Only the latest release of each tool gets security fixes.

## What CoE5 Modding does on your machine

CoE5 Modding is the VS Code extension in `vscode-extension/`, and all of its code is in `vscode-extension/extension.js`. A report that shows it doing more than this list is a vulnerability.

- The extension starts when you open a .c5m or .c5se file, or a folder that holds one.
- The extension reads its own data files, and up to 5,000 .c5m and .c5se files in your open folder (skipping `node_modules`), to find the monsters, weapons, items, spells, rituals, magic paths and classes your mod declares, for go to definition.
- The extension changes a file only when you pick one of its quick fixes: a typo fix, or `#!@` at the start of a line.
- The extension makes no network requests, starts no other programs, and stores no data of its own.
- The extension's hovers are untrusted Markdown, so a link in a hover can't run a VS Code command.
