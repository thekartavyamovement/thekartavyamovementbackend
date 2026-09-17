import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,

  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'kartavya_movement',
  },

  mail: {
    // SMTP credentials for the sending account
    host:     process.env.SMTP_HOST     || 'smtp.gmail.com',
    port:     parseInt(process.env.SMTP_PORT || '465', 10),
    secure:   process.env.SMTP_SECURE !== 'false', // true for port 465
    user:     process.env.SMTP_USER     || '',
    pass:     process.env.SMTP_PASS     || '',
    // Recipients — comma-separated in .env, split here
    recipients: (
      process.env.MAIL_RECIPIENTS ||
      'connect@thekartavyamovement.org,thekartavyamovement@gmail.com'
    ).split(',').map(e => e.trim()),
  },

  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',').map(o => o.trim()),
  },
};
