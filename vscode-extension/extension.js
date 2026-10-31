// CoE5 Modding: autocomplete, hover help, go to definition, and typo fixes for Conquest of Elysium 5
// .c5m files and CoE5SE's .c5se files. The word and name data is generated from the COE5mod repo
// by scripts/gen_vscode_data.py into data/.
"use strict";
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const WORDS = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "words.json"), "utf8"));
const GAME_NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "names.json"), "utf8"));
// Which extension this is: CoE5SE's (coe5se true), or the vanilla carbon copy, packed from the same code with
// only vanilla's words (scripts/gen_vscode_data.py, pack_vsix). The vanilla one leaves CoE5SE's rules out.
const EDITION = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "edition.json"), "utf8"));
const FULL_EXTENSION = "musical-pianist.coe5se-c5m";

// Which kind of name a word takes in quotes. A word not listed takes any kind.
const NAME_KIND = {
	selectmonster: "monster", copystats: "monster", copyspr: "monster", setmaincom: "monster",
	addstartcom: "monster", addstartunits: "monster", addunitrec: "monster", addcomrec: "monster",
	addmercrec: "monster", newunits: "monster", promoteunits: "monster", hascom: "monster",
	hascomhere: "monster", hasunit: "monster", hasunithere: "monster", minunits: "monster", promote: "monster",
	selectweapon: "weapon", meleeweapon: "weapon", rangedweapon: "weapon", itemwep: "weapon", weapon: "weapon",
	nextwep: "weapon", nextalwayswep: "weapon",
	selectitem: "item", startitem: "item", hasitem: "item", hasitemhere: "item", removeitem: "item", newitem: "item",
	combatspell: "spell",
	path: "path", spellweapon: "path", spellweaponbonus: "path", spellweapon50: "path", spellweapon50s: "path",
	spellweaponsingle: "path", pathboost: "path", newspell1: "path", newspell2: "path", newspell3: "path",
	selectspellpath: "path",
	selectritual: "ritual", copyritual: "ritual",
};
// Words that define a name, and its kind (newitem defines one only outside events).
const DEFINES = {
	newmonster: "monster", newweapon: "weapon", newitem: "item", newspell: "spell", newritual: "ritual",
	newspellpath: "path", setclassname: "class",
};
// The block a word opens, for picking the right meaning of a word that means one thing in a monster
// block and another in an item block. Values are the manual pages' names.
const BLOCK = {
	newmonster: "Monsters", selectmonster: "Monsters", newitem: "Items", selectitem: "Items",
	newweapon: "Weapons", selectweapon: "Weapons", newritual: "Rituals", selectritual: "Rituals",
	newritpow: "Rituals", newclass: "Classes", selectclass: "Classes", selectterr: "Terrain",
	selectterrgroup: "Terrain", newspell: "In a newspell block (CoE5SE)", selectspellpath: "After selectspellpath (CoE5SE)",
	newsetting: "In a settings block (CoE5SE)", newsettingpage: "In a settings block (CoE5SE)",
	newsettingheader: "In a settings block (CoE5SE)",
};
const PATH_FIRST_WORDS = new Set(["spellweapon", "spellweaponbonus", "spellweapon50", "spellweapon50s",
	"spellweaponsingle", "pathboost", "newspell1", "newspell2", "newspell3"]);

// ---- Reading a file the way the game does ----------------------------------------------------
// The game cuts each line at its first #, quotes or not.
function codePart(text) {
	const hash = text.indexOf("#");
	return hash < 0 ? text : text.slice(0, hash);
}

// A .c5m line that starts with #!@ holds a line the .c5se could hold: the game without CoE5SE skips it
// as a comment, and with CoE5SE reads the line after the prefix.
const PREFIX = EDITION.coe5se ? /^(\s*)#!@/ : /(?!)/;   // vanilla reads a #!@ line as a comment

// The line as CoE5SE has the game read it: in a .c5m, a #!@ prefix becomes spaces, so columns stay.
function readText(text, c5m) {
	return c5m ? text.replace(PREFIX, (m, space) => space + "   ") : text;
}

