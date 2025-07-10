<template>
  <div>
    <h1>F-List Archiver</h1>
    <!-- Actual archiver page-->
    <div v-if="loggedIn">
      <p>Press the 'Create ZIP Archive' button, and your profile BBcode and images will be downloaded once the ZIP file is ready.</p>
      <button @click="createArchive">Create ZIP Archive</button>
      <hr/>
      <h2>Characters</h2>
      <p>Select all characters that you wish to export the data of.</p>
      <br/>
      <ul id="characterList">
        <li v-for="character in characters" :key="character">
          <label>
            <input type="checkbox" :value="character" :checked="character === defaultCharacter"/>
            {{ character }}
          </label>
        </li>
      </ul>
      <br/>
      <button @click="logOut">Logout</button>
    </div>

    <!-- Login Portion -->
    <div v-else>
      <p>Log in below to retrieve character data</p>
      <input type="text" v-model="account" placeholder="Username"/>
      <br/>
      <input type="password" v-model="password" placeholder="Password"/>
      <br/>
      <button @click="acquireTicket">Login</button>
    </div>
  </div>
</template>

<script setup>
  import JSZip from 'jszip'
  import { ref, onMounted } from 'vue'

  const loggedIn = ref(false)
  const account = ref('')
  const password = ref('')
  const ticket = ref('')
  const characters = ref([])
  const defaultCharacter = ref('')

  // Check cookies on page load
  onMounted(() => {
    ticket.value = getCookie('ticket')
    if (ticket.value) {
      loggedIn.value = true
      // Load characters & default_character from storage/cookies
      const chars = localStorage.getItem('characters')
      if (chars) {
        characters.value = JSON.parse(chars)
      }
      defaultCharacter.value = getCookie('default_character') || ''
      account.value = getCookie('account') || ''
    }
  })

  async function acquireTicket () {
    let data

    try {
      // Fetch the API ticket from our proxy
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Account information
          account: account.value,
          password: password.value,

          // We only need character data - not friend or bookmark data
          no_friends: true,
          no_bookmarks: true
        })
      })

      // Check that we got an appropriate response from F-List
      if (!response.ok) {
        console.log(`Server error: ${response.status} ${response.statusText}`)
        alert(`Server error: ${response.status} ${response.statusText}`)
        return
      }

      // We only care about the response's JSON output
      data = await response.json()

      // Error checking, mainly for invalid login credentials
      if (data.error) {
        console.log(`Error: ${data.error}`)
        alert(`Error: ${data.error}`)
        return
      }
    } catch (err) {
      console.log('Failed to fetch data from F-List: ' + err.message)
      alert('Failed to fetch data from F-List: ' + err.message)
      return
    }

    if (data) {
      loggedIn.value = true

      // Store in cookies
      document.cookie = `ticket=${encodeURIComponent(data.ticket)}; path=/; max-age=86400`
      ticket.value = data.ticket
      document.cookie = `default_character=${encodeURIComponent(data.default_character)}; path=/; max-age=86400`
      defaultCharacter.value = data.default_character
      document.cookie = `account=${encodeURIComponent(account.value)}; path=/; max-age=86400`

      // Store character data in localstorage
      // It could probably be a cookie, but I just prefer arrays being in localstorage
      localStorage.setItem('characters', JSON.stringify(data.characters))

      characters.value = data.characters
    }
  }

  // Archiving function, grabs data from proxy URLs and compiles all profile data into a ZIP file
  async function createArchive () {
    const zip = new JSZip()
    const archiveFolder = zip.folder('archive')

    // Get all selected checkboxes inside characterList
    const selectedCheckboxes = Array.from(document.querySelectorAll('#characterList input[type="checkbox"]:checked'))
    if (selectedCheckboxes.length === 0) {
      console.log('Please select at least one character.')
      alert('Please select at least one character.')
      return
    }

    for (const checkbox of selectedCheckboxes) {
      const characterName = checkbox.value
      console.log(`Archiving character: ${characterName}`)

      let data
      try {
        const response = await fetch('/api/character-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account: account.value,
            ticket: ticket.value,
            name: characterName
          })
        })

        if (!response.ok) {
          console.log(`Server error: ${response.status} ${response.statusText}`)
          alert(`Server error: ${response.status} ${response.statusText}`)
          continue
        }

        data = await response.json()

        if (data.error) {
          console.log(`Error: ${data.error}`)
          alert(`Error: ${data.error}`)
          continue
        }
      } catch (err) {
        console.log('Failed to fetch data from F-List: ' + err.message)
        alert('Failed to fetch data from F-List: ' + err.message)
        continue
      }

      // Create a folder for the character
      const charFolder = archiveFolder.folder(characterName)
      charFolder.file(`${characterName}.txt`, data.description)

      // Download images if available
      if (data.images && data.images.length > 0) {
        const imagesFolder = charFolder.folder('images')
        for (const image of data.images) {
          const imageFile = `${image.image_id}.${image.extension}`
          const url = `/api/image-proxy?imageFile=${encodeURIComponent(imageFile)}`
          try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`Failed to fetch ${url}`)
            const blob = await response.blob()
            const arrayBuffer = await blob.arrayBuffer()
            imagesFolder.file(imageFile, arrayBuffer)
          } catch (err) {
            console.error(err)
            alert(`Failed to fetch image from ${url}: ${err.message}`)
          }
        }
      }
    }

    // Generate the ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    // Prompt download
    const downloadLink = document.createElement('a')
    downloadLink.href = URL.createObjectURL(zipBlob)
    downloadLink.download = 'archive.zip'
    downloadLink.click()
  }

  function logOut () {
    // Delete cookies by setting expiration in the past
    document.cookie = 'ticket=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'default_character=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'account=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'

    // Clear characters from localStorage
    localStorage.removeItem('characters')

    // Reset Vue state
    loggedIn.value = false
    account.value = ''
    password.value = ''
    characters.value = []
    defaultCharacter.value = ''
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
  }

  // Some lazy code to allow for easy mass-select
  const checkboxes = document.querySelectorAll('#checkbox-list input[type="checkbox"]')
  let lastChecked = null

  checkboxes.forEach((checkbox, index) => {
    checkbox.addEventListener('click', (e) => {
      if (e.shiftKey && lastChecked !== null) {
        const start = Math.min(index, lastChecked)
        const end = Math.max(index, lastChecked)
        for (let i = start; i <= end; i++) {
          checkboxes[i].checked = true
        }
      }
      lastChecked = index
    })
  })
</script>

<style scoped>
  input {
    width: 150px;
  }

  button {
    margin-top: 10px;
    padding: 10px 20px;
    font-size: 16px;
  }
</style>
