import type { NextApiRequest, NextApiResponse } from 'next';
import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 确保使用POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const connectionConfig = {
    host: 'mysqlserverless.cluster-cautknyafblq.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: '35nPQH!ut;anvcA',
    database: 'GPT_experiment',
  };

  try {
    const connection = await mysql2.createConnection(connectionConfig);
    const { action, questionId } = req.body;

    // 处理基于questionId的查询
    if (action === 'fetchQuestion') {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT Content FROM Question_UMN WHERE QuestionID = ?',
        [questionId]
      );

      if (rows.length > 0) {
        res.status(200).json({ success: true, question: rows[0] });
      } else {
        res.status(404).json({ success: false, message: 'Question not found' });
      }
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }

  } catch (error) {
    console.error('Database connection or query failed:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
