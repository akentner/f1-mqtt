import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Load environment variables with hierarchy support
 * 
 * Loading order (later files override earlier ones):
 * 1. .env (base configuration)
 * 2. .env.local (local overrides, should be in .gitignore)
 * 
 * This follows the pattern used by many frameworks like Next.js
 */
export function loadEnvironmentConfig(): void {
  const envFiles = [
    '.env',           // Base configuration
    '.env.local',     // Local overrides (gitignored)
  ];

  envFiles.forEach(envFile => {
    const envPath = path.resolve(process.cwd(), envFile);
    
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ 
        path: envPath,
        override: envFile === '.env.local' // Allow .env.local to override existing values
      });
      
      if (result.error) {
        console.warn(`Warning: Could not load ${envFile}:`, result.error.message);
      } else {
        console.log(`✓ Loaded environment config from ${envFile}`);
      }
    } else if (envFile === '.env') {
      // .env is required, .env.local is optional
      console.warn(`Warning: ${envFile} file not found at ${envPath}`);
    }
  });
}

// Load configuration immediately when this module is imported
loadEnvironmentConfig();