// One line's first word, its start, and the rest. `c5m` reads its #!@ lines; `prefixed` says the
// line is one.
function splitLine(text, c5m) {
	const code = codePart(readText(text, c5m));
	const m = /^(\s*)(\S+)(.*)$/.exec(code);
	if (!m) return null;
	return { word: m[2], start: m[1].length, rest: m[3], code, prefixed: !!c5m && PREFIX.test(text) };
}

// The two languages differ only in their grammar's #!@ rule (scripts/gen_vscode_data.py); everything
// here serves both.
const LANGUAGES = EDITION.coe5se ? ["c5m", "c5se"] : ["c5m"];

function isSidecar(doc) {
	return doc.fileName.toLowerCase().endsWith(".c5se");
}

// Whether a .c5se is a mod's own, <ModName>.c5se next to <ModName>.c5m: only it, and the .c5m's #!@ lines,
// can include another .c5se.
function isModSidecar(fileName) {
	return fs.existsSync(fileName.replace(/\.c5se$/i, ".c5m"));
}

function isC5m(fileName) {
	return fileName.toLowerCase().endsWith(".c5m");
}

// The state at each line: inside an event or not, and the open block's manual page.
function lineStates(doc) {
	const states = [], c5m = isC5m(doc.fileName);
	let event = false, block = "";
	for (let i = 0; i < doc.lineCount; i++) {
		states.push({ event, block });
		const s = splitLine(doc.lineAt(i).text, c5m);
		if (!s) continue;
		if (s.word === "playerevent" || s.word === "squareevent") event = true;
		else if (s.word === "endevent") event = false;
		else if (!event && BLOCK[s.word]) block = BLOCK[s.word];
	}
	return states;
}

// ---- The names mods define --------------------------------------------------------------------
// {kind: Map(lower name -> [{name, uri, line}])}, from every .c5m and .c5se in the workspace.
const index = new Map();

function indexText(uri, text) {
	for (const kinds of index.values())
		for (const [key, defs] of kinds) {
			const kept = defs.filter((d) => d.uri.toString() !== uri.toString());
			if (kept.length) kinds.set(key, kept); else kinds.delete(key);
		}
	let event = false;
	const c5m = isC5m(uri.fsPath);
	text.split(/\r?\n/).forEach((line, i) => {
		const s = splitLine(line, c5m);
		if (!s) return;
		if (s.word === "playerevent" || s.word === "squareevent") event = true;
		else if (s.word === "endevent") event = false;
		const kind = DEFINES[s.word];
		if (!kind || (event && s.word === "newitem")) return;
		const m = /^\s*"([^"]+)"/.exec(s.rest);
		if (!m) return;
		if (!index.has(kind)) index.set(kind, new Map());
		const kinds = index.get(kind), key = m[1].toLowerCase();
		if (!kinds.has(key)) kinds.set(key, []);
		kinds.get(key).push({ name: m[1], uri, line: i });
	});
}

