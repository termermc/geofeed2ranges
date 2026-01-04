import * as readline from 'node:readline/promises'
import { isIP } from 'node:net'
import { Readable } from 'node:stream'

/**
 * Takes in a stream containing an RFC 8805 geofeed CSV file and yields CIDR ranges.
 * Invalid lines are skipped over.
 * Lines that are bare IPs without subnets are converted to CIDR notation (e.g. `127.0.0.1` becomes `127.0.0.1/32`).
 * @param {ReadableStream | NodeJS.ReadableStream} input The input stream for the geofeed CSV file.
 * @returns {AsyncGenerator<string, void, void>}
 * @yields Each CIDR range.
 */
export async function* geofeedToRanges(input) {
	const reader = readline.createInterface({
		input:
			input instanceof ReadableStream
				? Readable.fromWeb(
						/** @type {import('node:stream/web').ReadableStream} */ (
							input
						),
					)
				: input,
		crlfDelay: Infinity,
	})

	for await (const _ln of reader) {
		const ln = /** @type {string} */ (_ln)

		if (ln === '') {
			continue
		}
		if (ln[0] === '#') {
			continue
		}

		const commaIdx = ln.indexOf(',')
		const ipLn = commaIdx === -1 ? ln : ln.substring(0, commaIdx)

		const slashIdx = ipLn.lastIndexOf('/')

		/** @type {string} */
		let ip
		/** @type {number} */
		let subnet

		if (slashIdx === -1) {
			ip = ipLn

			const ipVer = isIP(ip)
			if (ipVer === 0) {
				// Invalid IP string.
				continue
			}

			if (ipVer === 6) {
				subnet = 128
			} else {
				subnet = 32
			}
		} else {
			ip = ipLn.substring(0, slashIdx)
			subnet = parseInt(ipLn.substring(slashIdx + 1))

			if (isNaN(subnet) || subnet < 0) {
				// Invalid subnet mask.
				// Probably invalid IP string.
				continue
			}

			const ipVer = isIP(ip)
			if (ipVer === 0) {
				// Invalid IP string.
				continue
			}
			if (ipVer === 6 && subnet > 128) {
				// Invalid IPv6 subnet mask.
				continue
			}
			if (ipVer === 4 && subnet > 32) {
				// Invalid IPv4 subnet mask.
				continue
			}
		}

		yield `${ip}/${subnet}`
	}
}
