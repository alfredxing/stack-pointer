#!/usr/bin/env node

import Prettier from 'prettier';
import path from 'node:path';

const DEFAULTS = {
	context: 10,
};

async function main() {
	const input = process.argv[process.argv.length - 1];
	if (!input) return usage();

	const match = input.match(/(^https?:\/\/.*?):(\d+):(\d+)$/);
	if (!match) return usage();

	const { context } = parseArgs();

	const url = match[1];
	const row = parseInt(match[2], 10);
	const col = parseInt(match[3], 10);

	const file = await (await fetch(url)).text();
	const startingCursor = findCursor(file, row, col);

	const { formatted, cursorOffset } = await Prettier.formatWithCursor(file, {
		cursorOffset: startingCursor,
		filepath: path.basename(new URL(url).pathname),
	});
	print(formatted, cursorOffset, context);
}

function findCursor(file: string, row: number, col: number) {
	const lines = file.split('\n');
	let position = 0;

	// Validation
	if (row < 1) throw new Error(`Invalid row ${row}`);
	if (col < 0) throw new Error(`Invalid column ${col}`);
	if (row > lines.length) throw new Error(`File has fewer than ${row} rows`);

	// Add up previous rows; rows start at 1
	for (let i = 1; i < row; i++) {
		// Add 1 at the end for the newline character
		position += lines[i - 1].length + 1;
	}

	// Add column
	position += col;

	return position;
}

function print(buffer: string, cursor: number, context: number) {
	const lines = buffer.split('\n');
	const output: string[] = [];
	let offset = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (offset + line.length + 1 >= cursor) {
			const col = cursor - offset;

			// Context before
			for (let ci = Math.max(0, i - context); ci <= i; ci++) {
				output.push(lines[ci]);
			}

			// Pointer line
			output.push(new Array(col).fill('-').join('') + '^');

			// Context after
			for (let ci = 0; ci < Math.min(lines.length, context); ci++) {
				output.push(lines[i + ci + 1]);
			}

			process.stdout.write(
				output.filter((line) => line !== undefined).join('\n')
			);
			process.stdout.write('\n');

			break;
		}

		// Add 1 at the end for the newline character
		offset += line.length + 1;
	}
}

// TODO: do this better
function parseArgs(): { context: number } {
	try {
		const args = process.argv.slice(2, process.argv.length - 1).join(' ');

		const context = parseInt(
			args.match(/(?:^| )(?:-c\s*|--?context(?:=|\s+))(\d+)(?: |$)/)?.[1] ?? '',
			10
		);

		return { context: !context || isNaN(context) ? DEFAULTS.context : context };
	} catch (e) {
		return usage();
	}
}

function usage(): never {
	process.stderr.end(
		[
			`Usage: stack-pointer [<options>] script-url:row:col`,
			`Options:`,
			`    -c N, --context=N        Number of lines of context to show before and after the pointer`,
			``,
		].join('\n')
	);
	process.exit(2);
}

main();
