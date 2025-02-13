// server/utils/mailer.js
const mailjet = require('node-mailjet').apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
  );

/**
 * sendEmail - Sends an email using Mailjet.
 * @param {Object} options - Email options.
 * @param {string} options.to - Recipient email address (or a comma-separated string of emails).
 * @param {string} options.subject - Email subject.
 * @param {string} options.text - Plain text version of the email.
 * @param {string} [options.html] - HTML version of the email.
 * @param {string} [options.from] - Sender email; defaults to process.env.DEFAULT_FROM_EMAIL.
 */
const sendEmail = async ({ to, subject, text, html, from }) => {
  const request = mailjet
    .post('send', { version: 'v3.1' }) 
    .request({
      Messages: [
        {
          From: {
            Email: from || process.env.DEFAULT_FROM_EMAIL,
            Name: "Bit2Byte" // You can change this to your project's name
          },
          To: [
            {
              Email: to
            }
          ],
          Subject: subject,
          TextPart: text,
          ...(html && { HTMLPart: html }),
        }
      ]
    });

  try {
    const result = await request;
    console.log("Mailjet response:", result.body);
    return result.body;
  } catch (err) {
    console.error("Mailjet error:", err.statusCode, err.message);
    throw err;
  }
};

module.exports = sendEmail;
