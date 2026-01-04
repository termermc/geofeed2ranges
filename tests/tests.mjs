import { test } from 'node:test'
import * as assert from 'node:assert'
import { join as joinPaths } from 'node:path'
import { geofeedToRanges } from '../index.mjs'
import { createReadStream } from 'node:fs'

const quxlabsGeofeedPath = joinPaths(import.meta.dirname, 'quxlabs-geofeed.csv')
const tmobileGeofeedPath = joinPaths(import.meta.dirname, 'tmobile-geofeed.csv')
const mixedGeofeedPath = joinPaths(import.meta.dirname, 'mixed.csv')

test('correct line counts', async () => {
	const quxFile = createReadStream(quxlabsGeofeedPath)
	const quxLines = 18

	let count = 0
	for await (const _ of geofeedToRanges(quxFile)) {
		count++
	}

	assert.strictEqual(count, quxLines)

	const tmobileFile = createReadStream(tmobileGeofeedPath)
	const tmobileLines = 2_905

	count = 0
	for await (const _ of geofeedToRanges(tmobileFile)) {
		count++
	}

	assert.strictEqual(count, tmobileLines)

	const mixedFile = createReadStream(mixedGeofeedPath)
	const mixedLines = 6

	count = 0
	for await (const _ of geofeedToRanges(mixedFile)) {
		count++
	}

	assert.strictEqual(count, mixedLines)
})

test('normalize mixed lines', async () => {
	const file = createReadStream(mixedGeofeedPath)

	for await (const ln of geofeedToRanges(file)) {
		assert.ok(ln.includes('/'), 'contains subnet slash')

		if (ln.startsWith('::1')) {
			assert.strictEqual(ln, '::1/128', 'bare IPv6 has /128 subnet')
		} else if (ln.startsWith('127.0.0.1')) {
			assert.strictEqual(ln, '127.0.0.1/32', 'bare IPv4 has /32 subnet')
		}
	}
})

test('skip bad lines', async () => {
	const file = createReadStream(mixedGeofeedPath)

	for await (const ln of geofeedToRanges(file)) {
		assert.ok(!ln.includes('/33'))
		assert.ok(!ln.includes('/129'))
		assert.ok(!ln.includes('/-1'))
		assert.ok(!ln.includes('/a'))
	}
})
