// Solo permite acceso al email configurado como ADMIN_EMAIL
module.exports = function adminOnly(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return res.status(403).json({ error: 'Admin no configurado' });
  if (req.user?.email !== adminEmail) return res.status(403).json({ error: 'Acceso denegado' });
  next();
};