// A folder named like a mod file, or a file deleted before it is read (a build's temporary
// copies), adds no names and shows no error.
async function indexFile(uri) {
	try {
		if ((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory) return;
		indexText(uri, Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"));
	} catch (e) {
		indexText(uri, "");
	}
}

async function indexWorkspace() {
	const files = await vscode.workspace.findFiles("**/*.{c5m,c5se}", "**/node_modules/**", 5000);
	for (const uri of files) await indexFile(uri);
}

// The places `name` is made, one each: copies of a file (a git worktree, a backup folder) that make it at the
// same line of a file with the same name count once.
function definitionsOf(name, kind) {
	const found = [], seen = new Set();
	for (const [k, kinds] of index) {
		if (kind && k !== kind) continue;
		for (const d of kinds.get(name.toLowerCase()) || []) {
			const key = `${k}|${path.basename(d.uri.fsPath).toLowerCase()}|${d.line}`;
			if (seen.has(key)) continue;
			seen.add(key);
			found.push({ ...d, kind: k });
		}
	}
	return found;
}

// ---- Words --------------------------------------------------------------------------------------
function wordEntry(word) {
	if (WORDS[word]) return WORDS[word];
	if ((word[0] === "+" || word[0] === "-") && word.length > 1) {
		const own = WORDS["+" + word.slice(1)];   // CoE5SE's trigger: +setting
		if (own && own.kinds.includes("coe5se-trigger")) return own;
		const e = WORDS[word.slice(1)];
		if (e && e.kinds.includes("trigger")) return e;
	}
	return null;
}

// Whether `word` may start a line in this state.
const EVENT_BOUNDS = new Set(["playerevent", "squareevent", "endevent"]);

function wordFits(word, entry, state) {
	if (EVENT_BOUNDS.has(word)) return true;   // they open and close events, so they stand outside one
	const k = entry.kinds;
	if (state.event) {
		if (word[0] === "+" || word[0] === "-") return k.includes("trigger") || k.includes("coe5se-trigger");
		return k.includes("action");
	}
	return k.includes("parser") || k.includes("coe5se");
}

function isCoe5seWord(entry) {
	return entry.kinds.includes("coe5se") || entry.kinds.includes("coe5se-trigger");
}

// The arguments of a word's form, as the manual writes it: `addstartunits "monster name" <nbr>`
// gives [monster name, nbr]. A quoted name is text in quotes; [ ] marks an optional one; a | between
// two makes them one argument that is either.
function parseSignature(signature, word) {
	const args = [];
	const body = signature.slice(signature.indexOf(word) + word.length).split(/[,;(]| or [a-z]/)[0];
	const re = /\[([^\]]*)\]|"([^"]*)"|<([^>]*)>|(\|)/g;
	let m, either = false;
	while ((m = re.exec(body))) {
		if (m[4]) { either = true; continue; }
		const optional = m[1] !== undefined;
		const name = (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]).replace(/[<>"]/g, "").trim();
		if (either && args.length) args[args.length - 1].name += " or " + name;
		else args.push({ name, optional });
		either = false;
	}
	return args;
}

// The values written after the word: quoted text, or a word without spaces.
function lineValues(rest) {
	const values = [], re = /"([^"]*)"?|(\S+)/g;
	let m;
	while ((m = re.exec(rest))) values.push(m[1] !== undefined ? `"${m[1]}"` : m[2]);
	return values;
}

// ---- Forms and summon string parts -------------------------------------------------------------
// The form of a CoE5SE command with several (data/words.json "forms") that a line's values fit: the one
// that names the first value as a word (noexplode start), else one that takes arguments when the line
// has values, else the first.
function formFor(entry, word, values) {
	const forms = entry.forms || [];
	if (!forms.length) return { signature: entry.signature || word, doc: entry.doc, args: entry.args };
	const bare = word.replace(/^[+-]/, ""), first = values.length ? values[0].replace(/\W/g, "") : "";
	const named = first && forms.find((f) => new RegExp(`\\b${bare}\\s+${first}\\b`).test(f.signature));
	if (named) return named;
	const withArgs = values.length && forms.find((f) => parseSignature(f.signature, bare).length);
	return withArgs || forms[0];
}

// The form a line's values fit: a CoE5SE command's by formFor; a game word's first meaning, or the first one
// that takes as many values as the line has (a CoE5SE form of a game word, templerec <amount> [<cap>]).
function lineForm(entry, word, values, docs = entry.docs || []) {
	if (isCoe5seWord(entry)) return formFor(entry, word, values);
	if (!docs.length) return { signature: entry.signature || word, doc: entry.doc, args: entry.args };
	const bare = word.replace(/^[+-]/, "");
	return docs.find((d) => parseSignature(d.signature, bare).length >= values.length) || docs[0];
}

// What argument `name` of `form` does (data/words.json "args"), or a number table's meaning of `value`.
function argumentMeaning(form, word, name, index, value) {
	const table = tableFor(word, name, index), text = numberMeaning(table, value);
	if (text) return { text, table };
	return form.args && form.args[name] ? { text: form.args[name] } : null;
}

// The text of the addstring line above `lineNo` in its block, the string noexplode changes, or null.
function stringAbove(doc, lineNo) {
	const c5m = isC5m(doc.fileName);
	for (let i = lineNo - 1; i >= 0; i--) {
		const s = splitLine(doc.lineAt(i).text, c5m);
		if (!s) continue;
		if (s.word === "addstring") {
			const m = /"([^"]*)"?/.exec(s.rest);
			return m ? m[1] : null;
		}
		if (BLOCK[s.word] || s.word === "endevent") return null;
	}
	return null;
}

