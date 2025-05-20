const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const xss = require('xss');

// Configure strict XSS for user data with NO allowlist
const xssOptions = {
  whiteList: {}, // Empty whitelist means NO tags are allowed
  stripIgnoreTag: false, // Don't strip tags - encode them as HTML entities instead
  escapeHtmlTag: true, // Encode < and > as &lt; and &gt;
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object']
};
const strictXss = new xss.FilterXSS(xssOptions);

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      name: 'uk_username' // Use the existing index name
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      name: 'uk_email' // Use the existing index name
    }
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: (user) => {
      // Sanitize user fields to prevent XSS using strict configuration (NO tags)
      if (user.username) user.username = strictXss.process(user.username);
      if (user.full_name) user.full_name = strictXss.process(user.full_name);
      if (user.email) user.email = strictXss.process(user.email);
    },
    beforeUpdate: (user) => {
      // Sanitize user fields when updating
      if (user.changed('username')) user.username = strictXss.process(user.username);
      if (user.changed('full_name')) user.full_name = strictXss.process(user.full_name);
      if (user.changed('email')) user.email = strictXss.process(user.email);
    }
  }
});

// Static method to sanitize user data anywhere in the app
User.sanitizeFields = function(userData) {
  if (!userData) return userData;
  
  const sanitized = {...userData};
  if (sanitized.username) sanitized.username = strictXss.process(sanitized.username);
  if (sanitized.full_name) sanitized.full_name = strictXss.process(sanitized.full_name);
  if (sanitized.email) sanitized.email = strictXss.process(sanitized.email);
  
  return sanitized;
};

module.exports = User; 