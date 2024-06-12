import mysql from 'mysql2/promise';

// 创建数据库连接池
const pool = mysql.createPool({
  host: 'mysqlserverless.cluster-cautknyafblq.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: '35nPQH!ut;anvcA',
  database: 'GPT_experiment',
  waitForConnections: true,
  connectionLimit: 100, // 根据你的需求设置连接数
  queueLimit: 0
});

export default pool;
