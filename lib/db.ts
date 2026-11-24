import mysql from 'mysql2/promise';

const config: mysql.ConnectionOptions = {
  host: 'mysqlserverless.cluster-cautknyafblq.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: '35nPQH!ut;anvcA',
  database: 'GPT_experiment',
  connectTimeout: 10_000
};

// 每次查询新建连接，用完立即关闭。
// Serverless 实例冻结时不会留下空闲连接占用数据库。
async function execute<T>(sql: string, values: any[] = []): Promise<[T]> {
  const connection = await mysql.createConnection(config);
  try {
    const [result] = await connection.execute(sql, values);
    return [result] as unknown as [T];
  } finally {
    await connection.end().catch(() => connection.destroy());
  }
}

const db = { execute };

export default db;
