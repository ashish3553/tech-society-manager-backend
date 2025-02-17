// server/utils/mailer.js
const mailjet = require('node-mailjet').apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_API_SECRET
);

/**
 * sendEmail - Sends an email using Mailjet.
 * @param {Object} options - Email options.
 * @param {string|Array} options.to - Recipient email address, a comma-separated string of emails, or an array of objects ({ Email, Name }).
 * @param {string} options.subject - Email subject.
 * @param {string} options.text - Plain text version of the email.
 * @param {string} [options.html] - HTML version of the email.
 * @param {string} [options.from] - Sender email; defaults to process.env.DEFAULT_FROM_EMAIL.
 */
const sendEmail = async ({ to, subject, text, html, from }) => {
  // If "to" is an array, assume it's already an array of recipient objects.
  // If "to" is a string, check if it contains commas.
  let recipients;
  if (Array.isArray(to)) {
    recipients = to;
  } else if (typeof to === 'string') {
    if (to.includes(',')) {
      // Split by comma and trim each email, then map to objects.
      recipients = to.split(',').map(email => ({ Email: email.trim() }));
    } else {
      recipients = [{ Email: to }];
    }
  } else {
    throw new Error('Invalid "to" field provided.');
  }

  const request = mailjet
    .post('send', { version: 'v3.1' })
    .request({
      Messages: [
        {
          From: {
            Email: from || process.env.DEFAULT_FROM_EMAIL,
            Name: "Bit2Byte" // Change this as needed
          },
          To: recipients,
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