// Whether a summon string part's count has dice: a "d" before its "*", past a "(N)" prefix.
function partHasDice(part) {
	const p = part.replace(/^\([^)]*\)/, ""), star = p.indexOf("*");
	return star > 0 && p.slice(0, star).includes("d");
}

// What a value on a noexplode line means: a part number, read back from the addstring above (its parts
// split at " & ", as the game splits them), or start or end.
function noexplodeValue(doc, lineNo, entry, value) {
	if (/^\d+$/.test(value)) {
		const text = stringAbove(doc, lineNo);
		if (text === null) return "No `addstring` above it in this block.";
		const parts = text.split(" & "), n = Number(value), part = parts[n - 1];
		if (n < 1 || !part) return `No part ${value}: the string has ${parts.length}.`;
		return `Part ${n}: \`${part}\`${partHasDice(part) ? "" : " (no dice)"}`;
	}
	const form = (entry.forms || []).find((f) => new RegExp(`\\bnoexplode\\s+${value.replace(/\W/g, "")}\\b`).test(f.signature));
	return form ? form.doc : null;
}

// ---- Number tables ------------------------------------------------------------------------------
// The manual's number tables (data/tables.json): which number means which resource, player, plane,
// and so on. An argument's name in a word's form picks its table; a word whose first argument is a
// table's number (dmgtype) picks it by the word.
const TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "tables.json"), "utf8"));

function tableFor(word, argName, index) {
	const key = TABLES.args[argName.toLowerCase()] || (index === 0 ? TABLES.words[word] : undefined);
	return key ? TABLES.tables[key] : null;
}

// What `value` means in `table`: its row (a range row such as 0-23 covers each number in it), or for
// a table of flags, the rows its value adds up from.
function numberMeaning(table, value) {
	if (!table || !/^-?\d+$/.test(value)) return null;
	if (table.flags) {
		const n = BigInt(value);   // the flags go past 2^31
		const parts = table.rows.filter(([v]) => (n & BigInt(v)) !== 0n).map(([, t]) => t);
		return parts.length ? parts.join(" + ") : null;
	}
	const n = Number(value);
	const row = table.rows.find(([v]) => {
		const range = /^(-?\d+)-(\d+)$/.exec(v);
		return range ? n >= Number(range[1]) && n <= Number(range[2]) : Number(v) === n;
	});
	return row ? row[1] : null;
}

// The value under `character` on a line split by splitLine: its index among the line's values and its text.
function valueAt(s, character) {
	const re = /"([^"]*)"?|(\S+)/g, base = s.start + s.word.length;
	let m, index = 0;
	while ((m = re.exec(s.rest))) {
		if (character >= base + m.index && character <= base + m.index + m[0].length) return { index, text: m[0] };
		index++;
	}
	return null;
}

