import { config } from 'dotenv';
import log from 'electron-log';

/* Populate process.env with vars from .env and verify required vars are present. */
export function setupEnv(): void {
  config();
  const requiredEnvVars = ['DAEMON_URI', 'API_PORT', 'WSS_PORT'];
  for (const required of requiredEnvVars) {
    if (process.env[required] === undefined) {
      log.warn(
        `Required environment variable '${required}' is not set. Please consult the README.`
      );
      process.exit(1);
    }
  }
}
