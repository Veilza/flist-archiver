const express = require('express')
const path = require('path')
const { Readable } = require ('stream')
const { URLSearchParams } = require('url')

const app = express()
const PORT = process.env.PORT || 3000

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))
// Serve static files from dist
app.use(express.static(path.join(__dirname, 'public')))

// Parse JSON bodies (if needed)
app.use(express.json())

// Get account ticket
app.post('/api/login', async (req, res) => {
  try {
    // Set up URL parameters
    const params = new URLSearchParams()
    params.append('account', req.body.account)
    params.append('password', req.body.password)
    params.append('no_friends', req.body.no_friends ? '1' : '0')
    params.append('no_bookmarks', req.body.no_bookmarks ? '1' : '0')

    // POST and fetch response
    const response = await fetch('https://www.f-list.net/json/getApiTicket.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    // Check that response is OK
    if (!response.ok) {
      return res.status(response.status).send(await response.text())
    }

    // Return data back to the frontend
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).send('Proxy request failed')
  }
})

// Get character data
app.post('/api/character-data', async (req, res) => {
  try {
    // Set up URL parameters
    const params = new URLSearchParams()
    params.append('account', req.body.account)
    params.append('ticket', req.body.ticket)
    params.append('name', req.body.name)

    // POST and fetch response
    const response = await fetch('https://www.f-list.net/json/api/character-data.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    // Check that response is OK
    if (!response.ok) {
      return res.status(response.status).send(await response.text())
    }

    // Return data back to the frontend
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).send('Proxy request failed')
  }
})

// Image proxy to be able to download images from F-List
app.get('/api/image-proxy', async (req, res) => {
  const imageFile = req.query.imageFile
  console.log(`Proxying image: ${imageFile}`)
  if (!imageFile) {
    return res.status(400).send('No image file provided.')
  }

  const imageUrl = `https://static.f-list.net/images/charimage/${imageFile}`

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image')
    }

    res.set('Content-Type', response.headers.get('content-type'))
    const stream = Readable.from(response.body)  // Convert to Node stream
    stream.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).send('Proxy error')
  }
})


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
