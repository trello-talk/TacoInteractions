import path from 'path';

export const isInDist = path.parse(process.cwd()).name === 'dist';
