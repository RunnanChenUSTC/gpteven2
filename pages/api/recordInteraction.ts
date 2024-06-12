import pool from '../../lib/db';
import { NextRequest, NextResponse } from "next/server";
// Import necessary modules and types
//import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 确保使用POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { action, ...data } = req.body;

  try {
    const connection = await pool.getConnection();

    try {
      if (action === 'insertInteraction') {
        const { UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID } = data;
        const query = 'INSERT INTO user_log (UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID) VALUES (?, ?, ?, ?, ?, ?)';
        const params = [UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID || null];
        const [result] = await connection.execute<mysql2.ResultSetHeader>(
          query, params
        );

        if (result.affectedRows > 0) {
          res.status(200).json({ success: true, message: 'Data inserted successfully' });
        } else {
          throw new Error('Failed to insert data');
        }
      } else if (action === 'fetchUserID') {
        const { username } = data;
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT UserID FROM user WHERE UserName = ?', [username]
        );

        if (rows.length > 0) {
          const { UserID } = rows[0];
          res.status(200).json({ success: true, UserID });
        } else {
          res.status(404).json({ success: false, message: 'User not found' });
        }
      } else {
        res.status(400).json({ message: 'Invalid action' });
      }
    } finally {
      // 确保释放连接
      connection.release();
    }
  } catch (error) {
    console.error('Database connection or query failed:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
