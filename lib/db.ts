import mysql from 'mysql2/promise';

// 同一进程复用连接池；Serverless 的不同实例仍各自拥有一个池。
const globalForDb = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
};

const pool = globalForDb.mysqlPool ?? mysql.createPool({
  host: 'mysqlserverless.cluster-cautknyafblq.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: '35nPQH!ut;anvcA',
  database: 'GPT_experiment',
  connectionLimit: 2,
  maxIdle: 1,
  idleTimeout: 10_000,
  connectTimeout: 10_000,
  waitForConnections: true,
  queueLimit: 50
});

globalForDb.mysqlPool = pool;

export default pool;
