# geofeed2ranges

Library to extract IP ranges from an [RFC 8805](https://datatracker.ietf.org/doc/html/rfc8805) geofeed.

# Install

```bash
npm install geofeed2ranges
```

# Example

## Read from URL

```javascript
import { geofeedToRanges } from 'geofeed2ranges'

const httpRes = await fetch(
	'https://raw.githubusercontent.com/tmobile/tmus-geofeed/main/tmus-geo-ip.txt',
)

for await (const ln of geofeedToRanges(httpRes.body)) {
	console.log(ln)
}
```

## Read from file

```javascript
import { createReadStream } from 'node:fs'
import { geofeedToRanges } from 'geofeed2ranges'

const file = createReadStream('geofeed.csv')

for await (const ln of geofeedToRanges(file)) {
	console.log(ln)
}
```
