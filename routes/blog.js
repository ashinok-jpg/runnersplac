// routes/blog.js
const express = require('express');
const router = express.Router();
const { loadBlog, listBlogs } = require('../lib/blogs');
const { isLocalDev, validateIdParam } = require('../lib/session');

router.param('slug', validateIdParam);

router.get('/', (req, res) => {
  res.render('blog/index', { blogs: listBlogs(), user: res.locals.user, req });
});

router.get('/:slug', (req, res, next) => {
  try {
    const blog = loadBlog(req.params.slug);
    if (!blog || (blog.draft && !req.user?.isAdmin && !isLocalDev(req))) {
      return res.status(404).send('Not Found');
    }
    if (blog.view) return res.render(blog.view);
    res.render('blog/show', { blog, user: res.locals.user, req });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
