type DesiredFile = {
  truckNumber: string;
  fileName: string;
  companyFolderName: string;
  truckFolderName: string;
  pathKey: string;
  htmlContent: string;
};

type ExistingDriveRecord = {
  dispatch_id?: string;
  truck_number?: string;
  file_name?: string;
  company_folder_name?: string;
  truck_folder_name?: string;
  path_key?: string;
  root_folder_id?: string;
  file_id?: string;
  status?: string;
  synced_at?: string;
};

type SyncPayload = {
  dispatchId: string;
  rootFolderId: string;
  companyName?: string;
  desiredFiles: DesiredFile[];
  previousFiles?: ExistingDriveRecord[];
  updatedAt?: string;
  status?: string;
};

type DriveFile = {
  id: string;
  name: string;
  parents?: string[];
  mimeType?: string;
};

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

function getEnv(name: string): string | undefined {
  const fromDeno = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
  const fromNode = typeof process !== 'undefined' ? process.env[name] : undefined;
  return fromDeno ?? fromNode;
}

function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY secret.');

  if (raw.includes('BEGIN PRIVATE KEY')) return raw.replace(/\\n/g, '\n').trim();

  const maybeBase64 = getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64');
  if (maybeBase64) {
    return atob(maybeBase64).replace(/\\n/g, '\n').trim();
  }

  return raw.replace(/\\n/g, '\n').trim();
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function createGoogleAccessToken(): Promise<string> {
  const clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL');
  if (!clientEmail) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL secret.');

  const privateKey = normalizePrivateKey(getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const impersonatedUser = getEnv('GOOGLE_IMPERSONATED_USER');

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet: Record<string, string | number> = {
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_AUDIENCE,
    exp: now + 3600,
    iat: now,
  };

  if (impersonatedUser) claimSet.sub = impersonatedUser;

  const base64Url = (value: string) =>
    btoa(value)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedClaims = base64Url(JSON.stringify(claimSet));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const assertion = `${signingInput}.${encodedSignature}`;

  const tokenResponse = await fetch(TOKEN_AUDIENCE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

async function driveRequest<T>(
  token: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${text}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function findFileByNameInParent(
  token: string,
  name: string,
  parentId: string,
  mimeType?: string
): Promise<DriveFile | null> {
  const mimeFilter = mimeType ? ` and mimeType='${mimeType}'` : '';
  const q = `name='${escapeDriveQueryValue(name)}' and '${parentId}' in parents and trashed=false${mimeFilter}`;

  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(
    'files(id,name,mimeType,parents)'
  )}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const data = await driveRequest<{ files?: DriveFile[] }>(token, url);
  return data.files?.[0] ?? null;
}

async function ensureFolder(token: string, parentId: string, folderName: string): Promise<DriveFile> {
  const existing = await findFileByNameInParent(token, folderName, parentId, 'application/vnd.google-apps.folder');
  if (existing) return existing;

  const file = await driveRequest<DriveFile>(token, `${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  return file;
}

async function uploadHtmlFile(
  token: string,
  parentId: string,
  fileName: string,
  htmlContent: string
): Promise<DriveFile> {
  const existing = await findFileByNameInParent(token, fileName, parentId);

  if (existing) {
    const updateUrl = `${DRIVE_UPLOAD_API}/files/${existing.id}?uploadType=media&supportsAllDrives=true`;
    await driveRequest<DriveFile>(token, updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlContent,
    });

    return { ...existing };
  }

  const boundary = `syncDispatchHtmlToDrive_${crypto.randomUUID()}`;
  const metadata = {
    name: fileName,
    parents: [parentId],
    mimeType: 'text/html',
  };

  const multipartBody =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
    `${htmlContent}\r\n` +
    `--${boundary}--`;

  return driveRequest<DriveFile>(
    token,
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
}

async function deleteFile(token: string, fileId: string): Promise<void> {
  await driveRequest<void>(token, `${DRIVE_API}/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
  });
}

function getPayload(arg1: unknown, arg2: unknown): SyncPayload {
  const candidates = [arg1, (arg1 as any)?.body, (arg2 as any)?.body, arg2];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && 'dispatchId' in (candidate as object)) {
      return candidate as SyncPayload;
    }
  }

  throw new Error('Invalid payload for syncDispatchHtmlToDrive.');
}

async function updateDispatchMetadata(dispatchId: string, records: ExistingDriveRecord[], updatedAt: string) {
  const appBaseUrl = getEnv('BASE44_APP_BASE_URL');
  const appId = getEnv('BASE44_APP_ID');
  const serviceToken = getEnv('BASE44_SERVICE_ROLE_TOKEN');

  if (!appBaseUrl || !appId || !serviceToken) {
    console.warn('Skipping Dispatch metadata update: missing BASE44_APP_BASE_URL/BASE44_APP_ID/BASE44_SERVICE_ROLE_TOKEN.');
    return;
  }

  const endpoint = `${appBaseUrl.replace(/\/$/, '')}/api/apps/${appId}/entities/Dispatch/${dispatchId}`;
  const body = {
    dispatch_html_drive_records: records,
    dispatch_html_drive_last_synced_at: updatedAt,
    dispatch_html_drive_last_sync_status: 'synced',
    dispatch_html_drive_last_sync_error: null,
  };

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dispatch metadata update failed (${response.status}): ${text}`);
  }
}

export default async function syncDispatchHtmlToDrive(arg1: unknown, arg2?: unknown) {
  const payload = getPayload(arg1, arg2);
  const {
    dispatchId,
    rootFolderId,
    desiredFiles = [],
    previousFiles = [],
    updatedAt = new Date().toISOString(),
    status = 'synced',
  } = payload;

  if (!dispatchId) throw new Error('dispatchId is required.');
  if (!rootFolderId) throw new Error('rootFolderId is required.');

  try {
    const token = await createGoogleAccessToken();
    const syncedFiles: ExistingDriveRecord[] = [];

    const desiredPathKeys = new Set(desiredFiles.map((file) => file.pathKey));
    const staleFiles = previousFiles.filter((file) => file.path_key && !desiredPathKeys.has(file.path_key));
    const removedFiles: ExistingDriveRecord[] = [];

    for (const stale of staleFiles) {
      if (!stale.file_id) continue;
      try {
        await deleteFile(token, stale.file_id);
        removedFiles.push(stale);
      } catch (deleteError) {
        console.error('Failed to delete stale Drive file.', { stale, error: deleteError });
      }
    }

    for (const target of desiredFiles) {
      const companyFolder = await ensureFolder(token, rootFolderId, target.companyFolderName);
      const truckFolder = await ensureFolder(token, companyFolder.id, target.truckFolderName);
      const uploaded = await uploadHtmlFile(token, truckFolder.id, target.fileName, target.htmlContent);

      syncedFiles.push({
        dispatch_id: dispatchId,
        truck_number: target.truckNumber,
        file_name: target.fileName,
        company_folder_name: target.companyFolderName,
        truck_folder_name: target.truckFolderName,
        path_key: target.pathKey,
        root_folder_id: rootFolderId,
        file_id: uploaded.id,
        status,
        synced_at: updatedAt,
      });
    }

    await updateDispatchMetadata(dispatchId, syncedFiles, updatedAt);

    return {
      files: syncedFiles,
      removedFiles,
    };
  } catch (error) {
    console.error('syncDispatchHtmlToDrive failed.', {
      dispatchId,
      rootFolderId,
      error,
    });

    throw error;
  }
}