function titleCase(text) {
	return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Each argument by name, with the value the line gives it.
function argumentLines(md, form, word, values) {
	const signature = form.signature;
	const args = parseSignature(signature, word);
	if (!args.length) return;
	const meaning = (a, i) => {
		const m = argumentMeaning(form, word, a.name, i, values[i]);
		return m ? ` ${m.text}` : "";
	};
	const lines = args.map((a, i) => `\`${titleCase(a.name)}\` \u2192 ${i < values.length ? `**${values[i].replace(/[*_`]/g, "\\$&")}**${meaning(a, i)}` : a.optional ? "*(left out)*" : "*(missing)*"}`);
	const repeats = /\.\.\./.test(signature);   // a form such as noexplode <part> ... takes its last argument again and again
	if (values.length > args.length && repeats)
		values.slice(args.length).forEach((v) => lines.push(`\`${titleCase(args[args.length - 1].name)}\` \u2192 **${v.replace(/[*_`]/g, "\\$&")}**`));
	else if (values.length > args.length) lines.push(`*More than the form takes:* ${values.slice(args.length).join(" ")}`);
	md.appendMarkdown(lines.join("  \n") + "\n\n");
}

function docMarkdown(word, entry, block, values) {
	const md = new vscode.MarkdownString();
	const docs = (entry.docs || []).slice();
	docs.sort((a, b) => (b.context === block) - (a.context === block));
	if (values) {   // a hover on a line: the arguments first, by the form of the block it is in
		const form = lineForm(entry, word, values, docs);
		md.appendMarkdown(`**${word}**${form.context && !isCoe5seWord(entry) ? ` *(${form.context})*` : ""}\n\n`);
		if (form.signature) argumentLines(md, form, word.replace(/^[+-]/, ""), values);
	}
	if (isCoe5seWord(entry)) {   // the form the line fits, the others by name, and the docs for the rest
		const chosen = formFor(entry, word, values || []);
		md.appendCodeblock(chosen.signature || word, "c5m");
		md.appendMarkdown(`**CoE5SE command.** ${chosen.doc || ""}`);
		const others = (entry.forms || []).filter((f) => f !== chosen).map((f) => `\`${f.signature}\``);
		if (others.length) md.appendMarkdown(`\n\nAlso: ${others.join(", ")}`);
		if (entry.docsUrl) md.appendMarkdown(`\n\n[Docs](${entry.docsUrl})`);
	} else if (docs.length) {
		docs.forEach((d, i) => {
			if (i) md.appendMarkdown("\n\n---\n\n");
			md.appendCodeblock(d.signature, "c5m");
			md.appendMarkdown(`*${d.context}.* ${d.doc}${d.url ? ` [Manual](${d.url})` : ""}`);
		});
	} else {
		md.appendCodeblock(word, "c5m");
		md.appendMarkdown(entry.doc || "A mod command the game knows.");
	}
	if (entry.modFileOnly) md.appendMarkdown("\n\nRead only from the .c5m, never from a .c5se.");
	(entry.tables || []).forEach((key) => {   // the tables its meaning names, written out (a long one: hover a number)
		const t = TABLES.tables[key];
		if (!t) return;
		md.appendMarkdown(t.rows.length <= 20 ? `\n\n*${t.title}:* ${t.rows.map(([v, text]) => `${v} ${text}`).join(" · ")}`
			: `\n\n*${t.title}:* hover a number on the line for its meaning.`);
	});
	return md;
}

// ---- Typos --------------------------------------------------------------------------------------
function distance(a, b) {
	const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	for (let j = 1; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++)
		for (let j = 1; j <= b.length; j++)
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
	return d[a.length][b.length];
}

function closestWords(word, state, count) {
	const sign = state.event && (word[0] === "+" || word[0] === "-") ? word[0] : "";
	const bare = sign ? word.slice(1) : word;
	return Object.entries(WORDS)
		.filter(([w, e]) => wordFits(sign + w.replace(/^\+/, ""), e, state))
		.map(([w]) => w.replace(/^\+/, ""))
		.map((w) => ({ w: sign + w, d: distance(bare.toLowerCase(), w.toLowerCase()) }))
		.filter((x) => x.d <= Math.max(2, Math.floor(bare.length / 3)))
		.sort((a, b) => a.d - b.d)
		.slice(0, count)
		.map((x) => x.w);
}

// ---- Diagnostics ----------------------------------------------------------------------------------
const diagnostics = vscode.languages.createDiagnosticCollection("coe5se-c5m");

