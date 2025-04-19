
import Mailgen from 'mailgen';
import nodemailer from 'nodemailer';
import { ApiError } from './apiError.js';
import dotenv from 'dotenv';
dotenv.config();

export const sendMail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: 'default',
    product: {
      name: 'Task Manager',
      link: 'https://yourcompany.com',
    },
  });

  const emailText = mailGenerator.generatePlaintext(options.mailGenContent);
  const emailHtml = mailGenerator.generate(options.mailGenContent);

  const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_SMTP_HOST,
    port: process.env.MAILTRAP_SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.MAILTRAP_SMTP_USER,
      pass: process.env.MAILTRAP_SMTP_PASS,
    },
  });

  const mail = {
    from: process.env.MAILTRAP_FROM,
    to: options.email,
    subject: options.subject,
    text: emailText,
    html: emailHtml,
  }

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new ApiError('Email could not be sent', 500);
  }
}

const emailVerificationGenContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: 'Welcome to Task Manager! We are excited to have you on board.',
      action: {
        instructions: 'To get started with Task Manager, please verify your email address by clicking the button below:',
        button: {
          color: '#22BC66',
          text: 'Verify your email',
          link: verificationUrl,
        },
      },
      outro: 'If you did not create an account, no further action is required.',
    },
  }
}

const forgotPasswordGenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: 'You have requested to reset your password.',
      action: {
        instructions: 'To reset your password, please click the button below:',
        button: {
          color: '#22BC66',
          text: 'Reset your password',
          link: passwordResetUrl,
        },
      },
      outro: 'If you did not request a password reset, please ignore this email.',
    },
  }
}