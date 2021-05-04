const express = require('express');
const router = express.Router();
const path = require('path');

const renderPage = (req, res) => {
  switch (req.route.path) {
    case '/home':
      res.sendFile(path.join(__dirname, '../Pages/index.html'));
      break;
  }
};

router.use('/public', express.static(path.join(__dirname, '../Pages')));
router.get('/home', renderPage);

module.exports = router;
