// src/services/credentialManager.ts

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import * as SecureStore from 'expo-secure-store';
import config from '../config/aws-config';
import { AuthTokens } from '../types';

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.aws_region,
});

const identityClient = new CognitoIdentityClient({
  region: config.aws_region,
});

const REFRESH_TOKEN_KEY = 'glaciersnap_refresh_token';
const ID_TOKEN_KEY = 'glaciersnap_id_token';

let currentTokens: AuthTokens | null = null;
let currentIdentityId: string | null = null;
let credentialExpiry: Date | null = null;

// --- User Pool Operations ---

export async function signUp(email: string, password: string): Promise<void> {
  await cognitoClient.send(
    new SignUpCommand({
      ClientId: config.cognito_client_id,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    })
  );
}

export async function confirmSignUp(
  email: string,
  code: string
): Promise<void> {
  await cognitoClient.send(
    new ConfirmSignUpCommand({
      ClientId: config.cognito_client_id,
      Username: email,
      ConfirmationCode: code,
    })
  );
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthTokens> {
  const response = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.cognito_client_id,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  const result = response.AuthenticationResult;
  if (!result || !result.IdToken || !result.AccessToken || !result.RefreshToken) {
    throw new Error('Authentication failed: missing tokens');
  }

  const tokens: AuthTokens = {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
  };

  currentTokens = tokens;

  // Store refresh token securely (survives app restarts)
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  await SecureStore.setItemAsync(ID_TOKEN_KEY, tokens.idToken);

  // Get Identity Pool credentials
  await refreshIdentityCredentials(tokens.idToken);

  return tokens;
}

export async function forgotPassword(email: string): Promise<void> {
  await cognitoClient.send(
    new ForgotPasswordCommand({
      ClientId: config.cognito_client_id,
      Username: email,
    })
  );
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await cognitoClient.send(
    new ConfirmForgotPasswordCommand({
      ClientId: config.cognito_client_id,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    })
  );
}

// --- Identity Pool Operations ---

const providerName = `cognito-idp.${config.aws_region}.amazonaws.com/${config.cognito_user_pool_id}`;

async function refreshIdentityCredentials(idToken: string): Promise<void> {
  // Step 1: Get the identity ID
  const idResponse = await identityClient.send(
    new GetIdCommand({
      IdentityPoolId: config.cognito_identity_pool_id,
      Logins: { [providerName]: idToken },
    })
  );

  if (!idResponse.IdentityId) {
    throw new Error('Failed to get identity ID');
  }
  currentIdentityId = idResponse.IdentityId;

  // Step 2: Get temporary credentials for this identity
  const credResponse = await identityClient.send(
    new GetCredentialsForIdentityCommand({
      IdentityId: currentIdentityId,
      Logins: { [providerName]: idToken },
    })
  );

  if (!credResponse.Credentials) {
    throw new Error('Failed to get credentials');
  }

  // Credentials are stored in memory only — never written to disk
  credentialExpiry = credResponse.Credentials.Expiration ?? null;
}

// --- Token Refresh (using stored refresh token) ---

export async function refreshSession(): Promise<boolean> {
  try {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return false;

    const response = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: config.cognito_client_id,
        AuthParameters: {
          REFRESH_TOKEN: storedRefreshToken,
        },
      })
    );

    const result = response.AuthenticationResult;
    if (!result || !result.IdToken) return false;

    currentTokens = {
      idToken: result.IdToken,
      accessToken: result.AccessToken ?? currentTokens?.accessToken ?? '',
      refreshToken: storedRefreshToken, // Refresh token doesn't change
    };

    await SecureStore.setItemAsync(ID_TOKEN_KEY, result.IdToken);
    await refreshIdentityCredentials(result.IdToken);
    return true;
  } catch {
    return false;
  }
}

// --- Credential Provider (used by S3Client and DynamoDBClient) ---

export function getCredentialProvider() {
  return async () => {
    // If credentials are about to expire (within 5 minutes), refresh
    if (credentialExpiry && new Date() > new Date(credentialExpiry.getTime() - 5 * 60 * 1000)) {
      const refreshed = await refreshSession();
      if (!refreshed) throw new Error('Session expired. Please log in again.');
    }

    const idToken = currentTokens?.idToken ?? (await SecureStore.getItemAsync(ID_TOKEN_KEY));
    if (!idToken) throw new Error('No ID token available');

    // Get fresh credentials
    const identityId = currentIdentityId ?? (await getIdentityId(idToken));

    const credResponse = await identityClient.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId,
        Logins: { [providerName]: idToken },
      })
    );

    const creds = credResponse.Credentials;
    if (!creds || !creds.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
      throw new Error('Failed to get AWS credentials');
    }

    credentialExpiry = creds.Expiration ?? null;

    return {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretKey,
      sessionToken: creds.SessionToken,
      expiration: creds.Expiration,
    };
  };
}

async function getIdentityId(idToken: string): Promise<string> {
  const response = await identityClient.send(
    new GetIdCommand({
      IdentityPoolId: config.cognito_identity_pool_id,
      Logins: { [providerName]: idToken },
    })
  );
  currentIdentityId = response.IdentityId ?? null;
  if (!currentIdentityId) throw new Error('Failed to get identity ID');
  return currentIdentityId;
}

// --- Getters ---

export function getIdentityIdSync(): string | null {
  return currentIdentityId;
}

export function getTokens(): AuthTokens | null {
  return currentTokens;
}

export function getCredentialExpiry(): Date | null {
  return credentialExpiry;
}

// --- Logout ---

export async function signOut(): Promise<void> {
  try {
    if (currentTokens?.accessToken) {
      await cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: currentTokens.accessToken,
        })
      );
    }
  } catch {
    // Ignore errors — we're logging out regardless
  }
  currentTokens = null;
  currentIdentityId = null;
  credentialExpiry = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ID_TOKEN_KEY);
}

// --- Attempt auto-login on app start ---

export async function tryAutoLogin(): Promise<boolean> {
  return refreshSession();
}
