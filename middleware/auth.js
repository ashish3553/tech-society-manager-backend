// Server_side/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header (expecting token in "x-auth-token" header)
  const token = req.header('x-auth-token');

  // Check if no token is provided
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify the token using the secret key from .env file
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user data (id and role) to req.user
    req.user = decoded.user;

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    // If token verification fails, respond with a 401 (Unauthorized)
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
