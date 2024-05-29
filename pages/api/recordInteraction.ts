import { NextRequest, NextResponse } from "next/server";
// Import necessary modules and types
//import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import mysql2 from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if the request method is POST
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

    const { action, ...data } = req.body;

    if (action === 'insertInteraction') {
      const { UserID, ButtonName, UserLogTime, GPTMessages, Note, QuestionID} = data;
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
  } catch (error) {
    console.error('Database connection or query failed:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
