const ENV_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const ENV_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const ENV_DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID || ''
const DRIVE_CONFIG_KEY = 'amo-os-drive-config'

let accessToken: string | null = null
let tokenExpiry = 0

export interface DriveConfig {
  clientId: string
  apiKey: string
  folderId: string
}

export interface DriveUploadResult {
  fileId: string
  fileName: string
  webViewLink: string
  thumbnailLink: string
}

export function getDriveConfig(): DriveConfig {
  const fallback = {
    clientId: ENV_GOOGLE_CLIENT_ID,
    apiKey: ENV_GOOGLE_API_KEY,
    folderId: ENV_DRIVE_FOLDER_ID,
  }

  try {
    const saved = JSON.parse(localStorage.getItem(DRIVE_CONFIG_KEY) || '{}') as Partial<DriveConfig>
    return {
      clientId: saved.clientId || fallback.clientId,
      apiKey: saved.apiKey || fallback.apiKey,
      folderId: saved.folderId || fallback.folderId,
    }
  } catch {
    return fallback
  }
}

export function saveDriveConfig(config: DriveConfig) {
  localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(config))
  accessToken = null
  tokenExpiry = 0
}

export function clearDriveConfig() {
  localStorage.removeItem(DRIVE_CONFIG_KEY)
  accessToken = null
  tokenExpiry = 0
}

export function isDriveConfigured() {
  const config = getDriveConfig()
  return Boolean(config.clientId && config.apiKey && config.folderId)
}

export function formatOsDriveFolderName(osNumero: string) {
  const slug = osNumero
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `os_${slug || Date.now()}`
}

export function formatOsPhotoFileName(osNumero: string, label: string, index: number) {
  const folder = formatOsDriveFolderName(osNumero)
  const cleanLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${folder}_${String(index + 1).padStart(2, '0')}_${cleanLabel || 'foto'}.jpg`
}

export async function authenticateGoogleDrive(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken

  return new Promise((resolve, reject) => {
    const config = getDriveConfig()
    if (!config.clientId) return reject(new Error('Google Client ID nao configurado'))

    const redirectUri = window.location.origin
    const scope = 'https://www.googleapis.com/auth/drive.file'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`

    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600')
    if (!popup) return reject(new Error('Popup bloqueado'))

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval)
          reject(new Error('Autenticacao cancelada'))
          return
        }
        const hash = popup.location.hash
        if (hash.includes('access_token')) {
          clearInterval(interval)
          popup.close()
          const params = new URLSearchParams(hash.substring(1))
          accessToken = params.get('access_token')
          const expiresIn = parseInt(params.get('expires_in') || '3600', 10)
          tokenExpiry = Date.now() + expiresIn * 1000
          resolve(accessToken || '')
        }
      } catch {
        // Popup is still on Google's domain.
      }
    }, 500)
  })
}

export async function uploadToDrive(
  blob: Blob,
  fileName: string,
  osNumero: string,
): Promise<DriveUploadResult> {
  if (!isDriveConfigured()) {
    return saveToDemoStorage(blob, fileName, osNumero)
  }

  const token = await authenticateGoogleDrive()
  const folderId = await getOrCreateFolder(formatOsDriveFolderName(osNumero), token)

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'image/jpeg',
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )

  if (!res.ok) throw new Error(`Upload falhou: ${res.statusText}`)

  const data = await res.json()
  return {
    fileId: data.id,
    fileName: data.name,
    webViewLink: data.webViewLink || '',
    thumbnailLink: data.thumbnailLink || '',
  }
}

async function getOrCreateFolder(name: string, token: string): Promise<string> {
  const config = getDriveConfig()
  const query = `name='${name}' and '${config.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) return searchData.files[0].id

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [config.folderId],
    }),
  })

  if (!createRes.ok) throw new Error(`Falha ao criar pasta: ${createRes.statusText}`)
  const createData = await createRes.json()
  return createData.id
}

function saveToDemoStorage(
  blob: Blob,
  fileName: string,
  osNumero: string,
): Promise<DriveUploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const key = `amo-os-photo-${formatOsDriveFolderName(osNumero)}-${fileName}`
      try {
        localStorage.setItem(key, reader.result as string)
      } catch {
        // localStorage can be full; the OS itself should still be saved.
      }
      resolve({
        fileId: key,
        fileName,
        webViewLink: reader.result as string,
        thumbnailLink: reader.result as string,
      })
    }
    reader.readAsDataURL(blob)
  })
}

export function getDemoPhotos(osNumero: string): DriveUploadResult[] {
  const photos: DriveUploadResult[] = []
  const prefix = `amo-os-photo-${formatOsDriveFolderName(osNumero)}-`
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) {
      const data = localStorage.getItem(key)!
      const fileName = key.replace(prefix, '')
      photos.push({ fileId: key, fileName, webViewLink: data, thumbnailLink: data })
    }
  }
  return photos
}
