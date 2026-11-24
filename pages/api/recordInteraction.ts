import pool from '../../lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 确保使用POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { action, ...data } = req.body;

  if (action !== 'insertInteraction' && action !== 'fetchUserID') {
    return res.status(400).json({ message: 'Invalid action' });
  }

  // pool.execute 在查询成功或失败后都会归还连接。
  try {
    if (action === 'insertInteraction') {
      const { UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID } = data;
      const query = 'INSERT INTO user_log (UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID) VALUES (?, ?, ?, ?, ?, ?)';
      const params = [UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID || null];
      const [result] = await pool.execute<mysql2.ResultSetHeader>(
        query, params
      );

      if (result.affectedRows > 0) {
        res.status(200).json({ success: true, message: 'Data inserted successfully' });
      } else {
        throw new Error('Failed to insert data');
      }
    } else if (action === 'fetchUserID') {
      const { username } = data;
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT UserID FROM user WHERE UserName = ?', [username]
      );

      if (rows.length > 0) {
        const { UserID } = rows[0];
        res.status(200).json({ success: true, UserID });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    }
  } catch (error) {
    console.error('Database connection or query failed:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
