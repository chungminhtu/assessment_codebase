export default () => ({
  sqlite: {
    dbPath: process.env.SQLITE3_DB_PATH || ':memory:',
  },
  postgres: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  },
  redis: {
    use_mock_redis: process.env.USE_MOCK_REDIS || true,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  max_jobs_number: process.env.MAX_JOBS_NUMBER,
});
