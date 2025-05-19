const { Role, User } = require('../models');

/**
 * Middleware to check if a user has the required permission
 * @param {string} resource - The resource being accessed (e.g., 'accounts', 'users', 'transactions')
 * @param {string} action - The action being performed (e.g., 'read', 'write', 'create', 'delete')
 * @returns {Function} Express middleware function
 */
function checkPermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from the request
      const user = req.user;

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userRole = await Role.findByPk(user.role_id);
      
      if (!userRole) {
        return res.status(403).json({ error: 'User has no assigned role' });
      }

      // Parse permissions if they are a string
      let permissions;
      if (typeof userRole.permissions === 'string') {
        try {
          permissions = JSON.parse(userRole.permissions);
        } catch (e) {
          console.error('Failed to parse permissions:', e);
          return res.status(500).json({ error: 'Invalid permission format' });
        }
      } else {
        permissions = userRole.permissions;
      }

      // Check if user has the required permission
      if (!permissions[resource] || !permissions[resource].includes(action)) {
        return res.status(403).json({ 
          error: 'Permission denied'
        });
      }

      // Add role to the request for future reference
      req.userRole = userRole.name;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { checkPermission };