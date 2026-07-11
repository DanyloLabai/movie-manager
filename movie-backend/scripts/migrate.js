require('dotenv').config();

const path = require('path');
const { Client } = require('pg');
const { migrate } = require('postgres-migrations');

async function run() {
  const databaseUrl = process.env.DATABASE_URL;

  const client = new Client(
    databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl:
            process.env.NODE_ENV === 'production'
              ? { rejectUnauthorized: false }
              : false,
        }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 5432,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
  );

  await client.connect();
  try {
    await migrate({ client }, path.join(__dirname, '..', 'migrations'));
    console.log('Migrations applied successfully.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
