const { Op } = require('sequelize');

/**
 * Middleware for handling pagination, sorting, and filtering
 */
class QueryMiddleware {
  /**
   * Parse pagination parameters
   */
  static pagination(req, res, next) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items
    const offset = (page - 1) * limit;

    req.pagination = { page, limit, offset };
    next();
  }

  /**
   * Parse sorting parameters
   */
  static sorting(allowedFields = []) {
    return (req, res, next) => {
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';

      if (sortBy && allowedFields.includes(sortBy)) {
        req.sorting = [[sortBy, sortOrder]];
      } else {
        req.sorting = [['created_at', 'DESC']]; // Default sorting
      }
      next();
    };
  }

  /**
   * Parse filter parameters
   */
  static filtering(allowedFilters = {}) {
    return (req, res, next) => {
      const filters = {};
      
      Object.keys(allowedFilters).forEach(field => {
        const value = req.query[field];
        if (value !== undefined) {
          const filterType = allowedFilters[field];
          
          switch (filterType) {
            case 'exact':
              filters[field] = value;
              break;
            case 'like':
              filters[field] = { [Op.like]: `%${value}%` };
              break;
            case 'gt':
              filters[field] = { [Op.gt]: parseFloat(value) };
              break;
            case 'lt':
              filters[field] = { [Op.lt]: parseFloat(value) };
              break;
            case 'date_range':
              if (req.query[`${field}_start`]) {
                filters[field] = { [Op.gte]: new Date(req.query[`${field}_start`]) };
              }
              if (req.query[`${field}_end`]) {
                filters[field] = {
                  ...filters[field],
                  [Op.lte]: new Date(req.query[`${field}_end`])
                };
              }
              break;
          }
        }
      });

      req.filters = filters;
      next();
    };
  }

  /**
   * Build standardized paginated response
   */
  static buildPaginatedResponse(data, totalCount, page, limit) {
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      data: data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }
}

module.exports = QueryMiddleware;
