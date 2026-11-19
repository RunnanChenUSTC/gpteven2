import mysql from 'mysql2/promise';

// 仅在服务端使用；凭证和 CA 证书通过 Vercel 环境变量提供。
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    // 兼容实际换行和以字面量 \n 保存的 PEM 证书。
    ca: process.env.DB_SSL_CA?.replace(/\\n/g, '\n'),
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: 'TLSv1.2',
  },
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  connectTimeout: 10000,
  queueLimit: 50,
});

export default pool;
