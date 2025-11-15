const Joi = require('joi');

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(50).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createBoard: Joi.object({
    title: Joi.string().min(1).max(100).optional(),
  }),

  updateBoard: Joi.object({
    title: Joi.string().min(1).max(100).optional(),
    isPublic: Joi.boolean().optional(),
  }),

  shareBoard: Joi.object({
    emails: Joi.array().items(Joi.string().email()).min(1).required(),
    permission: Joi.string().valid('view', 'edit').default('edit'),
  }),
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  };
};

module.exports = {
  schemas,
  validate,
};
