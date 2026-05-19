let cachedFirebase;

function normalizeJsonStringNewlines(value) {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (isEscaped) {
        if (char === '\n') {
          result += 'n';
          isEscaped = false;
          continue;
        }

        if (char === '\r') {
          isEscaped = false;
          continue;
        }

        result += char;
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        result += char;
        inString = false;
        continue;
      }

      if (char === '\r') {
        continue;
      }

      if (char === '\n') {
        result += '\\n';
        continue;
      }

      result += char;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    result += char;
  }

  return result;
}

function parseServiceAccountJson(value) {
  const source = String(value ?? '').trim();
  if (!source) {
    return null;
  }

  try {
    return JSON.parse(source);
  } catch {
    const normalized = normalizeJsonStringNewlines(source.replace(/\\"/g, '"'));
    return JSON.parse(normalized);
  }
}

async function loadAdminModules() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ]);

  return { appModule, authModule, firestoreModule };
}

export async function getFirebaseClients(config) {
  if (cachedFirebase) {
    return cachedFirebase;
  }

  const { appModule, authModule, firestoreModule } = await loadAdminModules();
  const { initializeApp, getApps, applicationDefault, cert } = appModule;

  if (config.firebaseUseEmulators) {
    process.env.FIRESTORE_EMULATOR_HOST = config.firestoreEmulatorHost;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.firebaseAuthEmulatorHost;
  }

  let credential;
  if (config.firebaseServiceAccountJson) {
    credential = cert(parseServiceAccountJson(config.firebaseServiceAccountJson));
  } else if (config.googleApplicationCredentials) {
    credential = applicationDefault();
  }

  const appOptions = {
    projectId: config.firebaseProjectId,
    storageBucket: config.firebaseStorageBucket || undefined,
  };

  if (credential) {
    appOptions.credential = credential;
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp(appOptions);

  cachedFirebase = {
    app,
    auth: authModule.getAuth(app),
    firestore: firestoreModule.getFirestore(app),
  };

  return cachedFirebase;
}
