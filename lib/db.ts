import mysql from 'mysql2/promise';

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    // 支持 PEM 证书中的实际换行和字面量 \n。
    ca: process.env.DB_SSL_CA?.replace(/\\n/g, '\n'),
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: 'TLSv1.2',
  },
  waitForConnections: true,
  connectionLimit: 500, // 根据你的需求设置连接数
  queueLimit: 0
});

export default pool;