function check(doc) {
	if (!LANGUAGES.includes(doc.languageId)) return;
	const found = [], states = lineStates(doc), sidecar = isSidecar(doc), c5m = isC5m(doc.fileName);
	for (let i = 0; i < doc.lineCount; i++) {
		const text = doc.lineAt(i).text, s = splitLine(text, c5m), read = readText(text, c5m);
		if (/^\s*--/.test(read)) {
			found.push(new vscode.Diagnostic(doc.lineAt(i).range, "-- isn't a comment in CoE5: the game stops here with its Mod Error. Comments start with #.", vscode.DiagnosticSeverity.Error));
			continue;
		}
		if (!s) continue;
		const range = new vscode.Range(i, s.start, i, s.start + s.word.length);
		if ((s.code.match(/"/g) || []).length % 2) {
			const hashInQuotes = read.indexOf("#") >= 0 && (codePart(read).match(/"/g) || []).length % 2;
			found.push(new vscode.Diagnostic(doc.lineAt(i).range, hashInQuotes
				? "The game cuts the line at #, even inside quotes, so this quote never closes."
				: "This quote never closes.", vscode.DiagnosticSeverity.Warning));
		}
		const entry = wordEntry(s.word), state = states[i];
		if (!entry || !wordFits(s.word, entry, state)) {
			const d = new vscode.Diagnostic(range, state.event
				? `${s.word} isn't an event action or trigger the game knows (triggers start with + or -).`
				: EDITION.coe5se ? `${s.word} isn't a word the game or CoE5SE knows: the game stops with "mod command did nothing".`
					: `${s.word} isn't a word vanilla CoE5 knows: the game stops with "mod command did nothing".`,
				vscode.DiagnosticSeverity.Warning);
			d.code = "unknown-word";
			found.push(d);
			continue;
		}
		if (!EDITION.coe5se) continue;   // the rest are CoE5SE's rules
		if (sidecar && entry.modFileOnly)
			found.push(new vscode.Diagnostic(range, `${s.word} works only in the .c5m: CoE5SE never reads a .c5se for it.`, vscode.DiagnosticSeverity.Warning));
		if (s.word === "include" && sidecar && !isModSidecar(doc.fileName))
			found.push(new vscode.Diagnostic(range, "include works only in your mod's own .c5se or on a #!@ line of its .c5m, never in a file they include: CoE5SE stops the game here with its Mod Error.", vscode.DiagnosticSeverity.Error));
		if (s.prefixed && entry.modFileOnly)
			found.push(new vscode.Diagnostic(range, `${s.word} works only on a plain .c5m line: CoE5SE reads a #!@ line as a .c5se line.`, vscode.DiagnosticSeverity.Warning));
		// A line that needs CoE5SE, which a #!@ prefix fixes (the quick fix below).
		const needsCoe5se = (message, severity) => {
			const d = new vscode.Diagnostic(range, message, severity);
			d.code = "needs-coe5se";
			found.push(d);
		};
		if (!sidecar && !s.prefixed && PATH_FIRST_WORDS.has(s.word) && /^\s*"/.test(s.rest))
			needsCoe5se("A path name in quotes works only in the .c5se or on a #!@ line: without CoE5SE the game drops this line with no error.", vscode.DiagnosticSeverity.Warning);
		if (!sidecar && !s.prefixed && entry.kinds.includes("coe5se") && !entry.modFileOnly)
			needsCoe5se(`${s.word} needs CoE5SE: without it the game stops here with its Mod Error. Put it in your .c5se, or start the line with #!@: the game reads both only with CoE5SE.`, vscode.DiagnosticSeverity.Information);
	}
	diagnostics.set(doc.uri, found);
}

// ---- Providers ----------------------------------------------------------------------------------
// The quoted name under the cursor on line `text`, and the word that starts the line.
function quotedAt(text, character) {
	const re = /"([^"]*)"/g;
	let m;
	while ((m = re.exec(text))) {
		if (character > m.index && character <= m.index + m[0].length) return { name: m[1], start: m.index + 1 };
	}
	return null;
}

function nameKindFor(word) {
	return NAME_KIND[word.replace(/^[+-]/, "")];
}

// ---- Branch colours -----------------------------------------------------------------------------
// if, elseif and else, the event branch words, each in a bold colour of its own on any theme, so where a
// branch starts is clear. The docs site colours them the same.
const BRANCH_COLOURS = { if: "#00c853", elseif: "#ff9f1c", else: "#e040fb" };

function colourBranches(editor, decorations) {
	if (!EDITION.coe5se || !editor || !LANGUAGES.includes(editor.document.languageId)) return;   // CoE5SE's event words
	const found = { if: [], elseif: [], else: [] };
	for (let i = 0; i < editor.document.lineCount; i++) {
		const m = /^(\s*(?:#!@\s*)?)(if|elseif|else)\b/.exec(editor.document.lineAt(i).text);
		if (m) found[m[2]].push(new vscode.Range(i, m[1].length, i, m[1].length + m[2].length));
	}
	for (const word in decorations) editor.setDecorations(decorations[word], found[word]);
}

function activate(context) {
	// The vanilla extension steps aside for CoE5SE's, which knows every vanilla word too.
	if (!EDITION.coe5se && vscode.extensions.getExtension(FULL_EXTENSION)) return;
	const selector = LANGUAGES.map((language) => ({ language }));
	const decorations = {};
	for (const word in BRANCH_COLOURS) {
		decorations[word] = vscode.window.createTextEditorDecorationType({ color: BRANCH_COLOURS[word], fontWeight: "bold" });
		context.subscriptions.push(decorations[word]);
	}
	const colourVisible = () => vscode.window.visibleTextEditors.forEach((editor) => colourBranches(editor, decorations));
	colourVisible();
	context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(colourVisible),
		vscode.workspace.onDidChangeTextDocument((e) => vscode.window.visibleTextEditors
			.filter((editor) => editor.document === e.document).forEach((editor) => colourBranches(editor, decorations))));
	indexWorkspace().then(() => vscode.workspace.textDocuments.forEach(check));
	const watcher = vscode.workspace.createFileSystemWatcher("**/*.{c5m,c5se}");
	watcher.onDidChange(indexFile);
	watcher.onDidCreate(indexFile);
	watcher.onDidDelete((uri) => indexText(uri, ""));
	context.subscriptions.push(watcher, diagnostics,
		vscode.workspace.onDidOpenTextDocument(check),
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (!LANGUAGES.includes(e.document.languageId)) return;
			indexText(e.document.uri, e.document.getText());
			check(e.document);
		}),
		vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)));

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, {
		provideCompletionItems(doc, pos) {
			const c5m = isC5m(doc.fileName), line = doc.lineAt(pos.line).text, before = readText(line.slice(0, pos.character), c5m);
			const state = lineStates(doc)[pos.line], sidecar = isSidecar(doc);
			const q = quotedAt(line, pos.character) || (/"[^"]*$/.test(before) ? { name: "", start: before.lastIndexOf('"') + 1 } : null);
			if (q) {   // a name in quotes
				const s = splitLine(line, c5m);
				const kind = s && nameKindFor(s.word);
				const items = [], seen = new Set();
				const add = (name, k, detail) => {
					if (seen.has(k + name)) return;
					seen.add(k + name);
					const it = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
					it.detail = detail;
					it.range = new vscode.Range(pos.line, q.start, pos.line, q.start + q.name.length);
					items.push(it);
				};
				for (const [k, kinds] of index) if (!kind || k === kind) for (const defs of kinds.values()) add(defs[0].name, k, `${k} in ${path.basename(defs[0].uri.fsPath)}`);
				for (const [k, names] of Object.entries(GAME_NAMES)) if (!kind || k === kind) names.forEach((n) => add(n, k, `the game's ${k}`));
				return items;
			}
			if (!/^\s*[+-]?\w*$/.test(before)) return [];   // only the first word of a line
			const prefixed = c5m && PREFIX.test(line);
			const items = [];
			for (const [w, e] of Object.entries(WORDS)) {
				const words = [];
				if (e.kinds.includes("coe5se-trigger")) words.push(w, "-" + w.slice(1));
				else {
					if (e.kinds.includes("trigger")) words.push("+" + w, "-" + w);
					if (e.kinds.some((k) => k !== "trigger")) words.push(w);
				}
				for (const word of words) {
					if (!wordFits(word, e, state) || ((sidecar || prefixed) && e.modFileOnly)) continue;
					const it = new vscode.CompletionItem(word, isCoe5seWord(e) ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Keyword);
					it.detail = (e.signature || word) + (isCoe5seWord(e) ? "  (CoE5SE)" : "");
					it.documentation = docMarkdown(word, e, state.block);
					items.push(it);
				}
			}
			return items;
		},
	}, '"', "+", "-"));

	context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
		provideHover(doc, pos) {
			const line = doc.lineAt(pos.line).text, s = splitLine(line, isC5m(doc.fileName));
			const prefix = s && s.prefixed ? PREFIX.exec(line)[1].length : -1;
			if (prefix >= 0 && pos.character >= prefix && pos.character <= prefix + 3)
				return new vscode.Hover(new vscode.MarkdownString("**#!@** A line only CoE5SE reads, as it reads a line of the .c5se. "
					+ "Without CoE5SE the game skips it as a comment, so the .c5m still loads."));
			if (!s) return null;
			const q = quotedAt(line, pos.character);
			if (q && q.name) {
				const kind = nameKindFor(s.word);
				const defs = definitionsOf(q.name, kind);
				const md = new vscode.MarkdownString();
				if (defs.length) defs.forEach((d) => md.appendMarkdown(`${d.kind} **${d.name}**, made in ${path.basename(d.uri.fsPath)} line ${d.line + 1}  \n`));
				else {
					const k = Object.keys(GAME_NAMES).find((k2) => (!kind || k2 === kind) && GAME_NAMES[k2].some((n) => n.toLowerCase() === q.name.toLowerCase()));
					md.appendMarkdown(k ? `The game's ${k} **${q.name}**.` : `No ${kind || "name"} called **${q.name}** in the game or this workspace.`);
				}
				return new vscode.Hover(md);
			}
			const entry = wordEntry(s.word);
			if (pos.character > s.start + s.word.length) {   // a number after the word: what it means, by the word's form
				const v = valueAt(s, pos.character);
				if (!v || !entry) return null;
				if (s.word === "noexplode") {   // a part number read back from the addstring above, or start or end
					const text = noexplodeValue(doc, pos.line, entry, v.text);
					return text ? new vscode.Hover(new vscode.MarkdownString(text)) : null;
				}
				const bare = s.word.replace(/^[+-]/, ""), form = lineForm(entry, s.word, lineValues(s.rest));
				const arg = form.signature ? parseSignature(form.signature, bare)[v.index] : null;
				const m = arg && argumentMeaning(form, bare, arg.name, v.index, v.text);
				return m ? new vscode.Hover(new vscode.MarkdownString(`\`${titleCase(arg.name)}\` **${v.text}**: ${m.text}${m.table ? `  \n*${m.table.title}*` : ""}`)) : null;
			}
			if (pos.character < s.start) return null;
			return entry ? new vscode.Hover(docMarkdown(s.word, entry, lineStates(doc)[pos.line].block, lineValues(s.rest))) : null;
		},
	}));

	context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, {
		provideDefinition(doc, pos) {
			const line = doc.lineAt(pos.line).text, s = splitLine(line, isC5m(doc.fileName)), q = quotedAt(line, pos.character);
			if (!s || !q || !q.name) return null;
			return definitionsOf(q.name, nameKindFor(s.word)).map((d) => new vscode.Location(d.uri, new vscode.Position(d.line, 0)));
		},
	}));

	context.subscriptions.push(vscode.languages.registerCodeActionsProvider(selector, {
		provideCodeActions(doc, range, ctx) {
			const actions = [], states = lineStates(doc);
			for (const d of ctx.diagnostics) {
				if (d.code === "needs-coe5se") {
					const a = new vscode.CodeAction("Start the line with #!@ (read only with CoE5SE)", vscode.CodeActionKind.QuickFix);
					a.edit = new vscode.WorkspaceEdit();
					a.edit.insert(doc.uri, new vscode.Position(d.range.start.line, 0), "#!@");
					a.diagnostics = [d];
					a.isPreferred = true;
					actions.push(a);
					continue;
				}
				if (d.code !== "unknown-word") continue;
				const word = doc.getText(d.range);
				for (const fix of closestWords(word, states[d.range.start.line], 3)) {
					const a = new vscode.CodeAction(`Change to ${fix}`, vscode.CodeActionKind.QuickFix);
					a.edit = new vscode.WorkspaceEdit();
					a.edit.replace(doc.uri, d.range, fix);
					a.diagnostics = [d];
					actions.push(a);
				}
			}
			return actions;
		},
	}, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }));
}

function deactivate() {}

module.exports = { activate, deactivate };
