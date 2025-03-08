import dotenv from 'dotenv';
import path from 'path';

export const isInDist = path.parse(process.cwd()).name === 'dist';

let dotenvPath = path.join(process.cwd(), '.env');
if (isInDist) dotenvPath = path.join(process.cwd(), '..', '.env');
dotenv.config({ path: dotenvPath });
