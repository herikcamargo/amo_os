// ═══════════════════════════════════════════════════════════════
// Google Drive Upload Service
//
// Usa a API do Google Drive para salvar fotos em uma pasta
// específica. Requer OAuth2 ou Service Account configurado.
//
// Configuração:
// 1. Criar projeto no Google Cloud Console
// 2. Ativar Google Drive API
// 3. Criar credenciais OAuth2 (tipo "Web application")
// 4. Adicionar redirect URI do seu app
// 5. Criar uma pasta no Drive e pegar o ID dela
// ═══════════════════════════════════════════════════════════════

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID || ''

let accessToken: string | null = null
let tokenExpiry = 0

export const isDriveConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY && DRIVE_FOLDER_ID)

export async function authenticateGoogleDrive(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken

  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin
    const scope = 'https://www.googleapis.com/auth/drive.file'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`

    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600')
    if (!popup) return reject(new Error('Popup bloqueado'))

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval)
          reject(new Error('Autenticação cancelada'))
          return
        }
        const hash = popup.location.hash
        if (hash.includes('access_token')) {
          clearInterval(interval)
          popup.close()
          const params = new URLSearchParams(hash.substring(1))
          accessToken = params.get('access_token')!
          const expiresIn = parseInt(params.get('expires_in') || '3600')
          tokenExpiry = Date.now() + expiresIn * 1000
          resolve(accessToken)
        }
      } catch {
        // cross-origin — popup still on Google's domain
      }
    }, 500)
  })
}

export interface DriveUploadResult {
  fileId: string
  fileName: string
  webViewLink: string
  thumbnailLink: string
}

export async function uploadToDrive(
  blob: Blob,
  fileName: string,
  osNumero: string,
): Promise<DriveUploadResult> {
  if (!isDriveConfigured) {
    return saveToDemoStorage(blob, fileName, osNumero)
  }

  const token = await authenticateGoogleDrive()

  // Criar subpasta para a OS (se não existir)
  const folderId = await getOrCreateFolder(osNumero, token)

  // Upload com metadata
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
  // Buscar pasta existente
  const query = `name='${name}' and '${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) return searchData.files[0].id

  // Criar pasta
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [DRIVE_FOLDER_ID],
    }),
  })
  const createData = await createRes.json()
  return createData.id
}

// ─── Fallback: salva no localStorage como base64 (demo) ───
function saveToDemoStorage(
  blob: Blob,
  fileName: string,
  osNumero: string,
): Promise<DriveUploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const key = `amo-os-photo-${osNumero}-${fileName}`
      try {
        localStorage.setItem(key, reader.result as string)
      } catch {
        // localStorage full — silently skip
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
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`amo-os-photo-${osNumero}-`)) {
      const data = localStorage.getItem(key)!
      const fileName = key.replace(`amo-os-photo-${osNumero}-`, '')
      photos.push({ fileId: key, fileName, webViewLink: data, thumbnailLink: data })
    }
  }
  return photos
}
