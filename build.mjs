// build.mjs
import { config } from 'dotenv';
import { execSync } from 'child_process';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL no encontrada en .env");

execSync(
    `bun build index.ts --compile --define "process.env.DATABASE_URL='${DATABASE_URL}'" --outfile automac.exe`,
    { stdio: 'inherit' }
);