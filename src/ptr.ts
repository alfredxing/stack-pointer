#!/usr/bin/env node

import Prettier from 'prettier';
import path from 'node:path';

const CONTEXT = 10;

async function main() {
	const input = process.argv[process.argv.length - 1];
	if (!input) return usage();

	const match = input.match(/(^https?:\/\/.*?):(\d+):(\d+)$/);
	if (!match) return usage();

	const url = match[1];
	const row = parseInt(match[2], 10);
	const col = parseInt(match[3], 10);

	const file = await (await fetch(url)).text();
	const startingCursor = findCursor(file, row, col);

	const { formatted, cursorOffset } = await Prettier.formatWithCursor(file, {
		cursorOffset: startingCursor,
		filepath: path.basename(new URL(url).pathname),
	});
	print(formatted, cursorOffset);
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

function print(buffer: string, cursor: number) {
	const lines = buffer.split('\n');
	let offset = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (offset + line.length + 1 >= cursor) {
			const col = cursor - offset;

			// Print context before
			for (let ci = i - CONTEXT; ci <= i; ci++) {
				process.stdout.write(lines[ci] + '\n');
			}

			// Print pointer
			process.stdout.write(new Array(col).fill('-').join('') + '^' + '\n');

			// Print context after
			for (let ci = 0; ci < CONTEXT; ci++) {
				process.stdout.write(lines[i + ci + 1] + '\n');
			}

			break;
		}

		// Add 1 at the end for the newline character
		offset += line.length + 1;
	}
}

function usage() {
	process.stderr.end(`Usage: ptr script-url:row:col` + '\n');
	process.exit(2);
}

main();
