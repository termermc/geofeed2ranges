import * as fs from 'node:fs'
import * as readline from 'node:readline'
import * as https from 'node:https'
import * as http from 'node:http'

/**
 * Opens the geofeed at the specified URL.
 * Should be passed to {@link geofeedToRanges}.
 * @param {string | URL} url The URL.
 * @returns {Promise<http.IncomingMessage>} The request body
 */
export async function openUrlForGeofeed(url) {
	/** @type {URL} */
	let srcUrl
	if (typeof url === 'string') {
		srcUrl = new URL(url)
	} else {
		srcUrl = url
	}

	/** @type {import('node:http').get | import('node:https').get} */
	let get
	if (srcUrl.protocol === 'https:') {
		get = https.get
	} else if (srcUrl.protocol === 'http:') {
		get = http.get
	} else {
		throw new URL(`Non-HTTP URL passed to openUrlForGeofeed: "${srcUrl}"`)
	}

	const srcRes = await new Promise((promRes, promRej) => {
		get(srcUrl, promRes).on('error', promRej)
	})

	if (srcRes.statusCode !== 200) {
		throw new Error(
			`Made request to get geofeed at "${srcUrl}", but server returned status ${srcRes.statusCode}`,
		)
	}

	return srcRes
}

/**
 * Opens the file at the specified path for reading.
 * Waits for the file to be open before returning the stream.
 * @param {string} path The file path.
 * @returns {Promise<NodeJS.ReadableStream>} The file read stream.
 */
export async function openFileForReading(path) {
	return /** @type {Promise<NodeJS.ReadableStream>} */ (
		new Promise((res, rej) => {
			const rs = fs.createReadStream(path)
			rs.once('open', () => res(rs))
			rs.once('error', rej)
		})
	)
}

/**
 * Opens the file at the specified path for writing.
 * Waits for the file to be open before returning the stream.
 * @param {string} path The file path.
 * @returns {Promise<NodeJS.WritableStream>} The file write stream.
 */
export async function openFileForWriting(path) {
	return /** @type {Promise<NodeJS.WritableStream>} */ (
		new Promise((res, rej) => {
			const ws = fs.createWriteStream(path)
			ws.once('open', () => res(ws))
			ws.once('error', rej)
		})
	)
}

/**
 * Takes in an RFC 8805 geofeed content stream as an input and sends the raw IP/CIDR range lines to the output stream.
 * @param {NodeJS.ReadableStream} input The geofeed content stream.
 * @param {NodeJS.WritableStream & { close(cb?: (err: any) => void): void }} output The output stream to write range lines to.
 * @param {boolean} includeLastUpdated Whether to include a last updated comment at the top of the output.
 * @returns {Promise<void>}
 */
export async function geofeedToRanges(input, output, includeLastUpdated) {
	/** @param {string} str */
	function writeStr(str) {
		return /** @type {Promise<void>} */ (
			new Promise((res, rej) => {
				output.write(str, (err) => {
					if (err) {
						rej(err)
					} else {
						res()
					}
				})
			})
		)
	}

	if (includeLastUpdated) {
		await writeStr(`# Last updated: ${new Date().toISOString()}\n`)
	}

	const reader = readline.createInterface({
		input: input,
		crlfDelay: Infinity,
		terminal: false,
	})

	await /** @type {Promise<void>} */ (
		new Promise((promRes, promRej) => {
			let failed = false
			let lines = 0

			/** @param {any} err */
			function fail(err) {
				failed = true
				output.close()
				reader.close()
				promRej(err)
			}

			input.on('error', fail)
			output.on('error', fail)
			reader.on('close', () => {
				if (failed) {
					return
				}
				if (lines === 0) {
					fail(
						new Error(
							'Found no valid IP range lines from source file',
						),
					)
					return
				}

				reader.close()
				output.close((err) => {
					if (err) {
						fail(err)
						return
					}
					promRes()
				})
			})

			reader.on('line', (ln) => {
				if (ln === '' || ln[0] === '#') {
					return
				}

				const commaIdx = ln.indexOf(',')
				if (commaIdx === -1) {
					return
				}

				writeStr(ln.slice(0, commaIdx) + '\n').catch(fail)
				lines++
			})
		})
	)
}
