// server/middleware/permit.js
module.exports = function permit(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ msg: 'Unauthorized: No user found' });
      }
      if (allowedRoles.includes(req.user.role)) {
        return next();
      }
      return res.status(403).json({ msg: 'Forbidden: Insufficient privileges' });
    };
  };
  